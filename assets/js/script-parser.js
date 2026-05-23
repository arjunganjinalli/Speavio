/* ─────────────────────────────────────────────────────────────────
   cleanScript — sanitise raw pasted text before dialogue parsing.
   Strips HTML, normalises quotes/dashes, collapses excess blank
   lines, and removes page numbers, scene headings, standalone
   stage directions, and asterisked action lines.
───────────────────────────────────────────────────────────────── */
function cleanScript(rawText){
    if(!rawText)return'';

    /* 1 ── Strip HTML tags & decode common entities ─────────── */
    var text=rawText
        .replace(/<[^>]+>/g,' ')
        .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
        .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");

    /* 2 ── Normalise line endings (tabs preserved — used as separators) ─ */
    text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');

    /* 3 ── Normalise quote & dash characters ────────────────── */
    text=text
        .replace(/[\u2018\u2019]/g,"'")                          /* smart single quotes → ' */
        .replace(/[\u201C\u201D\u00AB\u00BB\u2039\u203A]/g,'"')  /* smart double / guillemets → " */
        .replace(/\u2014|\u2013/g,'--');                         /* em/en dash → -- */

    /* 4 ── Line-level removals ───────────────────────────────── */
    var lines=text.split('\n');
    var out=[];
    var blankRun=0;

    for(var i=0;i<lines.length;i++){
        var trimmed=lines[i].trim();

        /* Collapse 3+ consecutive blank lines into at most 2 */
        if(!trimmed){
            blankRun++;
            if(blankRun<=2)out.push('');
            continue;
        }
        blankRun=0;

        /* Standalone page numbers — digits (and optional dot) only */
        if(/^\d+\.?\s*$/.test(trimmed))continue;

        /* Scene headings — INT. / EXT. sluglines */
        if(/^(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\s/i.test(trimmed))continue;

        /* Transition lines — FADE IN/OUT, CUT TO, DISSOLVE, etc. */
        if(/^(?:FADE\s+(?:IN|OUT|TO)|CUT\s+TO|SMASH\s+CUT|MATCH\s+CUT|DISSOLVE\s+TO)\b[:.!]?\s*$/i.test(trimmed))continue;

        /* ACT / SCENE headings (short — 4 words or fewer) */
        if(/^(?:ACT|SCENE)\s+(?:[IVX]+|\d+)\b/i.test(trimmed)&&trimmed.split(/\s+/).length<=4)continue;

        /* Stage directions that occupy their own line — (…) or […] */
        if(/^\([^)]*\)$/.test(trimmed))continue;
        if(/^\[[^\]]*\]$/.test(trimmed))continue;

        /* Asterisked action lines:
             *action text*   or   **action text**  (whole line wrapped)
             * bullet action line  (leading asterisk + space) */
        if(/^\*[^*].*\*$/.test(trimmed))continue;       /* *…*   whole-line wrap */
        if(/^\*\*[^*].*\*\*$/.test(trimmed))continue;   /* **…** whole-line wrap */
        if(/^\*\s/.test(trimmed))continue;               /* * bullet-style action */

        out.push(lines[i]);
    }

    return out.join('\n');
}

/* ─────────────────────────────────────────────────────────────────
   _extractDialogueLines — comprehensive multi-format parser
   Handles 13 role/line formats, HTML input, stage directions,
   multi-line screenplay blocks, and all other messy input.
   Private — call via parseScript() or localAutoDetectLines().
───────────────────────────────────────────────────────────────── */
function _extractDialogueLines(rawText){
    if(!rawText)return[];

    /* 1 ── Pre-process (clean then split) ───────────────────────── */
    var text=cleanScript(rawText);

    var rawLines=text.split('\n');

    /* 2 ── Helpers ─────────────────────────────────────────────── */
    /* Prefixes that mark script-structure labels, not character names */
    var SKIP_ROLE=/^(scene\b|act\b|stage\s*dir|note\b|setting\b|narrator\b|chapter\b|pg\b|page\b|director\b|int\b|ext\b|fade\b|cut\b|transition\b|music\b|sfx\b|camera\b|direction\b|prologue\b|epilogue\b|chorus\b|the\s+end\b|fin\b|end\b)/i;
    var SCENE_HDG=/^(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)[\s.]/i;

    function cleanRole(r){
        r=r.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
        r=r.replace(/__([^_]+)__/g,'$1').replace(/_([^_]+)_/g,'$1');
        r=r.replace(/\s*\((?:CONT'?D|O\.S\.|V\.O\.|O\.C\.|off-?stage|offstage)\s*\)\s*$/i,'');
        return r.replace(/\s+/g,' ').trim();
    }
    function cleanDlg(t){
        t=t.replace(/\[[^\]]*\]/g,'');
        t=t.replace(/\*[^*]+\*/g,'');
        t=t.replace(/^\s*\([^)]{1,80}\)\s+/,'');
        t=t.replace(/^["'](.+)["']$/,'$1');
        return t.replace(/\s+/g,' ').trim();
    }
    /* Common honorific/title prefixes that lead a name — count as one word each */
    var TITLE_PFX=/^(?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Rev|Cpl|Sgt|Lt|Capt|Col|Gen|Pvt|Det|Ofc)\.?\s/i;
    function isValidRole(r){
        if(!r||r.length>65||r.length<2)return false;
        if(/^\d+$/.test(r))return false;
        if(SKIP_ROLE.test(r))return false;
        if(SCENE_HDG.test(r))return false;
        /* Accept letters from Latin, Greek, Cyrillic, Hebrew, Arabic, CJK, Hangul, Kana */
        if(!/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(r))return false;
        /* 1-4 words max; strip a leading title so it doesn't inflate the count */
        var forCount=TITLE_PFX.test(r)?r.replace(TITLE_PFX,''):r;
        if(forCount.split(/\s+/).filter(Boolean).length>4)return false;
        return true;
    }
    function isSkipLine(l){
        if(!l)return true;
        if(/^\s*\d+\.?\s*$/.test(l))return true;
        if(/^(ACT|SCENE|CHAPTER)\s+[IVX\d]/i.test(l)&&l.split(' ').length<=4)return true;
        if(SCENE_HDG.test(l))return true;
        if(/^\s*\*[^*]+\*\s*$/.test(l))return true;
        if(/^\s*_[^_]+_\s*$/.test(l))return true;
        return false;
    }

    /* 3 ── Section A: inline formats (role + dialogue on same line) ── */

    /* All separator patterns ordered from most-specific to least-specific.
       Properties:
         rx  — regex with two capture groups: (role, dialogue)
         mw  — optional max word count for role (guards ambiguous separators)
         np  — if true, role must not end with sentence-ending punctuation      */
    var SEP=[
        /* Explicitly-delimited name containers — highest confidence */
        {id:'bracket',    rx:/^\[([^\]]{1,60})\]:\s*(.+)$/},
        {id:'paren',      rx:/^\(([^)]{1,50})\):\s*(.+)$/},
        {id:'quotedname', rx:/^["']([^"'\n]{1,50})["']:\s*(.+)$/},
        {id:'bold',       rx:/^\*{1,2}([^*]{1,50})\*{1,2}:\s*(.+)$/},
        /* Unambiguous non-colon separators */
        {id:'dcolon',     rx:/^([^:\t\n]{1,55})::\s*(.+)$/},
        {id:'tab',        rx:/^([^\t\n]{1,55})\t(.+)$/},
        {id:'arrow',      rx:/^([A-Za-z\u00C0-\u024F][^\u2192\n]{0,44})\s*(?:\u2192|->)\s*(.+)$/, mw:5},
        {id:'pipe',       rx:/^([^|\n]{1,48})\|\s*(.+)$/},
        {id:'tilde',      rx:/^([^~\n]{1,48})~\s*(.+)$/, mw:5},
        {id:'equals',     rx:/^([^=\n]{1,48})\s+=\s+(.+)$/, mw:5},
        {id:'gt',         rx:/^([^>\n]{1,48})>\s*(.+)$/, mw:4},
        {id:'slash',      rx:/^([A-Za-z\u00C0-\u024F][^/\n]{0,42}[A-Za-z\u00C0-\u024F0-9)]?)\s+\/\s+(.+)$/, mw:5},
        /* Dash variants (em/en dashes already normalised to -- by cleanScript) */
        {id:'emdash',     rx:/^([A-Za-z\u00C0-\u024F][^\n]{0,44}?)\s+--\s+(.+)$/, mw:5, np:true},
        {id:'dash',       rx:/^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'()]{0,38}[A-Za-z\u00C0-\u024F0-9)]?)\s+-\s+(.+)$/, mw:5, np:true},
        /* Plain colon — least specific, catches all remaining Name: text */
        {id:'colon',      rx:/^([^:\[\]|*\n]{1,55}):\s*(.+)$/}
    ];

    /* Score: count lines where each pattern matches with a valid role.
       Only the FIRST matching pattern per line is counted (no double-scoring). */
    var sepScore={};
    for(var pi=0;pi<SEP.length;pi++)sepScore[SEP[pi].id]=0;
    for(var i=0;i<rawLines.length;i++){
        var sl=(rawLines[i]||'').trim();
        if(!sl||isSkipLine(sl))continue;
        for(var pi=0;pi<SEP.length;pi++){
            var sm=sl.match(SEP[pi].rx);
            if(sm){
                var sr=cleanRole(sm[1]);
                var swOk=!SEP[pi].mw||sr.split(/\s+/).length<=SEP[pi].mw;
                var spOk=!SEP[pi].np||!/[.!?]$/.test(sr);
                if(isValidRole(sr)&&swOk&&spOk){sepScore[SEP[pi].id]++;break;}
            }
        }
    }

    /* Sort: dominant (highest score) first; ties preserve original specificity order */
    var ranked=SEP.slice().sort(function(a,b){
        var d=(sepScore[b.id]||0)-(sepScore[a.id]||0);
        return d!==0?d:SEP.indexOf(a)-SEP.indexOf(b);
    });

    /* Parse every line — dominant separator first, all others as fallback */
    var inlineOut=[];
    for(var i=0;i<rawLines.length;i++){
        var raw=(rawLines[i]||'').trim();
        if(!raw||isSkipLine(raw))continue;
        var role,txt,m,matched=false;

        /* Try all separator patterns in dominant-first ranked order */
        for(var pi=0;pi<ranked.length;pi++){
            m=raw.match(ranked[pi].rx);
            if(m){
                role=cleanRole(m[1]);txt=cleanDlg(m[2]);
                var wOk=!ranked[pi].mw||role.split(/\s+/).length<=ranked[pi].mw;
                var pOk=!ranked[pi].np||!/[.!?]$/.test(role);
                if(isValidRole(role)&&wOk&&pOk&&txt){
                    /* Collect wrapped continuation lines (no separator on subsequent lines) */
                    var j=i+1;
                    while(j<rawLines.length){
                        var cLine=(rawLines[j]||'').trim();
                        if(!cLine||isSkipLine(cLine))break;
                        var isNewEntry=false;
                        for(var cpi=0;cpi<ranked.length;cpi++){
                            var cm=cLine.match(ranked[cpi].rx);
                            if(cm){var cr=cleanRole(cm[1]);var cwOk=!ranked[cpi].mw||cr.split(/\s+/).length<=ranked[cpi].mw;var cpOk=!ranked[cpi].np||!/[.!?]$/.test(cr);if(isValidRole(cr)&&cwOk&&cpOk){isNewEntry=true;break;}}
                        }
                        if(isNewEntry)break;
                        txt+=' '+cLine;j++;
                    }
                    i=j-1;
                    inlineOut.push({role:role,text:cleanDlg(txt)});matched=true;break;
                }
            }
        }
        if(matched)continue;

        /* Attribution formats — no leading separator */

        /* Name said/asked/replied/... text */
        m=raw.match(/^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'(),\-]{0,42}?)\s+(?:said|says|asked|replied|answered|shouted|whispered|muttered|exclaimed|continued|added|insisted|pleaded|cried|called|announced|declared|responded)\s*[,:]?\s*["']?(.{2,})["']?$/i);
        if(m){role=cleanRole(m[1]);txt=cleanDlg(m[2]).replace(/^["'](.+)["']$/,'$1').trim();if(isValidRole(role)&&txt){inlineOut.push({role:role,text:txt});continue;}}

        /* "dialogue" -- Name  (end attribution with dash) */
        m=raw.match(/^["\u201C](.*)["\u201D]\.?\s*(?:--|\u2014|\u2013)\s*([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .']{0,38})$/);
        if(m){txt=cleanDlg(m[1]);role=cleanRole(m[2]);if(isValidRole(role)&&txt&&txt.length>2){inlineOut.push({role:role,text:txt});continue;}}

        /* text (Name) — end attribution in parens */
        m=raw.match(/^(.{5,})\s+\(([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .']{1,38})\)\s*$/);
        if(m&&!/^\(/.test(raw)&&!/^(?:O\.S\.|V\.O\.|O\.C\.|CONT'?D|offstage|off-?stage)$/i.test(m[2].trim())){
            txt=cleanDlg(m[1]);role=cleanRole(m[2]);if(isValidRole(role)&&txt){inlineOut.push({role:role,text:txt});continue;}
        }
    }
    if(inlineOut.length>=2)return inlineOut;

    /* 4 ── Section B: block format (NAME alone on a line, dialogue below) ── */
    /* Handles ALL CAPS (screenplay), title-case, or any-case names.
       Pass 0: pre-count short standalone lines so mixed-case names
       require ≥2 appearances before being accepted as characters —
       this prevents false positives from regular short sentences.     */
    var nameFreq={};
    for(var ni=0;ni<rawLines.length;ni++){
        var nRaw=(rawLines[ni]||'').trim();
        if(!nRaw||isSkipLine(nRaw))continue;
        if(nRaw.split(/\s+/).filter(Boolean).length<=3&&
           !SCENE_HDG.test(nRaw)&&!SKIP_ROLE.test(nRaw)){
            var nCleanKey=cleanRole(nRaw);
            if(isValidRole(nCleanKey))
                nameFreq[nCleanKey.toLowerCase()]=(nameFreq[nCleanKey.toLowerCase()]||0)+1;
        }
    }

    var screenOut=[];
    var si=0;
    while(si<rawLines.length){
        var sRaw=(rawLines[si]||'').trim();
        if(!sRaw||isSkipLine(sRaw)){si++;continue;}

        var sClean=cleanRole(sRaw);
        /* ALL-CAPS name: structurally unambiguous — no repetition guard needed */
        var sIsAllCaps=(
            /^[A-Z\u00C0-\u00D6\u00D8-\u00DE][A-Z\u00C0-\u00D6\u00D8-\u00DE0-9 '.\-]{0,44}(?:\s*\([^)]{1,40}\))?$/.test(sRaw)&&
            sRaw.replace(/\s*\([^)]*\)$/,'').split(/\s+/).length<=6
        );
        /* Mixed-case name: ≤3 words AND must appear ≥2 times as a standalone line */
        var sIsMixed=(
            !sIsAllCaps&&
            sRaw.split(/\s+/).filter(Boolean).length<=3&&
            (nameFreq[sClean.toLowerCase()]||0)>=2
        );
        var isCharLine=(
            (sIsAllCaps||sIsMixed)&&
            !SCENE_HDG.test(sRaw)&&
            !SKIP_ROLE.test(sRaw)&&
            !/^(?:ACT|SCENE|CHAPTER|INT|EXT|FADE|CUT|THE END)[\s.]/.test(sRaw)&&
            isValidRole(sClean)
        );

        if(isCharLine){
            var dlgParts=[];
            var sk=si+1;
            while(sk<rawLines.length){
                var n=(rawLines[sk]||'').trim();
                if(!n){if(dlgParts.length)break;sk++;continue;}
                /* Stop at the next character name — ALL CAPS or a known mixed-case name */
                var nC=cleanRole(n);
                var nAllCaps=/^[A-Z\u00C0-\u00D6\u00D8-\u00DE][A-Z\u00C0-\u00D6\u00D8-\u00DE0-9 '.\-]{0,44}(?:\s*\([^)]{1,40}\))?$/.test(n);
                var nMixed=!nAllCaps&&n.split(/\s+/).filter(Boolean).length<=3&&
                            (nameFreq[nC.toLowerCase()]||0)>=2&&isValidRole(nC);
                if((nAllCaps||nMixed)&&!SCENE_HDG.test(n)&&!SKIP_ROLE.test(n))break;
                if(SCENE_HDG.test(n)||isSkipLine(n))break;
                if(/^\([^)]{1,80}\)$/.test(n)||/^\[[^\]]+\]$/.test(n)){sk++;continue;}
                dlgParts.push(n);
                sk++;
            }
            if(dlgParts.length){
                var stxt=cleanDlg(dlgParts.join(' '));
                if(stxt)screenOut.push({role:sClean,text:stxt});
                si=sk;continue;
            }
        }
        si++;
    }
    if(screenOut.length>=2)return screenOut;

    /* 5 ── Section C: quoted speech fallback ───────────────── */
    /* Last resort: extract "quoted text" and attribute to nearby speaker names.
       Unattributed quotes alternate between Speaker 1 and Speaker 2.            */
    if(inlineOut.length<2&&screenOut.length<2){
        var qOut=[];
        var anonIdx=0;
        var ANON=['Speaker 1','Speaker 2'];
        var qLines=text.split('\n');
        for(var qi=0;qi<qLines.length;qi++){
            var qLine=(qLines[qi]||'').trim();
            if(!qLine||isSkipLine(qLine))continue;
            var qRx=/"([^"]{2,300})"/g;
            var qm;
            while((qm=qRx.exec(qLine))!==null){
                var qTxt=cleanDlg(qm[1]);
                if(!qTxt||qTxt.split(/\s+/).length<2)continue;
                var qRole=null;
                /* Before attribution: Name: "..." or Name "..." */
                var qBefore=qLine.slice(0,qm.index).replace(/[\s:,.\-]+$/,'').trim();
                if(qBefore){var qrb=cleanRole(qBefore);if(isValidRole(qrb))qRole=qrb;}
                /* After attribution: "..." -- Name */
                if(!qRole){
                    var qAfter=qLine.slice(qm.index+qm[0].length).replace(/^[\s,.\-]+/,'').trim();
                    var qam=qAfter.match(/^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'\-]{0,35})[\s.,]*$/);
                    if(qam){var qra=cleanRole(qam[1]);if(isValidRole(qra))qRole=qra;}
                }
                /* After attribution: "...", said Name */
                if(!qRole){
                    var qAfter2=qLine.slice(qm.index+qm[0].length);
                    var qam2=qAfter2.match(/,?\s*(?:said|asked|replied|whispered|shouted|muttered|exclaimed)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'\-]{1,35})/i);
                    if(qam2){var qra2=cleanRole(qam2[1]);if(isValidRole(qra2))qRole=qra2;}
                }
                if(!qRole){qRole=ANON[anonIdx%2];anonIdx++;}
                qOut.push({role:qRole,text:qTxt});
            }
        }
        if(qOut.length>=2)return qOut;
    }

    /* 6 ── Return whichever gave more results ───────────────── */
    return inlineOut.length>=screenOut.length?inlineOut:screenOut;
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

function autoDetectScript(){
    var text=$('script-input').value.trim();
    if(!text){toast('Paste text first.','info');return}
    $('auto-detect-btn').disabled=true;
    if(!S.apiKey){
        $('parse-status').innerHTML='<span class="text-copper-400"><i class="fas fa-spinner fa-spin mr-1"></i>Analyzing locally...</span>';
        applyAutoDetectedLines(localAutoDetectLines(text),'Local detect');
        return;
    }

    $('parse-status').innerHTML='<span class="text-copper-400"><i class="fas fa-spinner fa-spin mr-1"></i>Analyzing with AI...</span>';
    /* Use high max_tokens — long scripts can have 30+ dialogue lines */
    callGLM([
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
