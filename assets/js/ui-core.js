function applySystemLanguage(){
    document.documentElement.lang=S.systemLanguage;
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key=el.getAttribute('data-i18n');
        el.textContent=t(key);
    });
    showSetupTab(S.activeSetupTab||'home');
    refreshAdvancedState();
    refreshHomeProgressSnapshot();
    renderThemeControls();
}

function syncScriptLanguageSelects(){
    var lp=$('language-select-practice'),ls=$('language-select-presentation');
    if(lp)lp.value=S.language;
    if(ls)ls.value=S.language;
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function toast(msg,type){
    type=type||'info';
    var ic={success:'fa-circle-check',error:'fa-circle-exclamation',info:'fa-circle-info'};
    var t=document.createElement('div');
    t.className='toast toast-'+type;
    t.innerHTML='<i class="fas '+(ic[type]||ic.info)+'"></i><span>'+esc(msg)+'</span>';
    $('toast-container').appendChild(t);
    setTimeout(function(){
        t.style.animation='to2 .3s ease forwards';
        setTimeout(function(){t.remove()},300);
    },4000);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */
function toggleVis(iid,btn){
    var inp=$(iid),ic=btn.querySelector('i');
    if(inp.type==='password'){inp.type='text';ic.className='fas fa-eye-slash text-sm'}
    else{inp.type='password';ic.className='fas fa-eye text-sm'}
}
function toggleCollapse(id){
    var el=$(id),ar=$(id+'-arrow');
    el.classList.toggle('open');
    if(ar)ar.style.transform=el.classList.contains('open')?'rotate(180deg)':'';
}
function setTTSProvider(p){
    S.ttsProvider=p;
    $('tts-br-btn').className='flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all '+(p==='browser'?'bg-copper-500/15 border-copper-500/30 text-copper-400':'bg-white/3 border-white/8 text-sf-300 hover:text-sf-100');
    $('tts-el-btn').className='flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all '+(p==='elevenlabs'?'bg-copper-500/15 border-copper-500/30 text-copper-400':'bg-white/3 border-white/8 text-sf-300 hover:text-sf-100');
    $('el-settings').classList.toggle('hidden',p!=='elevenlabs');
}
function setHintLevel(level){
    S.hintLevel=level;
    renderAllHintPills();
    if(S.mode==='presentation'&&S.screen==='session')renderIA();
}
function renderAllHintPills(){
    document.querySelectorAll('[data-hl]').forEach(function(b){
        b.classList.toggle('active',b.dataset.hl===S.hintLevel);
    });
    document.querySelectorAll('.hint-opt').forEach(function(b){
        b.className='hint-opt flex-1 px-4 py-3 rounded-xl text-xs font-semibold border transition-all text-center '+(b.dataset.hl===S.hintLevel?'bg-copper-500/15 border-copper-500/30 text-copper-400':'bg-white/3 border-white/8 text-sf-300 hover:text-sf-100');
    });
}
function getHintText(text){
    if(S.hintLevel==='full')return text;
    if(S.hintLevel==='first'){
        var w=text.trim().split(/\s+/);
        return w[0]+(w.length>1?' •••':'');
    }
    return null; /* no hint */
}

function isPracticeLikeMode(){
    return S.mode==='practice'||S.mode==='assignment';
}

function showSetupTab(tab){
    S.activeSetupTab=tab;
    document.querySelectorAll('.setup-tab-btn').forEach(function(btn){
        var active=btn.dataset.tab===tab;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
    });
    $('panel-home').classList.toggle('active',tab==='home');
    $('panel-mode').classList.toggle('active',tab==='practice'||tab==='assignment'||tab==='presentation');
    $('panel-settings').classList.toggle('active',tab==='settings');

    if(tab==='practice'||tab==='assignment'||tab==='presentation'){
        S.mode=tab;
        var isPres=tab==='presentation';
        var isAssign=tab==='assignment';
        $('mode-title').textContent=isPres?t('modePresentationTitle'):(isAssign?t('modeAssignmentTitle'):t('modePracticeTitle'));
        $('mode-desc').textContent=isPres?t('modePresentationDesc'):(isAssign?t('modeAssignmentDesc'):t('modePracticeDesc'));
        $('mode-mini-badge').textContent=isPres?t('modePresentationBadge'):(isAssign?t('modeAssignmentBadge'):t('modePracticeBadge'));
        $('mode-mini-badge').className='px-2.5 py-1 rounded-md text-xs font-semibold '+(isPres?'bg-sage-500/15 text-sage-400':'bg-copper-500/15 text-copper-400');
        $('hint-settings').classList.toggle('hidden',!isPres);
        $('practice-script-language-wrap').classList.toggle('hidden',isPres);
        $('presentation-script-language-wrap').classList.toggle('hidden',!isPres);
        $('start-btn').textContent=isPres?t('startPresentation'):(isAssign?t('startAssignment'):t('startPractice'));
    }
    if(tab==='home')refreshHomeProgressSnapshot();
    if(tab==='practice'||tab==='assignment'||tab==='presentation')renderScriptLibraryOptions();
}

function refreshAdvancedState(){
    var hasKey=!!S.apiKey;
    var badge=$('advanced-badge');
    if(badge){
        badge.innerHTML=hasKey
            ?'<i class="fas fa-circle text-[8px] text-sage-400"></i><span>'+esc(t('advancedMode'))+'</span>'
            :'<i class="fas fa-circle text-[8px] text-coral-400"></i><span>'+esc(t('basicMode'))+'</span>';
    }
    var modeLbl=$('assist-mode-label');
    if(modeLbl)modeLbl.textContent=hasKey?t('assistantAdvanced'):t('assistantBasic');
}

function readStoreJSON(key,fallback){
    try{
        var raw=localStorage.getItem(key);
        if(!raw)return fallback;
        var parsed=JSON.parse(raw);
        return parsed==null?fallback:parsed;
    }catch(e){
        return fallback;
    }
}

function writeStoreJSON(key,val){
    try{localStorage.setItem(key,JSON.stringify(val))}catch(e){}
}

function getSavedSessions(){
    return readStoreJSON(STORAGE_KEYS.sessions,[]);
}

function getSavedScripts(){
    return readStoreJSON(STORAGE_KEYS.scripts,[]);
}

function getSavedBookmarks(){
    return readStoreJSON(STORAGE_KEYS.bookmarks,{});
}

function getSavedLeaderboard(){
    return readStoreJSON(STORAGE_KEYS.leaderboard,{});
}

function hashTextToKey(seed,prefix){
    var h=2166136261;
    for(var i=0;i<seed.length;i++){
        h^=seed.charCodeAt(i);
        h=Math.imul(h,16777619);
    }
    return (prefix||'k_')+(h>>>0).toString(36);
}

function getScriptKeyFromRawText(text,language){
    var seed=[language||'',String(text||'').trim()].join('||');
    return hashTextToKey(seed,'raw_');
}

function getLeaderboardScriptKey(){
    var scriptLines=(S.lines||[]).map(function(l){return (l.role||'')+':'+(l.text||'')}).join('\n');
    if(!scriptLines)return getScriptKeyFromRawText($('script-input')?$('script-input').value:'',S.language);
    return hashTextToKey([S.language||'',scriptLines].join('||'),'lb_');
}

function getCurrentScriptKey(){
    var scriptLines=(S.lines||[]).map(function(l){return (l.role||'')+':'+(l.text||'')}).join('\n');
    var seed=[S.language||'',S.userRole||'',scriptLines].join('||');
    var h=2166136261;
    for(var i=0;i<seed.length;i++){
        h^=seed.charCodeAt(i);
        h=Math.imul(h,16777619);
    }
    return 'sc_'+(h>>>0).toString(36);
}

function isBookmarkedLine(lineIndex,lineText){
    var all=getSavedBookmarks();
    var scriptKey=getCurrentScriptKey();
    var row=all[scriptKey]&&all[scriptKey][String(lineIndex)];
    if(!row)return false;
    if(lineText&&row.lineText&&row.lineText!==lineText)return false;
    return true;
}

function toggleBookmarkedLine(lineIndex,lineText,score){
    var all=getSavedBookmarks();
    var scriptKey=getCurrentScriptKey();
    var idx=String(lineIndex);
    if(!all[scriptKey])all[scriptKey]={};

    if(all[scriptKey][idx]){
        delete all[scriptKey][idx];
        if(!Object.keys(all[scriptKey]).length)delete all[scriptKey];
        writeStoreJSON(STORAGE_KEYS.bookmarks,all);
        return false;
    }

    all[scriptKey][idx]={
        lineText:lineText||'',
        score:typeof score==='number'?score:null,
        savedAt:new Date().toISOString()
    };
    writeStoreJSON(STORAGE_KEYS.bookmarks,all);
    return true;
}

function getBookmarkedLineCountForCurrentScript(){
    var all=getSavedBookmarks();
    var scriptKey=getCurrentScriptKey();
    return Object.keys(all[scriptKey]||{}).length;
}

function calcDailyStreak(sessions){
    if(!sessions||!sessions.length)return 0;
    var daySet={};
    sessions.forEach(function(s){
        var d=new Date(s.timestamp||Date.now());
        var key=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
        daySet[key]=true;
    });
    var streak=0;
    var cur=new Date();
    while(true){
        var k=cur.getFullYear()+'-'+(cur.getMonth()+1)+'-'+cur.getDate();
        if(daySet[k]){streak++;cur.setDate(cur.getDate()-1)}
        else break;
    }
    return streak;
}

function refreshHomeProgressSnapshot(){
    var sessions=getSavedSessions();
    var streakEl=$('home-streak'),lastEl=$('home-last-score'),countEl=$('home-history-count');
    if(!streakEl||!lastEl||!countEl)return;
    var last=sessions.length?sessions[sessions.length-1]:null;
    streakEl.textContent=String(calcDailyStreak(sessions));
    lastEl.textContent=String(last&&typeof last.avgScore==='number'?last.avgScore:0);
    countEl.textContent=String(sessions.length);
    renderHomeLeaderboard();
}

function renderSetupDifficultyBadge(){
    var el=$('setup-difficulty-badge');
    if(!el)return;
    var d=S.scriptDifficulty||{label:'Easy',score:0};
    el.innerHTML='<i class="fas fa-gauge-high"></i><span>Difficulty: '+esc(d.label)+' ('+d.score+')</span>';
}

function estimateScriptDifficulty(lines){
    if(!lines||!lines.length)return{score:0,label:'Easy',metrics:null};
    var words=[];
    lines.forEach(function(l){
        String(l.text||'').split(/\s+/).forEach(function(w){
            var clean=w.toLowerCase().replace(/[^a-z0-9]/g,'');
            if(clean)words.push(clean);
        });
    });
    if(!words.length)return{score:0,label:'Easy',metrics:null};
    var unique={};
    var longCount=0,totalChars=0;
    words.forEach(function(w){
        unique[w]=true;
        totalChars+=w.length;
        if(w.length>=8)longCount++;
    });
    var uniqueRatio=Object.keys(unique).length/words.length;
    var avgWordLen=totalChars/words.length;
    var avgWordsPerLine=words.length/lines.length;
    var score=Math.round(Math.min(100,
        avgWordsPerLine*2.8+
        avgWordLen*6+
        uniqueRatio*28+
        (longCount/words.length)*35
    ));
    var label=score>=75?'Hard':score>=50?'Medium':'Easy';
    return{
        score:score,
        label:label,
        metrics:{avgWordsPerLine:avgWordsPerLine,avgWordLen:avgWordLen,uniqueRatio:uniqueRatio}
    };
}

function saveCurrentScriptToLibrary(){
    var text=$('script-input').value.trim();
    if(!text){toast('Paste a script before saving.','info');return}
    var name=($('script-save-name').value||'').trim()||('Script '+new Date().toLocaleString());
    var list=getSavedScripts();
    list.push({
        id:String(Date.now()),
        name:name,
        text:text,
        savedAt:new Date().toISOString(),
        difficulty:S.scriptDifficulty
    });
    while(list.length>50)list.shift();
    writeStoreJSON(STORAGE_KEYS.scripts,list);
    S.scriptSource='library';
    S.scriptLabel=name;
    S.scriptRef=list[list.length-1].id;
    renderScriptLibraryOptions();
    $('script-save-name').value='';
    toast('Script saved to library.','success');
}

function renderScriptLibraryOptions(){
    var sel=$('script-library-select');
    if(!sel)return;
    var list=getSavedScripts();
    sel.innerHTML='<option value="">-- Load saved script --</option>'+
        list.map(function(s){
            var d=(s.difficulty&&s.difficulty.label)?' ['+s.difficulty.label+']':'';
            return '<option value="'+esc(s.id)+'">'+esc(s.name+d)+'</option>';
        }).join('');
}

function loadSelectedScriptFromLibrary(){
    var sel=$('script-library-select');
    if(!sel||!sel.value){toast('Select a saved script first.','info');return}
    var list=getSavedScripts();
    var match=null;
    for(var i=0;i<list.length;i++)if(list[i].id===sel.value){match=list[i];break}
    if(!match){toast('Saved script not found.','error');return}
    $('script-input').value=match.text||'';
    S.scriptSource='library';
    S.scriptLabel=match.name||'Library Script';
    S.scriptRef=match.id||'';
    updateParse();
    toast('Loaded saved script.','success');
}

function deleteSelectedScriptFromLibrary(){
    var sel=$('script-library-select');
    if(!sel||!sel.value){toast('Select a saved script first.','info');return}
    var id=sel.value;
    var list=getSavedScripts().filter(function(s){return s.id!==id});
    writeStoreJSON(STORAGE_KEYS.scripts,list);
    renderScriptLibraryOptions();
    toast('Saved script removed.','success');
}

function encodeAssignmentPayload(payload){
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function decodeAssignmentPayload(encoded){
    var b64=String(encoded||'').replace(/-/g,'+').replace(/_/g,'/');
    var pad=b64.length%4;
    if(pad)b64+=new Array(5-pad).join('=');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

function createAssignmentLink(){
    var scriptText=($('script-input').value||'').trim();
    if(!scriptText){toast('Paste a script first.','info');return ''}
    var payload={
        v:1,
        mode:'assignment',
        language:S.language,
        scriptKey:getScriptKeyFromRawText(scriptText,S.language),
        script:scriptText,
        createdAt:new Date().toISOString()
    };
    var token=encodeAssignmentPayload(payload);
    var url=window.location.origin+window.location.pathname+'?assignment='+encodeURIComponent(token);
    if(url.length>1900){
        var localToken='asg_'+Date.now().toString(36);
        var localAssignments=readStoreJSON(STORAGE_KEYS.assignmentsMap,{});
        localAssignments[localToken]=payload;
        writeStoreJSON(STORAGE_KEYS.assignmentsMap,localAssignments);
        url=window.location.origin+window.location.pathname+'?assignmentLocal='+encodeURIComponent(localToken);
    }
    var output=$('assignment-link-output');
    if(output)output.value=url;

    var recent=readStoreJSON(STORAGE_KEYS.assignmentRecent,[]);
    recent.push({id:String(Date.now()),url:url,createdAt:payload.createdAt,language:S.language,length:scriptText.length});
    while(recent.length>50)recent.shift();
    writeStoreJSON(STORAGE_KEYS.assignmentRecent,recent);
    return url;
}

function copyAssignmentLink(){
    var output=$('assignment-link-output');
    var val=((output&&output.value)||'').trim();
    if(!val)val=createAssignmentLink();
    if(!val)return;
    if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(val).then(function(){toast('Assignment link copied.','success')}).catch(function(){toast('Copy failed.','error')});
        return;
    }
    var ta=document.createElement('textarea');
    ta.value=val;
    document.body.appendChild(ta);
    ta.select();
    try{document.execCommand('copy');toast('Assignment link copied.','success')}catch(e){toast('Copy failed.','error')}
    document.body.removeChild(ta);
}

function hydrateAssignmentFromURL(){
    try{
        var params=new URLSearchParams(window.location.search||'');
        var payload=null;
        var localToken=params.get('assignmentLocal');
        if(localToken){
            var saved=readStoreJSON(STORAGE_KEYS.assignmentsMap,{});
            payload=saved[localToken]||null;
        }else{
            var token=params.get('assignment');
            if(token)payload=decodeAssignmentPayload(token);
        }
        if(!payload||!payload.script)return false;
        $('script-input').value=payload.script;
        S.scriptSource='assignment';
        S.scriptLabel='Assignment Script';
        S.scriptRef=payload.scriptKey||'';
        if(payload.language&&LANG[payload.language])S.language=payload.language;
        syncScriptLanguageSelects();
        updateParse();
        showSetupTab('assignment');
        toast('Loaded shared assignment script.','success');
        return true;
    }catch(e){
        toast('Invalid assignment link.','error');
        return false;
    }
}

function updateLeaderboardFromSession(avgScore,totalUserLines,linesEvaluated){
    if(typeof avgScore!=='number')return;
    var key=S.scriptRef||getLeaderboardScriptKey();
    var all=getSavedLeaderboard();
    var row=all[key]||{
        scriptKey:key,
        scriptLabel:S.scriptLabel||'Manual Script',
        source:S.scriptSource||'manual',
        attempts:0,
        totalScore:0,
        avgScore:0,
        bestScore:0,
        linesEvaluatedTotal:0,
        userLinesTotal:0,
        lastPlayed:''
    };
    row.scriptLabel=S.scriptLabel||row.scriptLabel||'Manual Script';
    row.source=S.scriptSource||row.source||'manual';
    row.attempts+=1;
    row.totalScore+=avgScore;
    row.avgScore=Math.round(row.totalScore/row.attempts);
    row.bestScore=Math.max(row.bestScore||0,avgScore);
    row.linesEvaluatedTotal+=(linesEvaluated||0);
    row.userLinesTotal+=(totalUserLines||0);
    row.lastPlayed=new Date().toISOString();
    all[key]=row;
    writeStoreJSON(STORAGE_KEYS.leaderboard,all);
}

function getLeaderboardRows(){
    var all=getSavedLeaderboard();
    return Object.keys(all).map(function(k){return all[k]}).sort(function(a,b){
        if((b.avgScore||0)!==(a.avgScore||0))return (b.avgScore||0)-(a.avgScore||0);
        if((b.bestScore||0)!==(a.bestScore||0))return (b.bestScore||0)-(a.bestScore||0);
        return (b.attempts||0)-(a.attempts||0);
    });
}

function renderHomeLeaderboard(){
    var box=$('home-leaderboard');
    if(!box)return;
    var rows=getLeaderboardRows().slice(0,5);
    if(!rows.length){
        box.innerHTML='<div class="text-sf-300">Complete a session to populate leaderboard rankings.</div>';
        return;
    }
    box.innerHTML=rows.map(function(r,idx){
        var when=r.lastPlayed?new Date(r.lastPlayed).toLocaleDateString():'';
        return '<div class="lb-row">'
            +'<div class="lb-rank">#'+(idx+1)+'</div>'
            +'<div class="min-w-0"><div class="lb-name">'+esc(r.scriptLabel||'Manual Script')+'</div><div class="lb-meta">'+esc((r.source||'manual'))+' · '+(r.attempts||0)+' attempts · '+esc(when)+'</div></div>'
            +'<div class="lb-score">'+(r.avgScore||0)+'</div>'
            +'</div>';
    }).join('');
}

function cycleTheme(){
    var cur=S.uiTheme||'system';
    var next=cur==='system'?'dark':(cur==='dark'?'light':'system');
    setThemePreference(next);
}

function getSystemTheme(){
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
}

function applyThemePreference(){
    var pref=S.uiTheme||'system';
    var eff=pref==='system'?getSystemTheme():pref;
    document.documentElement.setAttribute('data-theme',eff);
    renderThemeControls();
}

function setThemePreference(pref){
    S.uiTheme=pref||'system';
    writeStoreJSON(STORAGE_KEYS.uiTheme,S.uiTheme);
    applyThemePreference();
    toast('Theme set to '+(S.uiTheme==='system'?'system':S.uiTheme)+'.','info');
}

function renderThemeControls(){
    var label=S.uiTheme==='system'?'System':(S.uiTheme==='light'?'Light':'Dark');
    var btn=$('theme-toggle-btn');
    if(btn)btn.innerHTML='<i class="fas fa-circle-half-stroke mr-1.5"></i>'+label;
    var q=$('theme-quick-btn');
    if(q)q.innerHTML='<i class="fas fa-circle-half-stroke mr-1"></i>Theme: '+label;
}

