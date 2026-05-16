function parseScript(text){
    var lines=[],m;
    /* Pattern 1: [Name]: text (primary format) */
    var rx=/^\[([^\]]+)\]:\s*(.+)$/gm;
    while((m=rx.exec(text))!==null)lines.push({role:m[1].trim(),text:m[2].trim()});
    /* Pattern 2: Name: text (fallback — but skip common non-dialogue prefixes) */
    if(!lines.length){
        var skipPrefixes=/^(scene|act|stage direction|note|setting|narrator\s*:|\d+|chapter|pg|page|int\.|ext\.|fade|cut)/i;
        var rx2=/^([^:\[\]]+):\s*(.+)$/gm;
        while((m=rx2.exec(text))!==null){
            var roleName=m[1].trim();
            if(!skipPrefixes.test(roleName)&&roleName.length<40){
                lines.push({role:roleName,text:m[2].trim()});
            }
        }
    }
    /* Pattern 3: Name (uppercase only): text — common screenplay format */
    if(!lines.length){
        var rx3=/^([A-Z][A-Z\s]{1,25})\n([\s\S]+?)(?=\n[A-Z][A-Z\s]{1,25}\n|$)/gm;
        while((m=rx3.exec(text))!==null){
            var rn=m[1].trim();
            if(rn.indexOf('(')===-1)lines.push({role:rn,text:m[2].trim()});
        }
    }
    return lines;
}

function localAutoDetectLines(text){
    var parsed=parseScript(text||'');
    if(parsed.length)return parsed;

    var raw=(text||'').split(/\r?\n/);
    var out=[];
    var skip=/^(scene|act|note|setting|narrator|chapter|page|pg|int\.|ext\.|fade|cut|transition|music|sfx|camera|direction)\b/i;

    for(var i=0;i<raw.length;i++){
        var line=(raw[i]||'').trim();
        if(!line)continue;

        var m=line.match(/^([A-Za-z][A-Za-z0-9 .,'()\-]{0,48})\s*[:\-]\s*(.+)$/);
        if(m){
            var role=m[1].trim();
            var txt=m[2].trim();
            if(!skip.test(role)&&txt&&txt.length>1){
                out.push({role:role,text:txt});
                continue;
            }
        }

        var q=line.match(/^["“](.+)["”]$/);
        if(q&&q[1]&&q[1].trim().length>1){
            out.push({role:'Speaker',text:q[1].trim()});
        }
    }

    return out;
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

function applyAutoDetectedLines(lines,sourceLabel){
    var btn=$('auto-detect-btn');
    var status=$('parse-status');
    btn.disabled=false;

    if(!lines.length){
        status.innerHTML='<span class="text-coral-400"><i class="fas fa-triangle-exclamation mr-1"></i>No dialogue lines could be detected.</span>';
        toast('Auto-detect could not find valid dialogue lines.','error');
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
