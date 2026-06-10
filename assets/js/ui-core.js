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

/* ─────────────────────────────────────────────────────────────────
   detectScriptLanguage — character-frequency language detection.
   Checks for script-unique Unicode ranges and diacritics.
   Returns a LANG key ('en','es','fr', etc.) or null if text is too short.
───────────────────────────────────────────────────────────────── */
function detectScriptLanguage(text){
    if(!text||text.length<20)return null;
    /* Non-Latin scripts — unique ranges, check first */
    if(/[\u3040-\u309F\u30A0-\u30FF]/.test(text))return'ja';     /* Hiragana / Katakana */
    if(/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text))return'ko';     /* Hangul */
    if(/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text))return'zh';     /* CJK (checked after JP) */
    if(/[\u0600-\u06FF\u0750-\u077F]/.test(text))return'ar';     /* Arabic */
    if(/[\u0400-\u04FF]/.test(text))return'ru';                   /* Cyrillic */
    /* Latin-based — score by language-unique diacritics */
    var es=((text.match(/[\u00F1\u00D1\u00A1\u00BF]/g)||[]).length*4
           +(text.match(/[\u00E1\u00E9\u00ED\u00F3\u00FA\u00C1\u00C9\u00CD\u00D3\u00DA]/g)||[]).length);
    var fr=((text.match(/[\u00E0\u00E8\u00EA\u00E7\u0153\u00C0\u00C8\u00CA\u00C7\u0152]/g)||[]).length*4
           +(text.match(/[\u00EE\u00F4\u00FB\u00F9\u00E9\u00CE\u00D4\u00DB\u00D9\u00C9]/g)||[]).length);
    var de=((text.match(/[\u00DF]/g)||[]).length*6
           +(text.match(/[\u00FC\u00F6\u00E4\u00DC\u00D6\u00C4]/g)||[]).length*3);
    var pt=((text.match(/[\u00E3\u00F5\u00C3\u00D5]/g)||[]).length*5
           +(text.match(/[\u00E2\u00CA\u00F4\u00E0\u00E1\u00E9\u00ED\u00F3\u00FA\u00E7]/g)||[]).length);
    var best=null,bestScore=3; /* need at least 3 matching chars to trigger */
    var scores={es:es,fr:fr,de:de,pt:pt};
    Object.keys(scores).forEach(function(k){if(scores[k]>bestScore){best=k;bestScore=scores[k];}});
    return best||'en';
}

/* ─────────────────────────────────────────────────────────────────
   checkAndWarnVoice — shows a toast if no native TTS voice is
   installed on this device for the given BCP-47 code.
───────────────────────────────────────────────────────────────── */
function checkAndWarnVoice(ttsCode,langName){
    if(typeof speechSynthesis==='undefined')return;
    function _check(){
        var voices=speechSynthesis.getVoices();
        if(!voices.length)return;
        var prefix=ttsCode.split('-')[0];
        var found=voices.some(function(v){return v.lang===ttsCode||v.lang.startsWith(prefix);});
        if(!found){
            toast('No '+langName+' voice found on this device. '
                 +'Go to System Settings and install a '+langName+' voice for correct pronunciation.',
                 'info',8000);
        }
    }
    if(speechSynthesis.getVoices().length>0){_check();}
    else{setTimeout(_check,900);}
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function toast(msg,type,duration){
    type=type||'info';
    duration=duration||4000;
    var ic={success:'fa-circle-check',error:'fa-circle-exclamation',info:'fa-circle-info'};
    var t=document.createElement('div');
    t.className='toast toast-'+type;
    t.innerHTML='<i class="fas '+(ic[type]||ic.info)+'"></i><span>'+esc(msg)+'</span>';
    $('toast-container').appendChild(t);
    setTimeout(function(){
        t.style.animation='to2 .3s ease forwards';
        setTimeout(function(){t.remove()},300);
    },duration);
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
    if(id==='audio-devices-section'&&el.classList.contains('open'))loadAudioDevices();
}
function closeClassroomMenus(){
    document.querySelectorAll('.classroom-overflow-menu').forEach(function(menu){menu.classList.add('hidden')});
}
function toggleClassroomMenu(event,id){
    event.stopPropagation();
    var menu=$(id);
    var wasHidden=menu.classList.contains('hidden');
    closeClassroomMenus();
    if(wasHidden)menu.classList.remove('hidden');
}
document.addEventListener('click',closeClassroomMenus);
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
    return S.mode==='practice';
}

function showSetupTab(tab){
    S.activeSetupTab=tab;
    document.querySelectorAll('.setup-tab-btn').forEach(function(btn){
        var active=btn.dataset.tab===tab;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
    });
    $('panel-home').classList.toggle('active',tab==='home');
    $('panel-mode').classList.toggle('active',tab==='practice'||tab==='presentation');
    $('panel-settings').classList.toggle('active',tab==='settings');
    if($('panel-classes'))$('panel-classes').classList.toggle('active',tab==='classes');
    initClassesTab();

    if(tab==='practice'||tab==='presentation'){
        S.mode=tab;
        var isPres=tab==='presentation';
        $('mode-title').textContent=isPres?t('modePresentationTitle'):t('modePracticeTitle');
        $('mode-desc').textContent=isPres?t('modePresentationDesc'):t('modePracticeDesc');
        $('mode-mini-badge').textContent=isPres?t('modePresentationBadge'):t('modePracticeBadge');
        $('mode-mini-badge').className='px-2.5 py-1 rounded-md text-xs font-semibold '+(isPres?'bg-sage-500/15 text-sage-400':'bg-copper-500/15 text-copper-400');
        $('hint-settings').classList.toggle('hidden',!isPres);
        $('practice-script-language-wrap').classList.toggle('hidden',isPres);
        $('presentation-script-language-wrap').classList.toggle('hidden',!isPres);
        $('start-btn').textContent=isPres?t('startPresentation'):t('startPractice');
    }
    if(tab==='home')refreshHomeProgressSnapshot();
    if(tab==='practice'||tab==='presentation')renderScriptLibraryOptions();
    if(tab==='settings'&&typeof loadProfileIntoSettings==='function')loadProfileIntoSettings();
    if(tab==='classes')renderClassesTabContent();
}

function loadAudioDevices(){
    var status=$('audio-devices-status');
    if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices){
        if(status)status.textContent='Audio device selection is not supported in this browser.';
        return;
    }
    if(status)status.textContent='Loading audio devices...';
    navigator.mediaDevices.enumerateDevices().then(function(devices){
        renderAudioDeviceSelect('preferred-mic-select',devices.filter(function(d){return d.kind==='audioinput'}),S.preferredMicId,'Microphone');
        renderAudioDeviceSelect('preferred-speaker-select',devices.filter(function(d){return d.kind==='audiooutput'}),S.preferredSpeakerId,'Speaker');
        if(status)status.textContent='Speaker selection requires Chrome';
    }).catch(function(err){
        if(status)status.textContent='Could not load audio devices.';
        console.error('enumerateDevices error:',err);
    });
}

function renderAudioDeviceSelect(id,devices,selectedId,label){
    var select=$(id);
    if(!select)return;
    select.innerHTML='<option value="">System default</option>';
    devices.forEach(function(device,index){
        var option=document.createElement('option');
        option.value=device.deviceId;
        option.textContent=device.label||label+' '+(index+1);
        select.appendChild(option);
    });
    select.value=selectedId||'';
}

function setPreferredAudioDevice(kind,deviceId){
    if(kind==='mic'){
        S.preferredMicId=deviceId;
        if(typeof releaseMicStream==='function')releaseMicStream();
    }else{
        S.preferredSpeakerId=deviceId;
        if(S.ttsAudio&&typeof applyPreferredSpeaker==='function')applyPreferredSpeaker(S.ttsAudio);
    }
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

var ACCOUNT_SCOPED_STORAGE_KEYS=(function(){
    var scoped={};
    [
        STORAGE_KEYS.sessions,
        STORAGE_KEYS.scripts,
        STORAGE_KEYS.bookmarks,
        STORAGE_KEYS.leaderboard,
        STORAGE_KEYS.uiTheme,
        STORAGE_KEYS.onboardingDone
    ].forEach(function(k){scoped[k]=true});
    return scoped;
})();

function getStorageScopeId(){
    if(S&&S.authUser&&S.authUser.uid)return String(S.authUser.uid);
    return 'guest';
}

function isAccountScopedStorageKey(key){
    return !!ACCOUNT_SCOPED_STORAGE_KEYS[key];
}

function getScopedStorageKey(key,scopeId){
    return key+'__'+(scopeId||getStorageScopeId());
}

function migrateLegacyStorageIfNeeded(key,scopeId){
    if(!isAccountScopedStorageKey(key))return;
    var targetKey=getScopedStorageKey(key,scopeId);
    try{
        if(localStorage.getItem(targetKey)!==null)return;
        var legacy=localStorage.getItem(key);
        if(legacy!==null)localStorage.setItem(targetKey,legacy);
    }catch(e){}
}

function readStoreJSON(key,fallback){
    var readKey=key;
    if(isAccountScopedStorageKey(key)){
        var scopeId=getStorageScopeId();
        migrateLegacyStorageIfNeeded(key,scopeId);
        readKey=getScopedStorageKey(key,scopeId);
    }
    try{
        var raw=localStorage.getItem(readKey);
        if(!raw)return fallback;
        var parsed=JSON.parse(raw);
        return parsed==null?fallback:parsed;
    }catch(e){
        return fallback;
    }
}

function writeStoreJSON(key,val){
    var writeKey=isAccountScopedStorageKey(key)?getScopedStorageKey(key):key;
    try{localStorage.setItem(writeKey,JSON.stringify(val))}catch(e){}
}

/* ═══════════════════════════════════════════════════════════════
   CLASSES TAB
═══════════════════════════════════════════════════════════════ */

function initClassesTab(){
    var btn=$('tab-classes');
    if(!btn)return;
    var show=!!(S.userProfile&&S.userProfile.role);
    btn.classList.toggle('hidden',!show);
}

function renderClassesTabContent() {
    if (!S.userProfile || !S.authUser) return;
    var role = S.userProfile.role;
    var teacherView = $('classes-teacher-view');
    var studentView = $('classes-student-view');
    if (!teacherView || !studentView) return;
    teacherView.classList.toggle('hidden', role !== 'teacher');
    studentView.classList.toggle('hidden', role !== 'student');
    if (role === 'teacher') {
        var list = $('teacher-classes-list');
        if (!list) return;
        list.innerHTML = '<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading classes...</span></div>';
        getTeacherClasses(S.authUser.uid).then(function(classes) {
            if (!classes.length) { list.innerHTML = '<p class="text-sf-300 text-sm">No classes yet. Create one above.</p>'; return; }
            _teacherClasses = classes;
            renderClassCards(list, classes, 'teacher');
        }).catch(function() { list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load classes.</p>'; });
    } else {
        var list = $('student-classes-list');
        if (!list) return;
        list.innerHTML = '<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading...</span></div>';
        getStudentClasses(S.authUser.uid).then(function(classes) {
            if (!classes.length) { list.innerHTML = '<p class="text-sf-300 text-sm">No classes joined yet.</p>'; return; }
            _studentClasses = classes;
            renderClassCards(list, classes, 'student');
        }).catch(function() { list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load classes.</p>'; });
    }
}

function loadTeacherClasses(){
    if(!S.authUser||!S.authUser.uid)return;
    var list=$('teacher-classes-list');
    if(!list)return;
    list.innerHTML='<div class="text-sf-300 text-sm">Loading classes…</div>';
    getTeacherClasses(S.authUser.uid).then(function(classes){
        if(!classes.length){
            list.innerHTML='<div class="text-sf-300 text-sm">No classes yet. Create your first class above.</div>';
            return;
        }
        list.innerHTML=classes.map(function(c){
            var count=(c.studentUids&&c.studentUids.length)||0;
            return '<div class="mini-card">'
                +'<div class="flex items-start justify-between gap-3">'
                +'<div>'
                +'<div class="font-display font-semibold text-sf-50">'+esc(c.className)+'</div>'
                +'<div class="text-xs text-sf-300 mt-0.5">'+esc(c.subject)+'</div>'
                +'</div>'
                +'<div class="flex items-center gap-2 flex-shrink-0">'
                +'<button onclick="copyClassCode(\'' +c.classCode+ '\')" title="Copy class code" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-copper-500/12 border border-copper-500/20 text-copper-300 text-xs font-mono font-semibold hover:bg-copper-500/22 transition-all">'
                +'<i class="fas fa-copy text-[10px]"></i>'+esc(c.classCode)
                +'</button>'
                +'<span class="text-xs text-sf-300">'+count+' student'+(count===1?'':'s')+'</span>'
                +'</div>'
                +'</div>'
                +'</div>';
        }).join('');
    }).catch(function(err){
        list.innerHTML='<div class="text-coral-400 text-sm">Failed to load classes.</div>';
        console.error('loadTeacherClasses error:',err);
    });
}

function loadStudentClasses(){
    if(!S.authUser||!S.authUser.uid)return;
    var list=$('student-classes-list');
    if(!list)return;
    list.innerHTML='<div class="text-sf-300 text-sm">Loading classes…</div>';
    getStudentClasses(S.authUser.uid).then(function(classes){
        if(!classes.length){
            list.innerHTML='<div class="text-sf-300 text-sm">You haven\'t joined any classes yet.</div>';
            return;
        }
        list.innerHTML=classes.map(function(c){
            return '<div class="mini-card">'
                +'<div class="font-display font-semibold text-sf-50">'+esc(c.className)+'</div>'
                +'<div class="text-xs text-sf-300 mt-0.5">'+esc(c.subject)+(c.school?' &middot; '+esc(c.school):'')+'</div>'
                +'</div>';
        }).join('');
    }).catch(function(err){
        list.innerHTML='<div class="text-coral-400 text-sm">Failed to load classes.</div>';
        console.error('loadStudentClasses error:',err);
    });
}

function handleJoinClass(){
    var input=$('join-class-code');
    var code=(input?input.value:'').trim().toUpperCase();
    var errEl=$('join-class-error');
    var successEl=$('join-class-success');
    if(errEl)errEl.classList.add('hidden');
    if(successEl)successEl.classList.add('hidden');
    if(code.length!==6){
        if(errEl){errEl.textContent='Please enter a valid 6-character class code.';errEl.classList.remove('hidden');}
        return;
    }
    var school=(S.userProfile&&S.userProfile.school)||'';
    joinClass(S.authUser.uid,code,school).then(function(classData){
        if(successEl){successEl.textContent='Joined "'+classData.className+'" successfully!';successEl.classList.remove('hidden');}
        if(input)input.value='';
        renderClassesTabContent();
    }).catch(function(err){
        if(errEl){errEl.textContent=err.message||'Failed to join class.';errEl.classList.remove('hidden');}
    });
}

function openCreateClassModal(){
    var modal=$('create-class-modal');
    if(!modal)return;
    if($('new-class-name'))$('new-class-name').value='';
    if($('new-class-subject'))$('new-class-subject').value='';
    if($('new-class-description'))$('new-class-description').value='';
    var errEl=$('create-class-error');
    if(errEl)errEl.classList.add('hidden');
    modal.classList.remove('hidden');
    setTimeout(function(){if($('new-class-name'))$('new-class-name').focus();},80);
}

function closeCreateClassModal(){
    var modal=$('create-class-modal');
    if(modal)modal.classList.add('hidden');
}

function submitCreateClass(){
    var name=($('new-class-name')?$('new-class-name').value:'').trim();
    var subject=($('new-class-subject')?$('new-class-subject').value:'').trim();
    var description=($('new-class-description')?$('new-class-description').value:'').trim();
    var errEl=$('create-class-error');
    if(!name||!subject){
        if(errEl){errEl.textContent='Please fill in class name and subject.';errEl.classList.remove('hidden');}
        return;
    }
    var school=(S.userProfile&&S.userProfile.school)||'';
    var saveBtn=$('create-class-save-btn');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving…';}
    createClass(S.authUser.uid,name,subject,description,school).then(function(){
        closeCreateClassModal();
        renderClassesTabContent();
    }).catch(function(err){
        if(errEl){errEl.textContent=err.message||'Failed to create class.';errEl.classList.remove('hidden');}
    }).finally(function(){
        if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save';}
    });
}

function copyClassCode(code){
    if(navigator.clipboard){
        navigator.clipboard.writeText(code).catch(function(){});
    }
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
    var seed=[S.language||'',S.userRoles.slice().sort().join('+')||'',scriptLines].join('||');
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

