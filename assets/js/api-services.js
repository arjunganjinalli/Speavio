function getBasicEvaluation(expected,response,isPres){
    var wd=wordDiff(expected,response);
    var yes=wd.pct>=85?'yes':'no';
    var base={
        score:wd.pct,
        accuracy:'Local word match: '+wd.correct+'/'+wd.total+' words matched.',
        grammar:'Basic mode uses local comparison. Add API key for full grammar analysis.',
        fluency:'Basic mode does not run pronunciation/fluency AI.',
        corrections:wd.pct<80?['Practice the highlighted missing words in the report.']:[],
        encouragement:wd.pct>=80?'Strong response. Keep it up!':'Keep practicing, you are improving.',
        suggestions:wd.pct<80?['Use Hint Word or Hint Full for one round, then retry from memory.']:[]
    };
    base.correct_words=yes;
    return base;
}

/* ═══════════════════════════════════════════════════════════════
   ELEVENLABS
═══════════════════════════════════════════════════════════════ */
function fetchELVoices(){
    var key=$('el-key').value.trim();
    if(!key){toast('Enter ElevenLabs API key.','info');return}
    S.elevenlabsKey=key;
    var sel=$('el-voice-select');
    sel.innerHTML='<option value="">Loading...</option>';
    fetch((S.apiProxy||API_PROXY)+encodeURIComponent('https://api.elevenlabs.io/v1/voices'),{headers:{'xi-api-key':key}})
        .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
        .then(function(d){
            var h='';
            (d.voices||[]).forEach(function(v){h+='<option value="'+v.voice_id+'">'+esc(v.name)+'</option>'});
            sel.innerHTML=h||'<option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>';
            toast('Voices loaded.','success');
        })
        .catch(function(e){toast('Failed: '+e.message,'error');sel.innerHTML='<option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>';});
}

/* ═══════════════════════════════════════════════════════════════
   SCRIPT PARSING
═══════════════════════════════════════════════════════════════ */

function testAPIConnection(){
    var key=S.apiKey||($('api-key')?$('api-key').value.trim():'');
    if(!key){toast('Enter your API key first.','info');return}
    S.apiKey=key;
    var provider=S.aiProvider?AI_PROVIDERS[S.aiProvider]:null;
    var endpoint=(provider&&provider.endpoint)||S.apiEndpoint||'';
    var model=(provider&&provider.model)||S.apiModel||'';
    if(!provider||!endpoint||!model){toast('Select and configure a provider first.','info');return}

    var btn=$('test-api-btn');
    var statusEl=$('api-test-status');
    if(btn){btn.disabled=true;btn.innerHTML='<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></div><span class="ml-2">Testing scoring...</span>'}
    if(statusEl){statusEl.textContent='Testing a real scoring response...';statusEl.className='text-xs text-sf-300 min-h-[1rem]'}

    callAI([
        {role:'system',content:'You are a speech coach AI. Respond only in valid JSON.'},
        {role:'user',content:'Score this response. Expected: "Hello world". Student said: "Hello world". Return JSON: {"score":95,"accuracy":"Perfect match."}'}
    ],100).then(function(resp){
        var parsed=extractJSON(resp);
        if(!parsed||parsed.score==null||isNaN(Number(parsed.score)))throw new Error('Provider responded, but AI scoring JSON was invalid.');
        S.aiConnected=true;
        if(statusEl){statusEl.textContent='Connected — AI scoring is active';statusEl.className='text-xs text-sage-400 min-h-[1rem]'}
        refreshAdvancedState();
        toast('AI connected! Scoring is now active.','success');
    }).catch(function(err){
        S.aiConnected=false;
        var msg=err.message||'Connection failed';
        if(statusEl){statusEl.textContent='Connection failed: '+msg;statusEl.className='text-xs text-coral-400 min-h-[1rem]'}
        refreshAdvancedState();
        toast('Connection failed: '+msg,'error');
        console.error('API test error:',err);
    }).then(function(){
        if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-plug mr-2"></i>Test Connection'}
    });
}


function extractJSON(raw){
    if(!raw||typeof raw!=='string')return null;
    var text=raw.trim();
    /* 1) Try direct parse */
    try{return JSON.parse(text)}catch(e){}
    /* 2) Strip ```json ... ``` code blocks */
    var cb=text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(cb)try{return JSON.parse(cb[1].trim())}catch(e){}
    /* 3) Strip ``` ... ``` (no language tag) */
    var cb2=text.match(/```([\s\S]*?)```/);
    if(cb2)try{return JSON.parse(cb2[1].trim())}catch(e){}
    /* 4) Find outermost { ... } or [ ... ] */
    var brace=text.match(/\{[\s\S]*\}/);
    if(brace)try{return JSON.parse(brace[0])}catch(e){}
    var bracket=text.match(/\[[\s\S]*\]/);
    if(bracket)try{return JSON.parse(bracket[0])}catch(e){}
    /* 5) Strip leading conversational text ("Here is the evaluation:", etc.)
       and try to find JSON after the first { */
    var firstBrace=text.indexOf('{');
    if(firstBrace>0){
        var substr=text.substring(firstBrace);
        var subMatch=substr.match(/\{[\s\S]*\}/);
        if(subMatch)try{return JSON.parse(subMatch[0])}catch(e){}
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════
   callAI — Standard OpenAI-compatible API call
═══════════════════════════════════════════════════════════════ */
function callAI(msgs,maxTok){
    var tk=maxTok||800;
    var provider=S.aiProvider?AI_PROVIDERS[S.aiProvider]:null;
    var endpoint=(provider&&provider.endpoint)||S.apiEndpoint||'';
    var model=(provider&&provider.model)||S.apiModel||'';
    if(!S.apiKey)return Promise.reject(new Error('No API key set.'));
    if(!endpoint||!model)return Promise.reject(new Error('No provider selected or configured.'));

    var c=new AbortController(),t=setTimeout(function(){c.abort()},60000);
    return fetch(S.apiProxy||API_PROXY,{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'Authorization':'Bearer '+S.apiKey,
            'X-Target-Url':endpoint
        },
        body:JSON.stringify({model:model,messages:msgs,temperature:0.3,max_tokens:tk}),
        signal:c.signal
    }).then(function(r){
        clearTimeout(t);
        if(!r.ok)return r.text().then(function(b){
            if(b.trim().charAt(0)==='<')throw new Error('API proxy route not found. Verify App Proxy URL in Settings.');
            var errObj=extractJSON(b);
            if(errObj)throw new Error(errObj.error||errObj.message||('API error '+r.status));
            throw new Error('API error ('+r.status+'): '+b.slice(0,200));
        });
        return r.text();
    }).then(function(raw){
        if(!raw)throw new Error('Empty response from API.');
        return raw;
    }).catch(function(err){
        clearTimeout(t);
        throw err;
    });
}

function evalResponse(ctx,expected,response,isPres){
    if(!S.aiConnected)return Promise.resolve(getBasicEvaluation(expected,response,isPres));
    var ln=LANG[S.language].name;
    var cs=ctx.map(function(l){return l.role+': '+l.text}).join('\n');
    var scoringRules='\n\nIMPORTANT scoring rules:\n- Strip ALL punctuation (commas, periods, colons, semicolons, dashes, quotes, parentheses) before comparing words\n- People do NOT speak punctuation — ignore it entirely when scoring\n- Score based on WORD-LEVEL accuracy: correct_words / total_words × 100\n- If 9 of 10 words are correct, score ~90. Do NOT give 0 for one wrong word\n- Accept minor variations: a/an/the, contractions (don\'t/do not), slight word order differences\n- Be GENEROUS — the score should reward what they got RIGHT, not punish mistakes\n- Also include short delivery coaching for pace/volume in "delivery_notes" (e.g. "Speak slightly slower", "Project your voice more")';
    var sysPrompt=isPres
        ?'You are an expert '+ln+' pronunciation and dialogue coach. Evaluate a student reading a line. Respond ONLY with valid JSON — no markdown, no explanation outside JSON.'+scoringRules
        :'You are an expert '+ln+' dialogue coach. Evaluate a student\'s response. Respond ONLY with valid JSON — no markdown, no explanation outside JSON.'+scoringRules;
    var userPrompt=isPres
        ?'Context:\n'+cs+'\n\nExpected for "'+S.userRoles.join(' / ')+'": "'+expected+'"\nStudent said: "'+response+'"\n\nReturn JSON:\n{"score":<0-100>,"correct_words":"<yes or no>","pronunciation":"<1 sentence>","accuracy":"<1 sentence>","fluency":"<1 sentence>","corrections":["..."],"encouragement":"<positive>","suggestions":["..."],"delivery_notes":["..."]}'
        :'Context:\n'+cs+'\n\nExpected for "'+S.userRoles.join(' / ')+'": "'+expected+'"\nStudent said: "'+response+'"\n\nReturn JSON:\n{"score":<0-100>,"correct_words":"<yes or no>","accuracy":"<1 sentence>","grammar":"<1 sentence>","fluency":"<1 sentence>","corrections":["..."],"encouragement":"<positive>","suggestions":["..."],"delivery_notes":["..."]}';

    return callAI([{role:'system',content:sysPrompt},{role:'user',content:userPrompt}]).then(function(raw){
        var p=extractJSON(raw);
        if(p){
            /* Use local word diff as a sanity check — if AI is too harsh,
               blend with the word-level accuracy for a fairer score */
            var wdResult=wordDiff(expected,response);
            var aiScore=Math.min(100,Math.max(0,parseInt(p.score)||0));
            var wdScore=wdResult.pct;
            var finalScore=aiScore;
            /* If AI gives <50 but word match is >65, blend them */
            if(aiScore<50 && wdScore>65){finalScore=Math.round(aiScore*0.3+wdScore*0.7)}
            else if(aiScore<30 && wdScore>40){finalScore=Math.round(aiScore*0.4+wdScore*0.6)}
            var base={
                score:finalScore,
                accuracy:p.accuracy||'--',
                grammar:p.grammar||(p.pronunciation||'--'),
                fluency:p.fluency||'--',
                correct_words:p.correct_words||'--',
                corrections:Array.isArray(p.corrections)?p.corrections:[],
                encouragement:p.encouragement||'Keep practicing!',
                suggestions:Array.isArray(p.suggestions)?p.suggestions:[],
                deliveryNotes:Array.isArray(p.delivery_notes)?p.delivery_notes:[]
            };
            return base;
        }
        var fb={score:50,accuracy:'Parse error.',grammar:'--',fluency:'--',correct_words:'--',corrections:[],encouragement:raw.slice(0,200),suggestions:[],deliveryNotes:[]};
        return fb;
    });
}

/* ═══════════════════════════════════════════════════════════════
   SCREENS
═══════════════════════════════════════════════════════════════ */
