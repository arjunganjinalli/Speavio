function switchScreen(n){
    S.screen=n;
    document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
    $(n+'-screen').classList.add('active');
    /* Clean up report blob URLs when leaving report screen */
    if(n!=='complete')revokeReportBlobs();
}

/* ═══════════════════════════════════════════════════════════════
   SETUP SCREEN
═══════════════════════════════════════════════════════════════ */
function updateParse(){
    var text=$('script-input').value.trim(),el=$('parse-status');
    if(!text){el.textContent='';$('role-section').classList.add('hidden');S.lines=[];S.scriptDifficulty={score:0,label:'Easy',metrics:null};renderSetupDifficultyBadge();updateStartBtn();return}
    var lines=parseScript(text);
    /* Auto-detect script language (skipped if user manually chose a language) */
    if(!S._langManualOverride){
        var detected=detectScriptLanguage(text);
        if(detected&&detected!==S.language){
            S.language=detected;
            syncScriptLanguageSelects();
            toast('Detected language: '+LANG[detected].name,'info');
            checkAndWarnVoice(LANG[detected].tts,LANG[detected].name);
        }
    }
    if(!lines.length){
        el.innerHTML='<span class="text-coral-400"><i class="fas fa-triangle-exclamation mr-1"></i>No valid lines detected. Try Auto-Detect, or use [Role]: text format.</span>';
        $('role-section').classList.add('hidden');S.lines=[];
        S.scriptDifficulty={score:0,label:'Easy',metrics:null};
    }else{
        var roles=[];
        lines.forEach(function(l){if(roles.indexOf(l.role)===-1)roles.push(l.role)});
        S.scriptDifficulty=estimateScriptDifficulty(lines);
        el.innerHTML='<span class="text-sage-400"><i class="fas fa-circle-check mr-1"></i>'+lines.length+' lines &middot; '+roles.map(function(r){return '<span class="text-sf-50">'+esc(r)+'</span>'}).join(', ')+'</span>';
        S.lines=lines;S.roles=roles;
        renderPills();
        $('role-section').classList.remove('hidden');
        S.userRoles=S.userRoles.filter(function(r){return roles.indexOf(r)!==-1;});
    }
    renderSetupDifficultyBadge();
    updateStartBtn();
}
function isUserRole(r){return S.userRoles.indexOf(r)!==-1;}
function renderPills(){
    $('role-pills').innerHTML=S.roles.map(function(r){
        var sel=isUserRole(r);
        return '<button class="role-pill '+(sel?'selected':'')+' " data-role="'+r+'">'+(sel?'<i class="fas fa-check mr-1.5 text-[10px]"></i>':'')+esc(r)+'</button>';
    }).join('');
    $('role-pills').querySelectorAll('.role-pill').forEach(function(p){
        p.onclick=function(){
            var r=p.dataset.role;
            var idx=S.userRoles.indexOf(r);
            if(idx===-1)S.userRoles.push(r);
            else S.userRoles.splice(idx,1);
            renderPills();updateStartBtn();
        };
    });
}
function updateStartBtn(){
    $('start-btn').disabled=!(S.lines.length&&S.userRoles.length>0);
}

/* ═══════════════════════════════════════════════════════════════
   SESSION START
═══════════════════════════════════════════════════════════════ */
function startSession(){
    if(!S.isAuthenticated){
        toast('Please sign in first.','error');
        switchScreen('login');
        return;
    }
    var ok=false;
    S.lines.forEach(function(l){if(isUserRole(l.role))ok=true});
    if(!ok){toast('Selected role(s) have no lines!','error');return}

    var key=$('el-key')?$('el-key').value.trim():S.elevenlabsKey;
    S.elevenlabsKey=key;
    if($('el-voice-select'))S.elevenlabsVoiceId=$('el-voice-select').value;

    S.currentLine=0;
    S.practicePickerActive=false;
    S.showExpected=true;
    S.userInput='';
    S.isProcessing=false;
    S.sessionStart=Date.now();
    S.lineScores={};S.lineDetails={};S.userResponses={};S.audioClips={};S.attemptCount={};S.hintShown={};S.practiceScoreHistory={};
    if(!S.scriptLabel)S.scriptLabel='Manual Script';
    if(!S.scriptRef)S.scriptRef=getLeaderboardScriptKey();
    S.presState=PS.HIDDEN;
    stopSpeaking();

    $('mode-badge').textContent=S.mode==='presentation'
        ?t('modePresentationBadge')
        :t('modePracticeBadge');
    $('lang-badge').textContent=LANG[S.language].badge;
    $('hint-ctrl').classList.toggle('hidden',S.mode!=='presentation');
    renderAllHintPills();
    switchScreen('session');

    if(S.mode==='practice'){
        /* Practice mode: show line picker instead of starting at line 0 */
        S.practicePickerActive=true;
        renderPracticeLinePicker();
    }else{
        renderSession();
        if(isPracticeLikeMode()){
            var firstLine=S.lines[0];
            if(firstLine&&!isUserRole(firstLine.role)){
                speak(firstLine.text,null,false);
            }
        }else{
            /* Presentation mode — auto-flow starts after a brief pause */
            setTimeout(presentationAutoFlow,600);
        }
    }
}

/* ═══════════════════════════════════════════════════════════════
   PRESENTATION AUTO-FLOW
   Drives continuous flow: NPC lines auto-speak, user lines auto-record.
   At the very end, batch-evaluates everything and shows the report.
═══════════════════════════════════════════════════════════════ */
function presentationAutoFlow(){
    if(S.screen!=='session'||S.mode!=='presentation')return;

    var line=S.lines[S.currentLine];
    if(!line){finishPresentation();return}

    var isUser=isUserRole(line.role);

    if(!isUser){
        /* ── NPC line: auto-speak, then auto-advance ── */
        S.presState=PS.HIDDEN;
        renderSession();

        speak(line.text,function(){
            if(S.screen!=='session'||S.mode!=='presentation')return;
            if(S.currentLine>=S.lines.length-1){
                finishPresentation();
            }else{
                advanceLine();
            }
        },false);
    }else{
        /* ── User line: show hint, then auto-start recording ── */
        S.presState=PS.HIDDEN;
        renderSession();

        /* Brief pause so user sees "Your Turn" before recording starts */
        setTimeout(function(){
            if(S.screen!=='session'||S.mode!=='presentation')return;

            /* Auto-reveal hint based on hint level */
            if(S.hintLevel!=='none'){
                S.hintShown[S.currentLine]=true;
                S.presState=PS.HINT;
                renderContext();
                renderIA();
            }else{
                S.presState=PS.HINT;
                renderIA();
            }

            /* Start recording after another brief pause */
            setTimeout(function(){
                if(S.screen!=='session'||S.mode!=='presentation'||S.isRecording)return;
                startRec();
            },600);
        },500);
    }
}

/* ── Called when all lines are done — batch evaluates then shows report ── */
function finishPresentation(){
    S.screen='report_pending';
    releaseMicStream();

    /* Switch to report screen and show loading */
    switchScreen('complete');
    $('st-lines').textContent=S.lines.filter(function(l){return isUserRole(l.role)}).length;
    $('st-eval').innerHTML='<div class="spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;border-width:2px"></div>';
    $('st-correct').textContent='...';
    $('st-best').textContent='...';
    var elapsed=Math.round((Date.now()-S.sessionStart)/1000);
    var ts=elapsed>=60?Math.floor(elapsed/60)+'m '+elapsed%60+'s':elapsed+'s';
    $('st-time').textContent=ts;
    $('final-score').textContent='...';
    $('report-lines').innerHTML='<div class="flex items-center justify-center gap-3 py-12"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><span class="text-sf-300">Evaluating your performance...</span></div>';

    batchEvaluatePresentation();
}

function batchEvaluatePresentation(){
    /* Collect all user lines that have responses */
    var userLines=[];
    S.lines.forEach(function(line,i){
        if(isUserRole(line.role)&&S.userResponses[i]){
            userLines.push({index:i,line:line,response:S.userResponses[i]});
        }
    });

    if(userLines.length===0){renderReportUI();return}

    var evalIndex=0;
    function evalNext(){
        if(evalIndex>=userLines.length){renderReportUI();return}
        var item=userLines[evalIndex];
        var ctx=S.lines.slice(Math.max(0,item.index-4),item.index);

        evalResponse(ctx,item.line.text,item.response,true)
            .then(function(ev){
                S.lineScores[item.index]=ev.score;
                S.lineDetails[item.index]=ev;
                S.attemptCount[item.index]=1;
                evalIndex++;
                evalNext();
            })
            .catch(function(){
                evalIndex++;
                evalNext();
            });
    }
    evalNext();
}

/* ── Render the actual report (called after batch eval finishes) ── */

function renderSession(){renderProgress();renderContext();renderIA()}

function renderProgress(){
    /* Practice picker manages its own progress display */
    if(S.mode==='practice'&&S.practicePickerActive){return}
    var t=S.lines.length,c=S.currentLine+1;
    $('progress-text').textContent=c+' / '+t;
    $('progress-fill').style.width=(c/t*100)+'%';
    var d=$('line-dots');
    if(t<=25){
        d.classList.remove('hidden');
        d.innerHTML=S.lines.map(function(l,i){
            var cls='line-dot';
            if(i<S.currentLine)cls+=S.lineScores[i]!=null&&S.lineScores[i]<50?' done low':' done';
            else if(i===S.currentLine)cls+=' current';
            return '<div class="'+cls+'"></div>';
        }).join('');
    }else d.classList.add('hidden');
}

function renderContext(){
    var c=$('dialogue-context');
    /* Practice mode: show only the single selected line, no conversation history */
    if(S.mode==='practice'&&!S.practicePickerActive){
        var line=S.lines[S.currentLine];
        if(!line){c.innerHTML='';return}
        var isU=isUserRole(line.role);
        var bc=(isU?'bubble-user':'bubble-other')+' bubble-current';
        c.innerHTML='<div class="bubble '+bc+'"><div class="bubble-label">'+esc(line.role)+'</div>'
            +'<div class="text-sm leading-relaxed text-sf-50">'+esc(line.text)+'</div></div>';
        return;
    }
    var start=Math.max(0,S.currentLine-8),end=S.currentLine+1;
    c.innerHTML=S.lines.slice(start,end).map(function(line,vi){
        var ri=start+vi;
        var isU=isUserRole(line.role);
        var isC=ri===S.currentLine;
        var isP=ri<S.currentLine;
        var bc=isU?'bubble-user':'bubble-other';
        if(isC)bc+=' bubble-current';
        if(isP)bc+=' bubble-past';
        var sc=S.lineScores[ri];
        var badge=(isP&&isU&&sc!=null)?'<span class="inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-bold '+(sc>=80?'bg-sage-500/20 text-sage-400':sc>=50?'bg-copper-500/20 text-copper-400':'bg-coral-500/20 text-coral-400')+'">'+sc+'</span>':'';
        var rep=(!isU&&(isP||isC))?'<button class="replay-btn" onclick="replayLine('+ri+')" aria-label="Replay"><i class="fas fa-volume-up"></i></button>':'';

        /* In presentation mode, hide the CURRENT user line text in bubble until evaluated */
        var lineText=line.text;
        var textCls='text-sm leading-relaxed text-sf-50';
        if(isU&&isC&&S.mode==='presentation'){
            var shouldHideInBubble=(S.presState===PS.HIDDEN||S.presState===PS.HINT||S.presState===PS.REC);
            if(shouldHideInBubble){
                textCls='text-sm leading-relaxed text-sf-50 line-hidden';
            }
        }

        return '<div class="bubble '+bc+'"><div class="bubble-label">'+esc(line.role)+badge+'</div><div class="'+textCls+'">'+esc(lineText)+'</div>'+rep+'</div>';
    }).join('');
    requestAnimationFrame(function(){c.scrollTop=c.scrollHeight});
}

/* ═══════════════════════════════════════════════════════════════
   INTERACTION AREA
═══════════════════════════════════════════════════════════════ */

/* ── Animate Listening indicator while waiting for valid speech ── */
function _startListenAnim(){
    if(S._listenAnim){clearInterval(S._listenAnim);S._listenAnim=null;}
    var ticks=0;
    var countdown=7;
    S._listenAnim=setInterval(function(){
        var ls=document.getElementById('listen-status');
        var lc=document.getElementById('listen-countdown');
        if(!ls||!S.isRecording||S.speechDetected){clearInterval(S._listenAnim);S._listenAnim=null;return;}
        ticks++;
        var dotCount=(ticks%3)+1;
        ls.textContent='Listening'+'.'.repeat(dotCount);
        if(ticks%2===0&&countdown>0)countdown--;
        if(lc)lc.textContent=countdown+'s';
        if(countdown===0){clearInterval(S._listenAnim);S._listenAnim=null;handleNoSpeechTimeout();}
    },500);
}

function renderIA(){
    var area=$('interaction-area');
    var line=S.lines[S.currentLine];
    if(!line){area.innerHTML='';return}
    var isU=isUserRole(line.role);
    if(isPracticeLikeMode()){
        renderPracticeIA(area,line,isU);
    }else{
        renderPresentationIA(area,line,isU);
    }
}

/* ── PRACTICE MODE IA ── */
function renderPracticeIA(area,line,isU){
    if(isU){
        var h='<div class="flex flex-col gap-3">';

        if(S.isRecording){
            if(!S.speechDetected){
                /* ── LISTENING STATE: waiting for valid speech ── */
                h+='<div class="flex items-center justify-center gap-2 mb-1">'
                  +'<span id="listen-dot" style="width:8px;height:8px;border-radius:50%;background:#b45309;display:inline-block;animation:mp 1s ease-out infinite"></span>'
                  +'<span id="listen-status" class="text-xs text-copper-400 font-semibold tracking-wide">Listening.</span>'
                  +'<span id="listen-countdown" class="text-[10px] text-sf-300 ml-1">7s</span>'
                  +'</div>'
                  +'<div class="flex flex-col items-center gap-2 mt-3">'
                  +'<button class="mic-btn mic-btn-lg recording" onclick="stopAllRec()" title="Cancel"><i class="fas fa-stop"></i></button>'
                  +'<p class="text-xs text-sf-300 font-medium">Tap to cancel</p>'
                  +'</div>';
            }else{
                /* ── RECORDING STATE: speech confirmed, show vol bar and transcript ── */
                h+='<div class="flex items-center justify-center gap-2 mb-1">'
                  +'<span style="width:8px;height:8px;border-radius:50%;background:var(--sf-status-recording);display:inline-block;animation:mp 1s ease-out infinite"></span>'
                  +'<span class="text-xs text-coral-400 font-semibold tracking-wide">RECORDING</span>'
                  +'</div>'
                  +'<div class="vol-bar-track"><div id="vol-fill" class="vol-bar-fill" style="width:0%"></div></div>'
                  +'<div class="flex justify-between text-[10px] text-sf-300">'
                  +'<span>Voice level</span>'
                  +'<span>Auto-stop in <span id="sil-count" class="silence-countdown text-coral-400">2s</span> of silence</span>'
                  +'</div>'
                  +(S.userInput?'<div class="bg-sf-800/60 rounded-lg px-4 py-2 border border-white/5 text-left mt-1"><p id="live-text" class="text-sm text-sf-200 italic leading-snug">'+esc(S.userInput)+'</p></div>':'')
                  +'<div class="flex flex-col items-center gap-2 mt-1">'
                  +'<button class="mic-btn mic-btn-lg recording" onclick="stopAllRec()" title="Stop recording"><i class="fas fa-stop"></i></button>'
                  +'<p class="text-xs text-coral-400 font-medium">Tap to stop early</p>'
                  +'</div>';
            }
        }else if(S.isProcessing){
            h+='<div class="flex items-center justify-center gap-2.5 py-3"><div class="spinner"></div><span class="text-sm text-sf-300">Evaluating...</span></div>';
        }else{
            /* ── NORMAL STATE: expected line, input, mic, send ── */
            h+=S.showExpected
                ?'<div class="bg-white/3 rounded-lg px-4 py-2.5 border border-white/5 cursor-pointer" onclick="S.showExpected=false;renderIA()"><div class="text-xs text-sage-400 font-semibold mb-1 flex items-center justify-between"><span><i class="fas fa-bullseye mr-1"></i>Expected Line (tap to hide)</span><button onclick="event.stopPropagation();S.showExpected=false;renderIA()" class="text-sf-300 hover:text-sf-50 text-xs"><i class="fas fa-eye-slash mr-1"></i>Hide</button></div><p class="text-sm text-sf-100 italic">'+esc(line.text)+'</p></div>'
                :'<div class="flex justify-center"><button onclick="S.showExpected=true;renderIA()" class="text-xs text-copper-500 hover:text-copper-400"><i class="fas fa-eye mr-1"></i>Show line again</button></div>';

            h+='<div class="flex items-center gap-2">'
                            +'<input id="txt-in" type="text" placeholder="Say the line out loud or type here..." value="'+esc(S.userInput)+'" class="input-glow flex-1 bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" aria-label="Response">'
              +'<button class="mic-btn" onclick="startRec()" aria-label="Record"><i class="fas fa-microphone"></i></button>'
              +'<button onclick="handleSubmission()" class="h-14 px-5 rounded-xl bg-copper-500/15 hover:bg-copper-500/25 border border-copper-500/20 text-copper-400 font-semibold text-sm transition-all flex-shrink-0"><i class="fas fa-paper-plane"></i></button>'
              +'</div>';
        }
        h+='</div>';
        area.innerHTML=h;
        if(S.isRecording&&!S.speechDetected)_startListenAnim();
        var inp=$('txt-in');
        if(inp&&!S.isRecording){
            inp.oninput=function(e){S.userInput=e.target.value};
            inp.onkeydown=function(e){if(e.key==='Enter'&&S.userInput.trim())handleSubmission()};
            inp.focus();
        }
    }else{
        /* Other character's line */
        area.innerHTML='<div class="flex flex-col items-center gap-3 py-2">'
            +'<div class="flex items-center gap-3">'
            +'<button onclick="replayLine('+S.currentLine+')" class="w-10 h-10 rounded-lg bg-sage-500/10 hover:bg-sage-500/20 flex items-center justify-center text-sage-400 transition-colors"><i class="fas fa-volume-up"></i></button>'
            +'<span class="text-sm text-sf-300">Listening to '+esc(line.role)+'...</span>'
            +'</div>'
            +'<button onclick="advanceLine()" class="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-sf-100 font-semibold text-sm transition-all">Continue <i class="fas fa-arrow-right ml-2"></i></button>'
            +'</div>';
        if(!S.isSpeaking)speak(line.text,null,false);
    }
}

/* ── PRESENTATION MODE IA — state machine ── */
function renderPresentationIA(area,line,isU){
    if(!isU){
        /* Other character: show play button + Next Line button. No auto-anything. */
        area.innerHTML='<div class="flex flex-col items-center gap-3 py-2">'
            +'<div class="flex items-center gap-3">'
            +'<button onclick="replayLine('+S.currentLine+')" class="w-10 h-10 rounded-lg bg-sage-500/10 hover:bg-sage-500/20 flex items-center justify-center text-sage-400 transition-colors" title="Play line"><i class="fas fa-volume-up"></i></button>'
            +'<span class="text-sm text-sf-300">'+esc(line.role)+'\'s line — tap speaker to hear</span>'
            +'</div>'
            +'<button onclick="advanceLine()" class="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-sf-100 font-semibold text-sm transition-all">Next Line <i class="fas fa-arrow-right ml-2"></i></button>'
            +'</div>';
        return;
    }

    /* User's turn — render by presState */
    var att=S.attemptCount[S.currentLine]||0;
    var attBadge=att>0?'<span class="text-[10px] bg-copper-500/10 text-copper-400 px-2 py-0.5 rounded ml-2">Attempt #'+(att+1)+'</span>':'';

    switch(S.presState){

        /* ── STATE: HIDDEN ──────────────────────────────────────────
           Line is blurred. Two buttons: [Show Hint] (left) + [Mic] (right)
           Neither button reveals/does the other's job.
        ────────────────────────────────────────────────────────── */
        case PS.HIDDEN:
            area.innerHTML='<div class="flex flex-col items-center gap-5 py-3">'
                +'<div class="text-center w-full max-w-lg">'
                +'<div class="text-xs text-copper-400 font-semibold mb-3 flex items-center justify-center gap-1"><i class="fas fa-user text-xs"></i><span>Your Turn — '+esc(line.role)+'</span>'+attBadge+'</div>'
                +'<div class="bg-white/3 rounded-2xl px-6 py-5 border border-white/5 relative overflow-hidden">'
                +'<p class="text-xl text-sf-50 font-medium leading-relaxed line-hidden select-none">'+esc(line.text)+'</p>'
                +'<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><span class="text-xs text-sf-300 bg-sf-800/80 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10"><i class="fas fa-lock mr-1.5 text-[10px]"></i>Line hidden</span></div>'
                +'</div>'
                +'</div>'
                /* Two-button row */
                +'<div class="pres-btn-row">'
                +'<button class="hint-reveal-btn" onclick="revealHint()"><i class="fas fa-lightbulb"></i>Show Hint</button>'
                +'<button class="mic-btn mic-btn-lg" onclick="startRec()" title="Record without hint"><i class="fas fa-microphone"></i></button>'
                +'</div>'
                +(att===0?''
                    :'<button onclick="skipLine()" class="text-xs text-sf-300 hover:text-sf-100 transition-colors mt-1">Skip this line</button>')
                +'</div>';
            break;

        /* ── STATE: HINT ──────────────────────────────────────────
           Hint text shown. Prominent mic button. Line NOT starting automatically.
        ────────────────────────────────────────────────────────── */
        case PS.HINT:
            var hintText=getHintText(line.text);
            var hintLabel=S.hintLevel==='full'?'Full text revealed':S.hintLevel==='first'?'First word hint':'No hint available';
            area.innerHTML='<div class="flex flex-col items-center gap-5 py-3">'
                +'<div class="text-center w-full max-w-lg">'
                +'<div class="text-xs text-copper-400 font-semibold mb-3 flex items-center justify-center gap-1"><i class="fas fa-user text-xs"></i><span>Your Turn — '+esc(line.role)+'</span>'+attBadge+'</div>'
                +'<div class="hint-reveal bg-copper-500/5 rounded-2xl px-6 py-5 border border-copper-500/15">'
                +(hintText
                    ?'<p class="text-xl '+(S.hintLevel==='first'?'text-copper-400':'text-sf-50')+' font-medium leading-relaxed">'+esc(hintText)+'</p>'
                    :'<p class="text-sm text-sf-300 italic">No hint — try from memory!</p>')
                +'<p class="text-[10px] text-sf-300 mt-2">'+hintLabel+'</p>'
                +'</div>'
                +'</div>'
                +'<div class="flex flex-col items-center gap-2">'
                +'<button class="mic-btn mic-btn-lg" onclick="startRec()" title="Start recording"><i class="fas fa-microphone"></i></button>'
                +'<p class="text-xs text-sf-300">Tap mic to record</p>'
                +'</div>'
                +'<button onclick="skipLine()" class="text-xs text-sf-300 hover:text-sf-100 transition-colors">Skip</button>'
                +'</div>';
            break;

        /* ── STATE: REC ───────────────────────────────────────────
           Recording: show vol bar, silence countdown, live transcript, stop button.
        ────────────────────────────────────────────────────────── */
        case PS.REC:
            var dispText=getHintText(line.text)||line.text;
            if(!S.speechDetected){
                /* ── LISTENING STATE ── */
                area.innerHTML='<div class="flex flex-col items-center gap-4 py-2">'
                    +'<div class="text-center w-full max-w-lg">'
                    +'<div class="flex items-center justify-center gap-2 mb-2">'
                    +'<span id="listen-dot" style="width:8px;height:8px;border-radius:50%;background:#b45309;display:inline-block;animation:mp 1s ease-out infinite"></span>'
                    +'<span id="listen-status" class="text-xs text-copper-400 font-semibold tracking-wide">Listening.</span>'
                    +'<span id="listen-countdown" class="text-[10px] text-sf-300 ml-1">7s</span>'
                    +'</div>'
                    +'<div class="bg-white/3 rounded-xl px-5 py-3 border border-white/5 mb-3">'
                    +'<p class="text-base text-sf-100 font-medium leading-relaxed">'+esc(dispText)+'</p>'
                    +'</div>'
                    +'</div>'
                    +'<div class="flex flex-col items-center gap-2">'
                    +'<button class="mic-btn mic-btn-lg recording" onclick="stopAllRec()" title="Cancel"><i class="fas fa-stop"></i></button>'
                    +'<p class="text-xs text-sf-300 font-medium">Tap to cancel</p>'
                    +'</div>'
                    +'</div>';
                _startListenAnim();
            }else{
                /* ── RECORDING STATE ── */
                area.innerHTML='<div class="flex flex-col items-center gap-4 py-2">'
                    +'<div class="text-center w-full max-w-lg">'
                    +'<div class="flex items-center justify-center gap-2 mb-2">'
                    +'<span style="width:8px;height:8px;border-radius:50%;background:var(--sf-status-recording);display:inline-block;animation:mp 1s ease-out infinite"></span>'
                    +'<span class="text-xs text-coral-400 font-semibold tracking-wide">RECORDING</span>'
                    +'</div>'
                    +'<div class="bg-white/3 rounded-xl px-5 py-3 border border-white/5 mb-3">'
                    +'<p class="text-base text-sf-100 font-medium leading-relaxed">'+esc(dispText)+'</p>'
                    +'</div>'
                    +'<div class="space-y-1.5 mb-1">'
                    +'<div class="vol-bar-track"><div id="vol-fill" class="vol-bar-fill" style="width:0%"></div></div>'
                    +'<div class="flex justify-between text-[10px] text-sf-300">'
                    +'<span>Voice level</span>'
                    +'<span>Auto-stop in <span id="sil-count" class="silence-countdown text-coral-400">2s</span> of silence</span>'
                    +'</div>'
                    +'</div>'
                    +(S.userInput?'<div class="bg-sf-800/60 rounded-lg px-4 py-2 border border-white/5 text-left"><p id="live-text" class="text-sm text-sf-200 italic leading-snug">'+esc(S.userInput)+'</p></div>':'')
                    +'</div>'
                    +'<div class="flex flex-col items-center gap-2">'
                    +'<button class="mic-btn mic-btn-lg recording" onclick="stopAllRec()" title="Stop recording"><i class="fas fa-stop"></i></button>'
                    +'<p class="text-xs text-coral-400 font-medium">Tap to stop early</p>'
                    +'</div>'
                    +'</div>';
            }
            break;

        /* ── STATE: EVAL ──────────────────────────────────────────
           Spinner while API evaluates.
        ────────────────────────────────────────────────────────── */
        case PS.EVAL:
            area.innerHTML='<div class="flex flex-col items-center gap-4 py-6">'
                +'<div class="spinner" style="width:36px;height:36px;border-width:3px"></div>'
                +'<p class="text-sm text-sf-300">Evaluating your delivery...</p>'
                +'</div>';
            break;

        /* ── STATE: RESULT ────────────────────────────────────────
           Scorecard. User picks Retry or Continue.
        ────────────────────────────────────────────────────────── */
        case PS.RESULT:
            showPresEvalCard();
            break;

        default:
            S.presState=PS.HIDDEN;
            renderPresentationIA(area,line,isU);
    }
}

function revealHint(){
    S.hintShown[S.currentLine]=true;
    S.presState=PS.HINT;
    renderContext(); /* update bubble blur */
    renderIA();
}

function handlePresEval(){
    var resp=S.userResponses[S.currentLine];
    if(!resp){
        /* No speech at all — go back to hint state */
        toast('No speech detected. Try again.','info');
        S.presState=PS.HINT;
        renderIA();
        return;
    }
    S.presState=PS.EVAL;
    S.isProcessing=true;
    renderIA();

    evalResponse(
        S.lines.slice(Math.max(0,S.currentLine-4),S.currentLine),
        S.lines[S.currentLine].text,
        resp,
        true
    ).then(function(ev){
        S.lineScores[S.currentLine]=ev.score;
        S.lineDetails[S.currentLine]=ev;
        S.isProcessing=false;
        S.attemptCount[S.currentLine]=(S.attemptCount[S.currentLine]||0)+1;
        S.presState=PS.RESULT;
        renderContext();
        showPresEvalCard();
    }).catch(function(e){
        toast(e.message,'error');
        S.isProcessing=false;
        S.presState=PS.HINT;
        renderIA();
    });
}

function showPresEvalCard(){
    var ev=S.lineDetails[S.currentLine];
    if(!ev){S.presState=PS.HINT;renderIA();return}
    var sc=ev.score,col=sc>=80?'#5BB882':sc>=50?'#E8B88A':'#D4736E';
    var lbl=sc>=80?'Excellent':sc>=50?'Good Effort':'Keep Practicing';
    var C=326.73,off=C*(1-sc/100);
    var cw=ev.correct_words||'--';
    var isYes=cw.toLowerCase().indexOf('yes')!==-1;
    var isLast=S.currentLine>=S.lines.length-1;

    var h='<div class="eval-in overflow-auto max-h-[calc(100vh-300px)]">'
        +'<div class="flex items-start gap-4">'
        +'<div class="flex-shrink-0">'
        +'<svg viewBox="0 0 120 120" width="80" height="80">'
        +'<circle cx="60" cy="60" r="52" fill="none" class="score-ring-bg" stroke-width="8"/>'
        +'<circle id="ev-ring" cx="60" cy="60" r="52" fill="none" stroke="'+col+'" stroke-width="8" stroke-dasharray="'+C+'" stroke-dashoffset="'+C+'" stroke-linecap="round" transform="rotate(-90 60 60)" class="score-ring-fill"/>'
        +'<text x="60" y="52" text-anchor="middle" fill="var(--sf-fg)" font-size="24" font-weight="700" font-family="Space Grotesk">'+sc+'</text>'
        +'<text x="60" y="68" text-anchor="middle" fill="'+col+'" font-size="7.5" font-weight="600" letter-spacing=".5">'+lbl.toUpperCase()+'</text>'
        +'</svg>'
        +'</div>'
        +'<div class="flex-1 min-w-0 space-y-2">'
        +'<div class="pres-eval-grid grid gap-1.5" style="grid-template-columns:repeat(2,1fr)">'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-1">Correct Words?</div><span class="check-badge '+(isYes?'check-yes':'check-no')+'"><i class="fas '+(isYes?'fa-check':'fa-xmark')+'"></i>'+esc(cw)+'</span></div>'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-1">Pronunciation</div><div class="text-xs text-sf-100 leading-snug">'+esc(ev.grammar)+'</div></div>'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-1">Accuracy</div><div class="text-xs text-sf-100 leading-snug">'+esc(ev.accuracy)+'</div></div>'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-1">Fluency</div><div class="text-xs text-sf-100 leading-snug">'+esc(ev.fluency)+'</div></div>'
        +'</div>';

    if(ev.encouragement)h+='<p class="text-xs text-sage-400 italic"><i class="fas fa-heart mr-1 text-[10px]"></i>'+esc(ev.encouragement)+'</p>';

    if(ev.corrections&&ev.corrections.length){
        h+='<div><div class="text-[10px] text-coral-400 font-semibold uppercase mb-1">Fix</div>';
        ev.corrections.forEach(function(c){h+='<div class="text-xs text-sf-200"><i class="fas fa-xmark text-coral-400 mr-1" style="font-size:10px"></i>'+esc(c)+'</div>'});
        h+='</div>';
    }
    if(ev.suggestions&&ev.suggestions.length){
        h+='<div><div class="text-[10px] text-copper-400 font-semibold uppercase mb-1">Tips</div>';
        ev.suggestions.forEach(function(sg){h+='<div class="text-xs text-sf-200"><i class="fas fa-lightbulb text-copper-400 mr-1" style="font-size:10px"></i>'+esc(sg)+'</div>'});
        h+='</div>';
    }
    if(ev.deliveryNotes&&ev.deliveryNotes.length){
        h+='<div><div class="text-[10px] text-sage-400 font-semibold uppercase mb-1">Delivery</div>';
        ev.deliveryNotes.forEach(function(n){h+='<div class="text-xs text-sf-200"><i class="fas fa-wave-square text-sage-400 mr-1" style="font-size:10px"></i>'+esc(n)+'</div>'});
        h+='</div>';
    }

    h+=renderWordDiffHTML(S.lines[S.currentLine].text,S.userResponses[S.currentLine]);
    h+='<div class="flex gap-2">'
        +'<button onclick="retryPresLine()" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-sf-100 font-display font-semibold text-sm transition-all"><i class="fas fa-rotate-right mr-1.5"></i>Retry</button>'
        +'<button onclick="advanceLine()" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 font-display font-semibold text-sm hover:from-amber-400 hover:to-yellow-400 transition-all">'+(isLast?'Finish':'Continue')+' <i class="fas fa-arrow-right ml-1.5"></i></button>'
        +'</div>';

    h+='</div></div></div>';
    $('interaction-area').innerHTML=h;
    requestAnimationFrame(function(){requestAnimationFrame(function(){var r=$('ev-ring');if(r)r.style.strokeDashoffset=off})});
}

function retryPresLine(){
    delete S.lineScores[S.currentLine];
    delete S.lineDetails[S.currentLine];
    delete S.audioClips[S.currentLine];
    S.userInput='';
    S.isProcessing=false;
    S.hintShown[S.currentLine]=false;
    S.presState=PS.HIDDEN;
    renderContext();
    renderIA();
}

function skipLine(){
    var idx = S.currentLine;
    S.userResponses[idx] = null;
    S.lineScores[idx] = null;
    if(idx >= S.lines.length - 1){
        if(S.mode === 'presentation') finishPresentation();
        else showReport();
        return;
    }
    S.currentLine = idx + 1;
    S.userInput = '';
    S.isProcessing = false;
    S.presState = PS.HIDDEN;
    renderSession();
}

/* ═══════════════════════════════════════════════════════════════
   PRACTICE MODE SUBMISSION
═══════════════════════════════════════════════════════════════ */
function handleSubmission(){
    var input=S.userInput.trim();
    if(!input){toast('Type or speak your response first.','info');return}
    if(S.isProcessing)return;
    S.isProcessing=true;
    renderIA();
    evalResponse(
        S.lines.slice(Math.max(0,S.currentLine-4),S.currentLine),
        S.lines[S.currentLine].text,
        input,
        false
    ).then(function(ev){
        if(S.mode==='practice'){
            /* Average all attempts for this line */
            if(!S.practiceScoreHistory[S.currentLine])S.practiceScoreHistory[S.currentLine]=[];
            S.practiceScoreHistory[S.currentLine].push(ev.score);
            var hist=S.practiceScoreHistory[S.currentLine];
            S.lineScores[S.currentLine]=Math.round(hist.reduce(function(a,b){return a+b},0)/hist.length);
            S.attemptCount[S.currentLine]=(S.attemptCount[S.currentLine]||0)+1;
        }else{
            S.lineScores[S.currentLine]=ev.score;
        }
        S.lineDetails[S.currentLine]=ev;
        S.userResponses[S.currentLine]=input;
        showPracticeEval(ev);
    }).catch(function(e){
        toast(e.message,'error');
        S.isProcessing=false;
        renderIA();
    });
}

function showPracticeEval(ev){
    S.isProcessing=false;
    var sc=ev.score,col=sc>=80?'#5BB882':sc>=50?'#E8B88A':'#D4736E';
    var lbl=sc>=80?'Excellent':sc>=50?'Good Effort':'Keep Practicing';
    var cw=ev.correct_words||'--';
    var isYes=cw.toLowerCase().indexOf('yes')!==-1;
    var C=326.73,off=C*(1-sc/100);
    var isLast=S.currentLine>=S.lines.length-1;

    var h='<div class="eval-in"><div class="flex items-start gap-4 sm:gap-5">'
        +'<div class="flex-shrink-0"><svg viewBox="0 0 120 120" width="88" height="88"><circle cx="60" cy="60" r="52" fill="none" class="score-ring-bg" stroke-width="8"/><circle id="ev-ring" cx="60" cy="60" r="52" fill="none" stroke="'+col+'" stroke-width="8" stroke-dasharray="'+C+'" stroke-dashoffset="'+C+'" stroke-linecap="round" transform="rotate(-90 60 60)" class="score-ring-fill"/><text x="60" y="52" text-anchor="middle" fill="var(--sf-fg)" font-size="26" font-weight="700" font-family="Space Grotesk">'+sc+'</text><text x="60" y="70" text-anchor="middle" fill="'+col+'" font-size="8" font-weight="600" letter-spacing=".5">'+lbl.toUpperCase()+'</text></svg></div>'
        +'<div class="flex-1 min-w-0 space-y-2">'
        +'<div class="egrid grid gap-2" style="grid-template-columns:repeat(3,1fr)">'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase">Accuracy</div><div class="text-xs text-sf-100 mt-0.5 leading-snug">'+esc(ev.accuracy)+'</div></div>'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase">Grammar</div><div class="text-xs text-sf-100 mt-0.5 leading-snug">'+esc(ev.grammar)+'</div></div>'
        +'<div class="bg-white/3 rounded-lg px-3 py-2"><div class="text-[10px] text-sf-300 font-semibold uppercase">Fluency</div><div class="text-xs text-sf-100 mt-0.5 leading-snug">'+esc(ev.fluency)+'</div></div>'
        +'</div>';
    h+='<div class="text-[10px] bg-white/2 rounded px-2 py-1.5 inline-flex items-center gap-2"><span class="text-sf-300">Correct Words:</span><span class="check-badge '+(isYes?'check-yes':'check-no')+' text-[11px]"><i class="fas '+(isYes?'fa-check':'fa-xmark')+'"></i>'+esc(cw)+'</span></div>';
    if(ev.encouragement)h+='<p class="text-sm text-sage-400"><i class="fas fa-heart mr-1.5 text-xs"></i>'+esc(ev.encouragement)+'</p>';
    if(ev.corrections&&ev.corrections.length){h+='<div><div class="text-[10px] text-coral-400 font-semibold uppercase mb-1">Corrections</div>';ev.corrections.forEach(function(c){h+='<li class="text-xs text-sf-200 list-none"><i class="fas fa-xmark text-coral-400 mr-1.5" style="font-size:10px"></i>'+esc(c)+'</li>'});h+='</div>'}
    if(ev.suggestions&&ev.suggestions.length){h+='<div><div class="text-[10px] text-copper-400 font-semibold uppercase mb-1">Tips</div>';ev.suggestions.forEach(function(sg){h+='<li class="text-xs text-sf-200 list-none"><i class="fas fa-lightbulb text-copper-400 mr-1.5" style="font-size:10px"></i>'+esc(sg)+'</li>'});h+='</div>'}
    if(ev.deliveryNotes&&ev.deliveryNotes.length){h+='<div><div class="text-[10px] text-sage-400 font-semibold uppercase mb-1">Delivery</div>';ev.deliveryNotes.forEach(function(n){h+='<li class="text-xs text-sf-200 list-none"><i class="fas fa-wave-square text-sage-400 mr-1.5" style="font-size:10px"></i>'+esc(n)+'</li>'});h+='</div>'}
    h+=renderWordDiffHTML(S.lines[S.currentLine].text,S.userResponses[S.currentLine]);
    if(S.mode==='practice'){
        /* Practice picker flow: Try Again stays on same line, Back to List returns to picker */
        h+='<div class="flex gap-2 mt-1">'
            +'<button onclick="retryCurrentPracticeLine()" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-sf-100 font-display font-semibold text-sm transition-all"><i class="fas fa-rotate-right mr-1.5"></i>Try Again</button>'
            +'<button onclick="returnToPracticeLinePicker()" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 font-display font-semibold text-sm hover:from-amber-400 hover:to-yellow-400 transition-all"><i class="fas fa-list mr-1.5"></i>Back to List</button>'
            +'</div>';
    }else{
        h+='<button onclick="advanceLine()" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 font-display font-semibold text-sm hover:from-amber-400 hover:to-yellow-400 transition-all mt-1">'+(isLast?'Finish Session':'Next Line')+' <i class="fas fa-arrow-right ml-2"></i></button>';
    }
    h+='</div></div></div>';

    $('interaction-area').innerHTML=h;
    requestAnimationFrame(function(){requestAnimationFrame(function(){var r=$('ev-ring');if(r)r.style.strokeDashoffset=off})});
}

/* ═══════════════════════════════════════════════════════════════
   ADVANCE / REPLAY / PLAY CLIP
═══════════════════════════════════════════════════════════════ */
function advanceLine(){
    stopSpeaking();
    if(S.currentLine>=S.lines.length-1){
        if(S.mode==='presentation'){finishPresentation();return}
        showReport();return;
    }
    S.currentLine++;
    S.userInput='';
    S.isProcessing=false;
    S.presState=PS.HIDDEN;
    renderSession();

    /* Practice mode: auto-speak NPC lines */
    if(isPracticeLikeMode()){
        var nextLine=S.lines[S.currentLine];
        if(nextLine&&!isUserRole(nextLine.role)){
            speak(nextLine.text,null,false);
        }
    }

    /* Presentation mode: continue the auto-flow */
    if(S.mode==='presentation'){
        setTimeout(presentationAutoFlow,400);
    }
}

function replayLine(i){var l=S.lines[i];if(l)speak(l.text,null,isUserRole(l.role))}

/* ═══════════════════════════════════════════════════════════════
   PRACTICE MODE — LINE PICKER FLOW
   Replaces linear session for S.mode==='practice'.
   Flow: renderPracticeLinePicker → selectLineForPractice → renderSession
         → showPracticeEval → returnToPracticeLinePicker / retryCurrentPracticeLine
         → endPractice → showReport
═══════════════════════════════════════════════════════════════ */
function renderPracticeLinePicker(){
    /* Collect user lines with their absolute indices */
    var userLines=[];
    S.lines.forEach(function(l,i){if(isUserRole(l.role))userLines.push({idx:i,text:l.text,role:l.role})});

    var practicedCount=Object.keys(S.lineScores).length;
    var total=userLines.length;

    /* Update header progress bar */
    $('progress-text').textContent=practicedCount+' / '+total+' practiced';
    $('progress-fill').style.width=(total>0?practicedCount/total*100:0)+'%';
    $('line-dots').classList.add('hidden');

    /* Build line list */
    var listHtml='<div class="px-1 pb-2">'
        +'<div class="flex items-center justify-between mb-3 px-1">'
        +'<div class="text-xs text-copper-400 font-semibold uppercase tracking-wide"><i class="fas fa-user mr-1.5"></i>'+esc(S.userRoles.join(' & '))+'\'s Lines</div>'
        +'<div class="text-xs text-sf-300">tap a line to practice</div>'
        +'</div>';

    userLines.forEach(function(li,n){
        var sc=S.lineScores[li.idx];
        var att=S.attemptCount[li.idx]||0;
        var hasPracticed=sc!=null;
        var scoreCol=sc>=80?'#5BB882':sc>=50?'#E8B88A':'#D4736E';
        var borderStyle=hasPracticed?'border-left:3px solid '+scoreCol+';padding-left:11px;':'';

        listHtml+='<div class="practice-line-item" style="'+borderStyle+'" onclick="selectLineForPractice('+li.idx+')">'
            +'<div class="pli-num">'+(n+1)+'</div>'
            +(S.userRoles.length>1?'<div class="text-[10px] text-sf-400 font-semibold mr-1.5 flex-shrink-0 self-start pt-[3px]">'+esc(li.role)+'</div>':'')
            +'<div class="pli-text">'+esc(li.text)+'</div>';

        if(hasPracticed){
            listHtml+='<div class="flex flex-col items-end gap-1 flex-shrink-0">'
                +'<div class="pli-score" style="background:'+scoreCol+'22;color:'+scoreCol+';border:1px solid '+scoreCol+'55">'+sc+'</div>'
                +(att>1?'<div class="text-[10px] text-sf-300">×'+att+'</div>':'')
                +'</div>';
        }
        listHtml+='</div>';
    });
    listHtml+='</div>';

    $('dialogue-context').innerHTML=listHtml;
    requestAnimationFrame(function(){$('dialogue-context').scrollTop=0});

    /* End Practice button */
    var allDone=practicedCount===total&&total>0;
    var btnLabel=practicedCount>0
        ?'End Practice  —  '+practicedCount+' of '+total+' lines done'
        :'End Practice';
    $('interaction-area').innerHTML='<div class="flex flex-col gap-3">'
        +'<p class="text-xs text-sf-300 text-center">Tap any line to practice it. You can repeat lines as many times as you want.</p>'
        +'<button onclick="endPractice()" class="w-full py-3 rounded-xl font-display font-semibold text-sm transition-all hover:opacity-90 active:scale-[.98]"'
        +' style="background:linear-gradient(135deg,rgba(212,115,110,.85),rgba(180,60,55,.85));color:#fff;border:1px solid rgba(212,115,110,.4)">'
        +'<i class="fas fa-flag-checkered mr-2"></i>'+btnLabel+'</button>'
        +'</div>';
}

function selectLineForPractice(absIdx){
    S.currentLine=absIdx;
    S.practicePickerActive=false;
    S.userInput='';
    S.isProcessing=false;
    S.presState=PS.HIDDEN;
    renderSession();
}

function returnToPracticeLinePicker(){
    stopSpeaking();
    if(S.isRecording)stopAllRec();
    S.practicePickerActive=true;
    S.userInput='';
    S.isProcessing=false;
    renderPracticeLinePicker();
}

function retryCurrentPracticeLine(){
    S.userInput='';
    S.isProcessing=false;
    renderIA();
}

function endPractice(){
    if(Object.keys(S.lineScores).length===0){
        toast('Practice at least one line before ending.','info');
        return;
    }
    stopSpeaking();
    if(S.isRecording)stopAllRec();
    showReport();
}
