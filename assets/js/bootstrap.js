/* ═══════════════════════════════════════════════════════════════
    EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',function(){
    var appInitialized=false;
    var systemThemeListenerBound=false;
    var authPendingTimer=null;
    var authDebugEnabled=/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    var onboardingSteps=[
        {title:'Welcome to SpeakFlow',body:'Use the top tabs to switch between Practice, Presentation, and Settings.'},
        {title:'Start Fast',body:'Paste a script, pick your role, and start. Choose Practice for guided coaching or Presentation for full delivery mode.'},
        {title:'Practice Controls',body:'In session, press Space to start/stop recording and Enter to submit your line.'},
        {title:'Reports and Progress',body:'After each session, review line scores, bookmark hard lines, share scorecards, and export PDF/JSON.'}
    ];
    var onboardingIndex=0;

    function renderOnboardingStep(){
        var s=onboardingSteps[onboardingIndex];
        if(!s)return;
        $('onboarding-title').textContent=s.title;
        $('onboarding-body').textContent=s.body;
        $('onboarding-step').textContent='Step '+(onboardingIndex+1)+' of '+onboardingSteps.length;
        var prevBtn=$('onboarding-prev-btn');
        var nextBtn=$('onboarding-next-btn');
        if(prevBtn){
            prevBtn.disabled=onboardingIndex===0;
            prevBtn.setAttribute('aria-disabled',prevBtn.disabled?'true':'false');
        }
        if(nextBtn){
            nextBtn.disabled=false;
            nextBtn.setAttribute('aria-disabled','false');
            nextBtn.textContent=onboardingIndex===onboardingSteps.length-1?'Finish':'Next';
        }
        $('onboarding-dots').innerHTML=onboardingSteps.map(function(_,i){
            return '<span class="onboarding-dot '+(i===onboardingIndex?'active':'')+'"></span>';
        }).join('');
    }

    function openOnboarding(force){
        if(!force&&readStoreJSON(STORAGE_KEYS.onboardingDone,false))return;
        onboardingIndex=0;
        renderOnboardingStep();
        $('onboarding-overlay').classList.add('open');
        $('onboarding-overlay').setAttribute('aria-hidden','false');
        setTimeout(function(){
            var nextBtn=$('onboarding-next-btn');
            if(nextBtn)nextBtn.focus();
        },80);
    }

    function closeOnboarding(markDone){
        $('onboarding-overlay').classList.remove('open');
        $('onboarding-overlay').setAttribute('aria-hidden','true');
        if(markDone)writeStoreJSON(STORAGE_KEYS.onboardingDone,true);
    }

    function goOnboardingPrev(e){
        if(e){
            e.preventDefault();
            e.stopPropagation();
        }
        if(onboardingIndex>0){
            onboardingIndex--;
            renderOnboardingStep();
        }
    }

    function goOnboardingNext(e){
        if(e){
            e.preventDefault();
            e.stopPropagation();
        }
        if(onboardingIndex>=onboardingSteps.length-1){
            closeOnboarding(true);
            return;
        }
        onboardingIndex++;
        renderOnboardingStep();
    }

    function setAuthStatus(msg,isError){
        var el=$('auth-status');
        if(!el)return;
        el.textContent=msg||'';
        el.className='text-xs mt-4 min-h-[1rem] '+(isError?'text-coral-400':'text-sf-300');
    }

    function setAuthDebug(msg,isError){
        var el=$('auth-debug');
        if(!el)return;
        if(!authDebugEnabled){
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        el.textContent=msg||'';
        el.className='text-[11px] mt-2 min-h-[1rem] '+(isError?'text-coral-400':'text-sf-300');
    }

    function clearAuthPendingTimer(){
        if(authPendingTimer){
            clearTimeout(authPendingTimer);
            authPendingTimer=null;
        }
    }

    function renderAuthIdentity(user){
        var name=(user&&(user.displayName||user.email))?String(user.displayName||user.email):'Signed in';
        var photo=user&&user.photoURL?String(user.photoURL):'';

        if($('setup-user-name'))$('setup-user-name').textContent=name;
        if($('session-user-name'))$('session-user-name').textContent=name;

        [['setup-user-photo',$('setup-user-photo')],['session-user-photo',$('session-user-photo')]].forEach(function(pair){
            var img=pair[1];
            if(!img)return;
            if(photo){img.src=photo;img.classList.remove('hidden')}
            else{img.src='';img.classList.add('hidden')}
        });
    }

    function showSignedOutScreen(){
        clearAuthPendingTimer();
        S.isAuthenticated=false;
        S.authUser=null;
        setAuthDebug('Auth state: signed out');
        renderAuthIdentity(null);
        closeOnboarding(false);
        if($('assist-panel')){$('assist-panel').classList.remove('open');$('assist-panel').classList.add('hidden')}
        if($('assist-fab'))$('assist-fab').classList.add('hidden');
        switchScreen('login');
    }

    function runAuthenticatedStartup(){
        switchScreen('setup');
        applySystemLanguage();
        S.uiTheme=readStoreJSON(STORAGE_KEYS.uiTheme,'system');
        applyThemePreference();
        if(window.matchMedia&&!systemThemeListenerBound){
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',function(){
                if(S.uiTheme==='system')applyThemePreference();
            });
            systemThemeListenerBound=true;
        }
        refreshAdvancedState();
        refreshHomeProgressSnapshot();
        showSetupTab('home');
        renderScriptLibraryOptions();
        renderAllHintPills();
        renderSetupDifficultyBadge();
        setTimeout(function(){openOnboarding(false)},350);
    }

    function handleAuthenticatedUser(user){
        clearAuthPendingTimer();
        S.authReady=true;
        S.isAuthenticated=true;
        S.authUser={
            uid:user.uid||'',
            displayName:user.displayName||'',
            email:user.email||'',
            photoURL:user.photoURL||''
        };
        renderAuthIdentity(S.authUser);
        setAuthStatus('');
        setAuthDebug('Auth state: signed in '+(S.authUser.uid?('('+S.authUser.uid.slice(0,8)+'...)'):'(no uid)'));
        if($('assist-panel'))$('assist-panel').classList.remove('hidden');
        if($('assist-fab'))$('assist-fab').classList.remove('hidden');

        if(!appInitialized){
            runAuthenticatedStartup();
            appInitialized=true;
        }else{
            switchScreen('setup');
            showSetupTab('home');
        }
    }

    function signOutUser(){
        if(typeof firebase==='undefined'||!firebase.auth){
            toast('Firebase Auth is unavailable.','error');
            return;
        }
        setAuthDebug('Sign out requested');
        firebase.auth().signOut().catch(function(err){
            toast((err&&err.message)||'Sign out failed.','error');
            setAuthDebug('Sign out failed: '+((err&&err.code)||'unknown'),true);
        });
    }

    $('api-key').oninput=function(e){
        S.apiKey=e.target.value.trim();
        _workingModel=null;
        refreshAdvancedState();
    };
    $('model-input').oninput=function(e){S.apiModel=e.target.value.trim();_workingModel=null};
    $('api-proxy').oninput=function(e){S.apiProxy=e.target.value.trim()||API_PROXY};
    $('api-endpoint').oninput=function(e){S.apiEndpoint=e.target.value.trim();_workingModel=null};
    $('premium-toggle').onchange=function(e){S.premiumPlaceholder=!!e.target.checked};
    $('system-language-select').onchange=function(e){S.systemLanguage=e.target.value;applySystemLanguage()};
    $('language-select-practice').onchange=function(e){S.language=e.target.value;syncScriptLanguageSelects()};
    $('language-select-presentation').onchange=function(e){S.language=e.target.value;syncScriptLanguageSelects()};
    if($('el-key'))$('el-key').oninput=function(){S.elevenlabsKey=$('el-key').value.trim()};
    if($('el-voice-select'))$('el-voice-select').onchange=function(){S.elevenlabsVoiceId=$('el-voice-select').value};
    if($('npc-slow-replay'))$('npc-slow-replay').onchange=function(e){S.npcSlowReplay=!!e.target.checked};

    document.querySelectorAll('.setup-tab-btn').forEach(function(btn){
        btn.onclick=function(){showSetupTab(btn.dataset.tab)};
    });

    $('api-key').value=S.apiKey;
    $('model-input').value=S.apiModel||MODEL;
    $('api-proxy').value=S.apiProxy||API_PROXY;
    $('api-endpoint').value=S.apiEndpoint;
    $('system-language-select').value=S.systemLanguage;
    $('premium-toggle').checked=!!S.premiumPlaceholder;
    syncScriptLanguageSelects();

    var pt;
    $('script-input').oninput=function(){
        S.scriptSource='manual';
        S.scriptLabel='Manual Script';
        S.scriptRef='';
        clearTimeout(pt);
        pt=setTimeout(updateParse,350);
    };
    $('load-example').onclick=function(){
        $('script-input').value=EXAMPLE;
        S.language='en';
        syncScriptLanguageSelects();
        updateParse();
        toast('Example dialogue loaded.','success');
    };
    if($('copy-script-btn'))$('copy-script-btn').onclick=function(){
        var text=($('script-input').value||'').trim();
        if(!text){toast('No script to copy.','info');return}
        function fallbackCopy(v){
            var ta=document.createElement('textarea');
            ta.value=v;
            ta.setAttribute('readonly','readonly');
            ta.style.position='fixed';
            ta.style.opacity='0';
            document.body.appendChild(ta);
            ta.select();
            try{document.execCommand('copy');toast('Script copied.','success')}catch(err){toast('Copy failed.','error')}
            document.body.removeChild(ta);
        }
        if(navigator.clipboard&&navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(function(){toast('Script copied.','success')}).catch(function(){fallbackCopy(text)});
        }else{
            fallbackCopy(text);
        }
    };
    if($('save-script-btn'))$('save-script-btn').onclick=saveCurrentScriptToLibrary;
    if($('load-script-btn'))$('load-script-btn').onclick=loadSelectedScriptFromLibrary;
    if($('delete-script-btn'))$('delete-script-btn').onclick=deleteSelectedScriptFromLibrary;
    if($('theme-toggle-btn'))$('theme-toggle-btn').onclick=cycleTheme;
    if($('theme-quick-btn'))$('theme-quick-btn').onclick=cycleTheme;
    if($('replay-onboarding-btn'))$('replay-onboarding-btn').onclick=function(){openOnboarding(true)};
    if($('onboarding-close-btn'))$('onboarding-close-btn').onclick=function(){closeOnboarding(true)};
    if($('onboarding-prev-btn'))$('onboarding-prev-btn').addEventListener('click',goOnboardingPrev);
    if($('onboarding-next-btn'))$('onboarding-next-btn').addEventListener('click',goOnboardingNext);
    if($('onboarding-overlay'))$('onboarding-overlay').onclick=function(e){if(e.target===this)closeOnboarding(true)};
    if($('setup-signout-btn'))$('setup-signout-btn').onclick=signOutUser;
    if($('session-signout-btn'))$('session-signout-btn').onclick=signOutUser;

    $('start-btn').onclick=startSession;
    $('help-btn').onclick=openHelp;
    $('assist-fab').onclick=function(){toggleAssistant(true)};
    $('assist-close').onclick=function(){toggleAssistant(false)};
    $('assist-send').onclick=sendAssistantMessage;
    $('assist-input').onkeydown=function(e){if(e.key==='Enter')sendAssistantMessage()};
    $('back-btn').onclick=function(){
        stopSpeaking();
        S.isRecording=false;
        stopSilenceDetection();
        try{if(S.recognition)S.recognition.stop()}catch(e){}
        stopMR();
        releaseMicStream();
        switchScreen('setup');
        showSetupTab('home');
    };

    function isTypingTarget(el){
        if(!el)return false;
        var tag=(el.tagName||'').toLowerCase();
        return tag==='input'||tag==='textarea'||el.isContentEditable;
    }

    document.onkeydown=function(e){
        if(e.key==='Escape'&&S.screen==='session'){
            stopSpeaking();
            S.isRecording=false;
            stopSilenceDetection();
            try{if(S.recognition)S.recognition.stop()}catch(e){}
            stopMR();
            releaseMicStream();
            switchScreen('setup');
            showSetupTab('home');
            return;
        }

        if(S.screen!=='session'||isTypingTarget(e.target))return;

        if(e.code==='Space'){
            e.preventDefault();
            if(S.isProcessing)return;
            if(S.isRecording)stopAllRec();
            else startRec();
            return;
        }

        if(e.key==='Enter'){
            var line=S.lines[S.currentLine];
            if(!line||S.userRoles.indexOf(line.role)===-1||S.isRecording||S.isProcessing)return;
            e.preventDefault();
            handleSubmission();
        }
    };

    S.uiTheme=readStoreJSON(STORAGE_KEYS.uiTheme,'system');
    applyThemePreference();
    if(authDebugEnabled)setAuthDebug('Debug enabled on '+window.location.protocol+'//'+window.location.host);

    if(typeof firebase==='undefined'||!firebase.auth){
        setAuthStatus('Firebase Auth SDK failed to load.',true);
        setAuthDebug('Firebase auth SDK missing',true);
        return;
    }

    function setAuthButtonsDisabled(disabled){
        ['google-signin-btn','email-signin-btn','email-create-btn'].forEach(function(id){
            var btn=$(id);
            if(btn)btn.disabled=!!disabled;
        });
    }

    function readEmailAuthFields(){
        var emailInput=$('email-auth-input');
        var passwordInput=$('password-auth-input');
        return {
            email:emailInput?String(emailInput.value||'').trim():'',
            password:passwordInput?String(passwordInput.value||''):''
        };
    }

    function mapEmailAuthError(err,isCreate){
        var code=err&&err.code?String(err.code):'';
        if(code==='auth/invalid-email')return 'Enter a valid email in the username/email field.';
        if(code==='auth/user-not-found'||code==='auth/wrong-password'||code==='auth/invalid-credential')return 'Invalid email or password.';
        if(code==='auth/weak-password')return 'Password should be at least 6 characters.';
        if(code==='auth/email-already-in-use')return 'That email is already registered. Try Sign In.';
        if(code==='auth/too-many-requests')return 'Too many attempts. Please wait a bit and try again.';
        if(code==='auth/operation-not-allowed')return isCreate?'Email/password sign-up is disabled in Firebase Auth settings.':'Email/password sign-in is disabled in Firebase Auth settings.';
        return (err&&err.message)||'Authentication failed.';
    }

    function beginEmailPasswordAuth(isCreate){
        var fields=readEmailAuthFields();
        if(!fields.email||!fields.password){
            setAuthStatus('Enter username/email and password first.',true);
            return;
        }
        if(fields.email.indexOf('@')===-1){
            setAuthStatus('Use a valid email address in the username/email field.',true);
            return;
        }

        setAuthButtonsDisabled(true);
        setAuthStatus(isCreate?'Creating account...':'Signing in...');
        setAuthDebug((isCreate?'Create account':'Email sign-in')+' requested for '+fields.email);

        var auth=firebase.auth();
        var promise=isCreate
            ?auth.createUserWithEmailAndPassword(fields.email,fields.password)
            :auth.signInWithEmailAndPassword(fields.email,fields.password);

        return promise.catch(function(err){
            setAuthStatus(mapEmailAuthError(err,isCreate),true);
            setAuthDebug('Email/password auth failed: '+((err&&err.code)||'unknown'),true);
            setAuthButtonsDisabled(false);
        });
    }

    function beginGoogleSignIn(){
        var provider=new firebase.auth.GoogleAuthProvider();
        setAuthButtonsDisabled(true);
        setAuthStatus('Opening Google Sign-In...');
        setAuthDebug('Popup sign-in requested');
        clearAuthPendingTimer();
        authPendingTimer=setTimeout(function(){
            if(!S.isAuthenticated){
                setAuthStatus('Waiting for Google Sign-In completion. If no popup appears, allow popups or try again.',true);
                setAuthDebug('Popup still pending after 12s',true);
            }
        },12000);
        return firebase.auth().signInWithPopup(provider).catch(function(err){
            setAuthButtonsDisabled(false);
            if(err&&err.code==='auth/popup-closed-by-user'){
                setAuthStatus('Sign-in canceled.',true);
                setAuthDebug('Popup canceled by user',true);
                return;
            }
            if(err&&err.code==='auth/operation-not-supported-in-this-environment'){
                setAuthStatus('Google Sign-In needs http:// or https://. Run this app from a local server.',true);
                setAuthDebug('Protocol unsupported for popup flow',true);
                return;
            }
            if(err&&(err.code==='auth/popup-blocked'||err.code==='auth/cancelled-popup-request')){
                setAuthStatus('Popup blocked. Redirecting to Google Sign-In...');
                setAuthDebug('Popup blocked; redirect fallback started');
                return firebase.auth().signInWithRedirect(provider);
            }
            if(err&&err.message&&/Cross-Origin-Opener-Policy|window\.closed/i.test(err.message)){
                setAuthStatus('Popup handshake failed in this environment. Redirecting to Google Sign-In...');
                setAuthDebug('Popup handshake error; redirect fallback started');
                return firebase.auth().signInWithRedirect(provider);
            }
            setAuthStatus((err&&err.message)||'Sign-in failed.',true);
            setAuthDebug('Sign-in failed: '+((err&&err.code)||'unknown'),true);
        });
    }

    if($('google-signin-btn'))$('google-signin-btn').onclick=function(){
        beginGoogleSignIn();
    };
    if($('email-signin-btn'))$('email-signin-btn').onclick=function(){
        beginEmailPasswordAuth(false);
    };
    if($('email-create-btn'))$('email-create-btn').onclick=function(){
        beginEmailPasswordAuth(true);
    };

    firebase.auth().getRedirectResult().then(function(res){
        clearAuthPendingTimer();
        if(res&&res.user){
            setAuthStatus('Sign-in complete. Loading your workspace...');
            setAuthDebug('Redirect sign-in success');
            return;
        }
        setAuthButtonsDisabled(false);
        setAuthDebug('Redirect sign-in: no pending result');
    }).catch(function(err){
        clearAuthPendingTimer();
        setAuthButtonsDisabled(false);
        setAuthStatus((err&&err.message)||'Redirect sign-in failed.',true);
        setAuthDebug('Redirect sign-in failed: '+((err&&err.code)||'unknown'),true);
    });

    firebase.auth().onAuthStateChanged(function(user){
        setAuthButtonsDisabled(false);
        if(user){
            handleAuthenticatedUser(user);
            return;
        }
        showSignedOutScreen();
    });
});

