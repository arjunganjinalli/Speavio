/* ─────────────────────────────────────────────────────────────────
   cleanScript — normalise raw pasted text before line processing.
   Strips HTML, normalises quote characters, collapses blank lines.
   Em/en dashes are PRESERVED so Phase 3 patterns can match them
   directly as dialogue separators.
───────────────────────────────────────────────────────────────── */
function cleanScript(rawText){
    if(!rawText)return'';
    /* Strip HTML tags & decode common entities */
    var text=rawText
        .replace(/<[^>]+>/g,' ')
        .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
        .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    /* Normalise line endings */
    text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    /* Normalise smart/curly quotes — em/en dashes are kept intact */
    text=text
        .replace(/[\u2018\u2019]/g,"'")
        .replace(/[\u201C\u201D\u00AB\u00BB\u2039\u203A]/g,'"');
    /* Collapse 3+ consecutive blank lines to 2 */
    text=text.replace(/\n{3,}/g,'\n\n');
    return text;
}

/* ─────────────────────────────────────────────────────────────────
   _extractDialogueLines — six-phase dialogue detection engine.

   Phase 1 — find header end (first true dialogue line)
   Phase 2 — discard stage directions & structural lines
   Phase 3 — extract role + dialogue with 9 ordered patterns
   Phase 4 — clean embedded stage directions from dialogue text
   Phase 5 — merge aliased / duplicate role names

   Pure regex + string matching. No API calls.
   Private — call via parseScript() or localAutoDetectLines().
───────────────────────────────────────────────────────────────── */
function _extractDialogueLines(rawText){
    if(!rawText)return[];

    var text=cleanScript(rawText);
    var allLines=text.split('\n');

    /* ── Blacklist: words that cannot start a valid role name ── */
    var ROLE_BLACKLIST=/^(?:characters?|props?|costumes?|notes?|starting|narrator|setting|director|page\b|scene\b|act\b|fade\b|cut\b|int\b|ext\b|new\b|end\b|pause\b|beat\b|note\b|silence\b|cast\b|crew\b|prologue\b|epilogue\b|chorus\b|title\b|subtitle\b|roles?\b|chapter\b|pg\b|music\b|sfx\b|camera\b|direction\b|the\s+end\b|fin\b)\b/i;

    /* ── Keywords that mark non-dialogue lines ─────────────── */
    var SKIP_START=/^(?:scene\b|act\b|setting\b|at\s+rise\b|lights?\s+(?:up|down|fade)\b|sound\b|music\b|sfx\b|blackout\b|curtain\b|exeunt\b|exit\s|enter\s|transition\b|cut\s+to\b|fade\s+(?:in|out|to)\b)/i;

    /* ── Stage-direction action verbs ────────────────────── */
    var ACTION_START=/^(?:walks?\s|runs?\s|enters?\s|exits?\s|sits?\s|stands?\s|turns?\s|looks?\s|picks?\s|puts?\s|grabs?\s|throws?\s|takes?\s|hands\s|moves?\s|crosses?\s|points?\s|nods?\s|shakes?\s|laughs?\s|cries?\s|pauses?\s|waits?\s|opens?\s|closes?\s|waves?\s|hugs?\s|pulls?\s|pushes?\s|holds?\s|drops?\s|reads?\s|writes?\s|shows?\s|gives?\s|receives?\s|signals?\s)/i;

    function startsWithEmoji(s){
        if(!s)return false;
        var c=s.charCodeAt(0);
        if(c>=0xD800&&c<=0xDBFF)return true;
        if(c>=0x2600&&c<=0x27BF)return true;
        if(c>=0x2300&&c<=0x23FF)return true;
        return false;
    }

    /* ── cleanRole: strip markdown / screenplay annotations ── */
    function cleanRole(r){
        if(!r)return'';
        r=r.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
        r=r.replace(/__([^_]+)__/g,'$1').replace(/_([^_]+)_/g,'$1');
        r=r.replace(/\s*\((?:CONT'?D|O\.S\.|V\.O\.|O\.C\.|off-?stage|offstage)\s*\)\s*$/i,'');
        return r.replace(/\s+/g,' ').trim();
    }

    /* ── isValidRole: 1-5 core words, not blacklisted ──────── */
    function isValidRole(r){
        if(!r||r.length<2||r.length>65)return false;
        if(/^\d+$/.test(r))return false;
        if(ROLE_BLACKLIST.test(r))return false;
        if(!/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(r))return false;
        var base=r.replace(/\s*\([^)]*\)\s*$/,'');
        var wc=base.split(/\s+/).filter(Boolean).length;
        return wc>=1&&wc<=5;
    }

    /* ── PHASE 2: decide whether a line should be discarded ── */
    function shouldSkipLine(l){
        if(!l)return true;
        if(startsWithEmoji(l))return true;
        if(/^\d+[.)]\s/.test(l))return true;
        if(SKIP_START.test(l))return true;
        if(/^(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\s/i.test(l))return true;
        if(/^[A-Z][A-Z\s\d.'!?]{2,}$/.test(l)&&!/:\s*\S/.test(l)&&!/(?:—|--|–)\s+\S/.test(l)&&!/\s+-\s+\S/.test(l))return true;
        var wc=l.split(/\s+/).filter(Boolean).length;
        if(wc<4&&!/:\s*\S/.test(l)&&!/(?:—|--|–)\s+\S/.test(l)&&!/\s+-\s+\S/.test(l))return true;
        if(ACTION_START.test(l)&&!/:\s*\S/.test(l)&&!/(?:—|--|–)\s+\S/.test(l)&&!/\s+-\s+\S/.test(l))return true;
        return false;
    }

    /* ── PHASE 4: clean dialogue text ─────────────────────── */
    function cleanDlg(t){
        if(!t)return'';
        t=t.replace(/\s*\((?:walks?(?:\s+\w+)?|runs?(?:\s+\w+)?|laughs?|cries?\b|sighs?|pauses?|softly|angrily|quietly|loudly|whispers?|shouts?|nervously|sadly|happily|slowly|quickly|gently|firmly|enters?|exits?|stands?\s+up|sits?\s+down)[^)]{0,60}\)/gi,'');
        t=t.replace(/^\s*\([^)]{1,80}\)\s+/,'');
        if(/[^\x00-\x7F]/.test(t)){
            t=t.replace(/\s*\(([^)]{5,120})\)\s*$/,function(m,inner){
                return /[^\x00-\x7F]/.test(inner)?m:'';
            });
        }
        t=t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'').replace(/[\u2600-\u27BF]/g,'');
        t=t.replace(/\[[^\]]*\]/g,'');
        return t.replace(/\s+/g,' ').trim();
    }

    /* ── PHASE 1: find where dialogue starts ──────────────── */
    var HDR_PATS=[
        /^\[([^\]]{1,60})\]:\s*\S/,
        /^\(([^)]{1,50})\):\s*\S/,
        /^([A-Za-z\u00C0-\u024F][^:\n]{0,60}?):\s*\S/,
        /^([A-Za-z\u00C0-\u024F][^\n]{0,50}?)\s+(?:—|--)\s+\S/,
        /^([A-Za-z\u00C0-\u024F][^\n]{0,50}?)\s+–\s+\S/,
        /^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'()]{0,40}?)\s+-\s+\S/,
    ];
    var dialogueStart=0;
    hdrLoop:for(var hi=0;hi<allLines.length;hi++){
        var hl=(allLines[hi]||'').trim();
        if(!hl)continue;
        for(var hpi=0;hpi<HDR_PATS.length;hpi++){
            var hm=hl.match(HDR_PATS[hpi]);
            if(hm){
                var hRole=cleanRole(hm[1]||'');
                if(!hRole||isValidRole(hRole)){dialogueStart=hi;break hdrLoop;}
            }
        }
    }
    var lines=allLines.slice(dialogueStart);

    /* ── PHASE 3: extraction patterns (spec order) ─────────── */
    var EXTRACT=[
        {rx:/^\[([^\]]{1,60})\]:\s*(.+)$/},
        {rx:/^\(([^)]{1,50})\):\s*(.+)$/},
        {rx:/^([A-Za-z\u00C0-\u024F][^:\n]{2,60}?(?:\s*\([^)\n]{1,40}\))?)\s*:\s*(\S.+)$/},
        {rx:/^([^:\[\]()*\n]{1,55}):\s*(\S.+)$/},
        {rx:/^([A-Za-z\u00C0-\u024F][^\n]{0,44}?)\s+(?:—|--)\s+(\S.+)$/, mw:5},
        {rx:/^([A-Za-z\u00C0-\u024F][^\n]{0,44}?)\s+–\s+(\S.+)$/, mw:5},
        {rx:/^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'()]{0,38}?)\s+-\s+(\S.+)$/, mw:5},
        {rx:/^([^|\n]{1,48})\|\s*(\S.+)$/, mw:5},
        {rx:/^([A-Za-z\u00C0-\u024F][^\u2192\n]{0,44})\s*(?:\u2192|->)\s*(\S.+)$/, mw:5},
    ];

    /* ── PHASE 2 + 3: iterate post-header lines ───────────── */
    var result=[];
    for(var i=0;i<lines.length;i++){
        var raw=(lines[i]||'').trim();
        if(!raw)continue;
        if(shouldSkipLine(raw))continue;
        var found=false;
        for(var pi=0;pi<EXTRACT.length;pi++){
            var m=raw.match(EXTRACT[pi].rx);
            if(!m)continue;
            var role=cleanRole(m[1]);
            var dlg=cleanDlg(m[2]);
            if(!role||!dlg)continue;
            if(EXTRACT[pi].mw){
                var base=role.replace(/\s*\([^)]*\)\s*$/,'');
                if(base.split(/\s+/).filter(Boolean).length>EXTRACT[pi].mw)continue;
            }
            if(!isValidRole(role))continue;
            result.push({role:role,text:dlg});
            found=true;
            break;
        }
    }

    /* ── PHASE 5: merge aliased / duplicate role names ────── */
    function mergeRoles(arr){
        if(!arr||arr.length<2)return arr;
        var roleList=[],seen={};
        arr.forEach(function(l){var r=(l.role||'').trim();if(r&&!seen[r]){seen[r]=true;roleList.push(r);}});
        var map={};
        roleList.forEach(function(rLong){
            var inner=(rLong.match(/\(([^)]{1,40})\)\s*$/)||[])[1];
            if(!inner)return;
            var ik=inner.trim().toLowerCase();
            roleList.forEach(function(rShort){
                if(rShort!==rLong&&rShort.toLowerCase()===ik&&!map[rShort])map[rShort]=rLong;
            });
        });
        var normMap={};
        roleList.forEach(function(r){
            var k=r.replace(/\s+/g,'').toLowerCase();
            if(!normMap[k])normMap[k]=r.replace(/\s+/g,' ').trim();
        });
        roleList.forEach(function(r){
            var k=r.replace(/\s+/g,'').toLowerCase();
            var can=normMap[k];
            if(can&&can!==r&&!map[r])map[r]=can;
        });
        if(!Object.keys(map).length)return arr;
        return arr.map(function(l){var r=(l.role||'').trim();return{role:map[r]||r,text:l.text};});
    }

    return mergeRoles(result);
}
function parseScript(text){
    if(!text)return[];
    /* Fast path: primary [Name]: text format */
    var lines=[],m;
    var rx=/^\[([^\]]+)\]:\s*(.+)$/gm;
    while((m=rx.exec(text))!==null){
        var r=m[1].trim(),t=m[2].trim();
        if(r&&t)lines.push({role:r,text:t});
    }
    if(lines.length)return lines;
    /* Fall back to comprehensive detection */
    return _extractDialogueLines(text);
}

function localAutoDetectLines(rawText){
    return _extractDialogueLines(rawText||'');
}

function formatDetectedLines(lines){
    var out=[];
    for(var i=0;i<lines.length;i++){
        var role=(lines[i].role||'Speaker').trim();
        var txt=(lines[i].text||'').trim();
        if(!txt)continue;
        out.push('['+role+']: '+txt);
    }
    return out.join('\n');
}

/* ─────────────────────────────────────────────────────────────────
   validateParsedLines — verify output meets minimum criteria.
   Returns { ok: bool, error: string|null }.
───────────────────────────────────────────────────────────────── */
function validateParsedLines(lines){
    if(!lines||!lines.length)
        return{ok:false,error:'No dialogue lines could be detected.'};
    var valid=lines.filter(function(l){return l&&(l.role||'').trim()&&(l.text||'').trim();});
    if(valid.length<3)
        return{ok:false,error:'Too few dialogue lines found ('+valid.length+' found, need at least 3).'};
    var seen={};
    valid.forEach(function(l){seen[(l.role||'').toLowerCase().trim()]=true;});
    var uniq=Object.keys(seen).length;
    if(uniq<2)
        return{ok:false,error:'Only one character detected (“'+Object.keys(seen)[0]+'”). Need at least 2 unique characters.'};
    return{ok:true,error:null};
}

function applyAutoDetectedLines(lines,sourceLabel){
    var btn=$('auto-detect-btn');
    var status=$('parse-status');
    btn.disabled=false;

    var check=validateParsedLines(lines);
    if(!check.ok){
        status.innerHTML='<span class="text-coral-400"><i class="fas fa-triangle-exclamation mr-1"></i>'+check.error+'</span>';
        toast(check.error,'error');
        return;
    }

    $('script-input').value=formatDetectedLines(lines);
    updateParse();

    if(S.lines.length===0){
        status.innerHTML='<span class="text-coral-400"><i class="fas fa-triangle-exclamation mr-1"></i>Detected text but it could not be parsed.</span>';
        toast('Detected text could not be parsed as dialogue.','error');
        return;
    }

    status.innerHTML='';
    toast((sourceLabel||'Auto-detect')+': '+S.lines.length+' lines with '+S.roles.length+' character(s).','success');
}

/* ═══════════════════════════════════════════════════════════════
   TEST API CONNECTION
    Quick test: sends a tiny request to your configured app proxy to verify it works.
═══════════════════════════════════════════════════════════════ */

var _autoDetectTipShown=false;
function dismissAutoDetectTip(){
    _autoDetectTipShown=true;
    var tip=$('auto-detect-tip');
    if(tip)tip.classList.add('hidden');
    /* Re-enable button and run local detect now */
    var text=$('script-input').value.trim();
    if(text){
        $('parse-status').innerHTML='<span class="text-copper-400"><i class="fas fa-spinner fa-spin mr-1"></i>Analyzing locally...</span>';
        applyAutoDetectedLines(localAutoDetectLines(text),'Local detect');
    }
}
function autoDetectScript(){
    var text=$('script-input').value.trim();
    if(!text){toast('Paste text first.','info');return}
    $('auto-detect-btn').disabled=true;
    if(!S.aiConnected){
        if(!_autoDetectTipShown){
            var tip=$('auto-detect-tip');
            if(tip){tip.classList.remove('hidden');$('auto-detect-btn').disabled=false;return;}
        }
        $('parse-status').innerHTML='<span class="text-copper-400"><i class="fas fa-spinner fa-spin mr-1"></i>Analyzing locally...</span>';
        applyAutoDetectedLines(localAutoDetectLines(text),'Local detect');
        return;
    }

    $('parse-status').innerHTML='<span class="text-copper-400"><i class="fas fa-spinner fa-spin mr-1"></i>Analyzing with AI...</span>';
    /* Use high max_tokens — long scripts can have 30+ dialogue lines */
    callAI([
        {role:'system',content:'You are a script parser. Extract ALL spoken dialogue from the given text into this EXACT format:\n\n[CharacterName]: dialogue text\n\nCritical rules:\n- Use the actual character names from the script (e.g. "Mom (Jen)", "Older Brother 2 (Arjun)")\n- If the name has a parenthetical actor name like "Name (Actor)", keep the FULL thing including parentheses\n- Include ALL dialogue lines in order — do not skip any\n- Remove ALL stage directions, narration, scene descriptions, action notes, prop lists, and costume descriptions\n- Remove any English translations in parentheses at the end of non-English lines ONLY if the line is primarily in another language\n- Keep the dialogue in its ORIGINAL language (do not translate)\n- Do NOT add line numbers, bullet points, or any extra formatting\n- Do NOT include any intro text, explanations, or summary — ONLY the formatted dialogue lines\n- Each line MUST start with [ and end with the dialogue text. No blank lines between entries.\n- If a line has both a foreign language and English translation like "Spanish text (English translation)", keep ONLY the foreign language part'},
        {role:'user',content:text}
    ],4096).then(function(r){
        var clean=r.trim();
        /* Strip markdown code blocks if the AI wrapped the output in them */
        clean=clean.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
        /* Strip any leading/trailing non-bracket lines */
        var lines=clean.split('\n');
        var firstBracket=-1,lastBracket=-1;
        for(var fi=0;fi<lines.length;fi++){
            if(/^\[/.test(lines[fi].trim())){firstBracket=fi;break}
        }
        for(var li=lines.length-1;li>=0;li--){
            if(/\]/.test(lines[li])){lastBracket=li;break}
        }
        if(firstBracket>=0&&lastBracket>firstBracket){
            clean=lines.slice(firstBracket,lastBracket+1).join('\n');
        }
        var aiLines=parseScript(clean);
        if(aiLines.length){
            applyAutoDetectedLines(aiLines,'AI detect');
            return;
        }
        applyAutoDetectedLines(localAutoDetectLines(text),'AI fallback to local');
    }).catch(function(e){
        applyAutoDetectedLines(localAutoDetectLines(text),'AI failed, local detect');
        var errMsg=e.message||'Unknown error';
        if(errMsg.indexOf('Invalid API key')!==-1){
            toast('AI key issue detected. Used local auto-detect instead.','info');
        }else{
            toast('AI auto-detect failed. Used local detection: '+errMsg,'info');
        }
        /* Also log to console for debugging */
        console.error('Auto-detect error:',e);
    });
}

/* ═══════════════════════════════════════════════════════════════
   TTS
═══════════════════════════════════════════════════════════════ */
