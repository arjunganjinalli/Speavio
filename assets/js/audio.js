var voicesLoaded=false;
function loadV(){if(typeof speechSynthesis!=='undefined'&&speechSynthesis.getVoices().length>0)voicesLoaded=true}
if(typeof speechSynthesis!=='undefined'){speechSynthesis.onvoiceschanged=function(){voicesLoaded=true};loadV()}
function getVoice(lc){
    if(!voicesLoaded)loadV();
    var v=speechSynthesis.getVoices();
    if(!v.length)return null;
    var p=lc.split('-')[0];
    var candidates=v.filter(function(x){return x.lang===lc||x.lang.startsWith(p+'-')||x.lang===p});
    if(!candidates.length)return null;
    function score(name){
        if(/Enhanced|Premium/i.test(name))return 4;
        if(/Siri/i.test(name))return 3;
        if(/Natural/i.test(name))return 2;
        if(/Google/i.test(name))return 1;
        return 0;
    }
    return candidates.slice().sort(function(a,b){return score(b.name)-score(a.name)})[0];
}
function speak(text,onEnd,isUserLine){
    stopSpeaking();
    if(S.ttsProvider==='elevenlabs'&&S.elevenlabsKey){
        var vid=isUserLine&&S.clonedVoiceId?S.clonedVoiceId:S.elevenlabsVoiceId;
        speakEL(text,vid,onEnd,isUserLine);
    }else{
        speakBrowser(text,onEnd,isUserLine);
    }
}
function speakBrowser(text,onEnd,isUserLine){
    if(typeof speechSynthesis==='undefined'){if(onEnd)onEnd();return}
    speechSynthesis.cancel();
    /* Chrome bug workaround: small delay after cancel() before speak() */
    var lc=LANG[S.language];
    var parts=text.split(/([.!?]+)/);
    var sentences=[];
    for(var i=0;i<parts.length;i+=2){
        var s=(parts[i]+(parts[i+1]||'')).trim();
        if(s)sentences.push(s);
    }
    if(!sentences.length)sentences=[text];
    var idx=0;
    var slowNpc=S.npcSlowReplay&&!isUserLine;
    function speakNext(){
        if(idx>=sentences.length){S.isSpeaking=false;if(onEnd)onEnd();return}
        var u=new SpeechSynthesisUtterance(sentences[idx]);
        u.lang=lc.tts;
        var voice=getVoice(lc.tts);
        if(voice)u.voice=voice;
        u.rate=slowNpc?0.5:0.88;
        u.pitch=1.0;
        S.isSpeaking=true;
        u.onend=function(){idx++;if(idx<sentences.length){setTimeout(speakNext,120);}else{S.isSpeaking=false;if(onEnd)onEnd();}};
        u.onerror=function(){S.isSpeaking=false;if(onEnd)onEnd()};
        speechSynthesis.speak(u);
    }
    setTimeout(speakNext,100);
    return;
}

function speakEL(text,vid,onEnd,isUserLine){
    S.isSpeaking=true;
    fetch((S.apiProxy||API_PROXY)+encodeURIComponent('https://api.elevenlabs.io/v1/text-to-speech/'+vid),{
        method:'POST',
        headers:{'xi-api-key':S.elevenlabsKey,'Content-Type':'application/json'},
        body:JSON.stringify({text:text,model_id:'eleven_monolingual_v1',voice_settings:{stability:0.5,similarity_boost:0.75}})
    }).then(function(r){
        if(!r.ok)throw new Error('');
        return r.blob();
    }).then(function(blob){
        if(blob.size<100)throw new Error('');
        var u=URL.createObjectURL(blob);
        S.ttsAudio=new Audio(u);
        applyPreferredSpeaker(S.ttsAudio);
        if(S.npcSlowReplay&&!isUserLine)S.ttsAudio.playbackRate=0.5;
        S.ttsAudio.onended=function(){S.isSpeaking=false;URL.revokeObjectURL(u);if(onEnd)onEnd()};
        S.ttsAudio.onerror=function(){S.isSpeaking=false;URL.revokeObjectURL(u);speakBrowser(text,onEnd,isUserLine)};
        S.ttsAudio.play();
    }).catch(function(){S.isSpeaking=false;speakBrowser(text,onEnd,isUserLine)});
}
function applyPreferredSpeaker(audioElement){
    if(audioElement&&S.preferredSpeakerId&&typeof audioElement.setSinkId==='function'){
        audioElement.setSinkId(S.preferredSpeakerId).catch(function(err){
            console.warn('Could not select preferred speaker:',err);
        });
    }
    return audioElement;
}
function stopSpeaking(){
    if(S.ttsAudio){S.ttsAudio.pause();S.ttsAudio.currentTime=0;S.ttsAudio=null}
    if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
    S.isSpeaking=false;
}

function playRecCue(kind){
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    var ctx=new AC();
    function beep(freq,start,duration){
        var osc=ctx.createOscillator();
        var gain=ctx.createGain();
        osc.type='sine';
        osc.frequency.setValueAtTime(freq,start);
        gain.gain.setValueAtTime(0.0001,start);
        gain.gain.exponentialRampToValueAtTime(0.06,start+0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start+duration);
    }
    var now=ctx.currentTime;
    if(kind==='start'){
        beep(660,now,0.08);
        beep(880,now+0.09,0.08);
    }else{
        beep(620,now,0.09);
    }
    setTimeout(function(){try{ctx.close()}catch(e){}},250);
}

/* ── Track blob URLs for cleanup ── */
var _reportBlobURLs=[];
function revokeReportBlobs(){
    _reportBlobURLs.forEach(function(u){try{URL.revokeObjectURL(u)}catch(e){}});
    _reportBlobURLs=[];
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA RECORDER
═══════════════════════════════════════════════════════════════ */
function getMime(){
    var t=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];
    for(var i=0;i<t.length;i++){if(typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(t[i]))return t[i]}
    return '';
}
function startMR(stream){
    S.audioStream=stream;
    var m=getMime();
    var lineIdx=S.currentLine;
    S.mediaRecorder=new MediaRecorder(stream,m?{mimeType:m}:undefined);
    S.audioChunks=[];
    S.mediaRecorder.ondataavailable=function(e){if(e.data.size>0)S.audioChunks.push(e.data)};
    S.mediaRecorder.onstop=function(){
        if(S.audioChunks.length)
            S.audioClips[lineIdx]=new Blob(S.audioChunks,{type:S.mediaRecorder.mimeType||'audio/webm'});
    };
    S.mediaRecorder.start();
}
function stopMR(){
    if(S.mediaRecorder&&S.mediaRecorder.state!=='inactive'){
        try{S.mediaRecorder.stop()}catch(e){}
    }
    /* Do NOT kill the mic stream tracks here — reuse them across recordings */
    S.audioStream=null;
}

/* ═══════════════════════════════════════════════════════════════
   SILENCE DETECTION — RMS of time-domain audio
   Stops recording after SILENCE_FRAMES consecutive frames below SILENCE_THRESH
═══════════════════════════════════════════════════════════════ */
function startSilenceDetection(stream){
    try{
        S.audioContext=new(window.AudioContext||window.webkitAudioContext)();
        S.analyser=S.audioContext.createAnalyser();
        S.analyser.fftSize=1024;
        S.analyser.smoothingTimeConstant=0.2;
        S.audioContext.createMediaStreamSource(stream).connect(S.analyser);
        S.silenceFrames=0;
        S.recordStartTime=Date.now();
        S.currentRMS=0;
        S._speechDetected=false;
        S._speechFrames=0;
        S._noiseFloor=0;
        S._calibrated=false;
        S._calibrationSamples=[];

        var timeBuf=new Uint8Array(S.analyser.fftSize);

        S.silenceInterval=setInterval(function(){
            if(!S.isRecording){stopSilenceDetection();return}

            S.analyser.getByteTimeDomainData(timeBuf);
            var sumSq=0;
            for(var i=0;i<timeBuf.length;i++){
                var n=(timeBuf[i]-128)/128.0;
                sumSq+=n*n;
            }
            var rms=Math.sqrt(sumSq/timeBuf.length);
            S.currentRMS=rms;

            /* Update vol bar always */
            var vb=document.getElementById('vol-fill');
            if(vb){var pct=Math.min(100,rms*600);vb.style.width=pct+'%'}

            /* ── CALIBRATION: first 600ms, measure background noise floor ── */
            if(!S._calibrated){
                S._calibrationSamples.push(rms);
                if(S._calibrationSamples.length>=12){
                    var sum=0;
                    for(var ci=0;ci<S._calibrationSamples.length;ci++)sum+=S._calibrationSamples[ci];
                    S._noiseFloor=sum/S._calibrationSamples.length;
                    /* Clamp noise floor to reasonable range */
                    S._noiseFloor=Math.max(0.003,Math.min(S._noiseFloor,0.05));
                    /* Speech threshold: 3.5x noise floor, clamped */
                    S.SPEECH_THRESH=Math.max(0.008,Math.min(S._noiseFloor*3.5,0.08));
                    /* Silence threshold: 1.8x noise floor, clamped */
                    S.SILENCE_THRESH=Math.max(0.005,Math.min(S._noiseFloor*1.8,0.045));
                    S._calibrated=true;
                    /* Reset timer so MIN_REC_MS starts after calibration */
                    S.recordStartTime=Date.now();
                }
                return;
            }

            /* ── SPEECH DETECTION using calibrated threshold ── */
            if(rms>=S.SPEECH_THRESH){
                S._speechFrames++;
                if(S._speechFrames>=6&&!S._speechDetected){
                    S._speechDetected=true;
                    S.speechDetected=true;
                    if(typeof renderIA==='function')renderIA();
                }
            }else{
                S._speechFrames=0;
            }

            /* Don't check silence in first MIN_REC_MS after calibration */
            if(Date.now()-S.recordStartTime<S.MIN_REC_MS){S.silenceFrames=0;return}

            /* Only count silence after actual speech detected */
            if(!S._speechDetected){S.silenceFrames=0;return}

            if(rms<S.SILENCE_THRESH){S.silenceFrames++;}else{S.silenceFrames=0;}

            /* Update countdown */
            var sc=document.getElementById('sil-count');
            if(sc){
                var remain=Math.max(0,Math.ceil((S.SILENCE_FRAMES-S.silenceFrames)*50/1000));
                sc.textContent=remain+'s';
            }

            if(S.silenceFrames>=S.SILENCE_FRAMES){
                stopAllRec();
            }
        },50);
    }catch(e){
        console.warn('Silence detection unavailable:',e);
        S._recSafetyTimeout=setTimeout(function(){
            if(S.isRecording){toast('Auto-stopped: no silence detection available.','info');stopAllRec()}
        },30000);
    }
}
function stopSilenceDetection(){
    clearInterval(S.silenceInterval);
    S.silenceInterval=null;
    S.silenceFrames=0;
    S.currentRMS=0;
    clearTimeout(S._recSafetyTimeout);
    S._recSafetyTimeout=null;
    if(S.audioContext){try{S.audioContext.close()}catch(e){}S.audioContext=null;S.analyser=null}
}

/* ═══════════════════════════════════════════════════════════════
   SPEECH RECOGNITION
═══════════════════════════════════════════════════════════════ */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;

/* ── Get mic stream ONCE and reuse it for the whole session ── */
function ensureMicStream(){
    /* If we already have a live stream, reuse it */
    if(S._micStream&&S._micStream.active)return Promise.resolve(S._micStream);
    /* Otherwise request a fresh one */
    var audioConstraints=S.preferredMicId?{deviceId:{exact:S.preferredMicId}}:true;
    return navigator.mediaDevices.getUserMedia({audio:audioConstraints}).then(function(stream){
        S._micStream=stream;
        return stream;
    });
}
function releaseMicStream(){
    if(S._micStream){
        S._micStream.getTracks().forEach(function(t){t.stop()});
        S._micStream=null;
    }
}

function startRec(){
    if(!SR){toast('Speech recognition not supported in this browser.','error');return}
    if(S.isRecording){stopAllRec();return}
    if(S.isSpeaking)stopSpeaking();

    S.recognition=new SR();
    S.recognition.lang=LANG[S.language].stt;
    S.recognition.continuous=true;
    S.recognition.interimResults=true;
    S.recognition.maxAlternatives=1;
    S.speechDetected=false;
    S.isRecording=true;
    S.userInput='';
    S.presState=PS.REC;
    renderIA();

    /* Reuse stored mic stream — avoids re-asking for permission every time */
    ensureMicStream().then(function(stream){
        startMR(stream);
        startSilenceDetection(stream);
        playRecCue('start');

        S.recognition.onresult=function(e){
            var t='';
            for(var i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;
            S.userInput=t;
            var li=document.getElementById('live-text');
            if(li)li.textContent=t;
        };

        S.recognition.onend=function(){
            if(!S.isRecording)return; /* already handled by stopAllRec */
            finishRecording();
        };

        S.recognition.onerror=function(e){
            if(!S.isRecording)return;
            if(e.error==='no-speech'){/* let silence detection handle it */return}
            if(e.error==='not-allowed')toast('Microphone access denied.','error');
            else if(e.error!=='aborted')toast('Recognition error: '+e.error,'error');
            finishRecording();
        };

        try{S.recognition.start()}
        catch(e){
            S.isRecording=false;
            stopMR();
            stopSilenceDetection();
            toast('Could not start recognition.','error');
            S.presState=PS.HINT;
            renderIA();
        }
    }).catch(function(){
        S.isRecording=false;
        S._micStream=null; /* stream is dead, force re-request next time */
        toast('Microphone access denied. Please allow mic access in your browser settings.','error');
        S.presState=PS.HINT;
        renderIA();
    });
}

function finishRecording(){
    S.isRecording=false;
    stopSilenceDetection();
    stopMR();
    playRecCue('stop');
    S.userResponses[S.currentLine]=S.userInput.trim()||null;

    var _wordCount=S.userInput.trim().split(/\s+/).filter(Boolean).length;
    if(S.mode==='presentation'){
        if(S._speechDetected&&_wordCount>=2){
            /* Auto-flow: save response, advance to next line */
            S.attemptCount[S.currentLine]=(S.attemptCount[S.currentLine]||0)+1;
            if(S.currentLine>=S.lines.length-1){
                finishPresentation();
            }else{
                advanceLine();
            }
        }else{
            S.presState=PS.HINT;
            renderIA();
        }
    }else{
        /* Practice mode */
        if(S._speechDetected&&_wordCount>=2){
            handleSubmission();
        }else{
            S.presState=PS.HINT;
            renderIA();
        }
    }
}

function stopAllRec(){
    if(!S.isRecording)return;
    S.isRecording=false;
    stopSilenceDetection();
    try{if(S.recognition)S.recognition.stop()}catch(e){}
    stopMR();
    playRecCue('stop');
    S.userResponses[S.currentLine]=S.userInput.trim()||null;

    var _wordCount=S.userInput.trim().split(/\s+/).filter(Boolean).length;
    if(S.mode==='presentation'){
        if(S._speechDetected&&_wordCount>=2){
            /* Auto-flow: save response, advance to next line */
            S.attemptCount[S.currentLine]=(S.attemptCount[S.currentLine]||0)+1;
            if(S.currentLine>=S.lines.length-1){
                finishPresentation();
            }else{
                advanceLine();
            }
        }else{
            S.presState=PS.HINT;
            renderIA();
        }
    }else{
        if(S._speechDetected&&_wordCount>=2){handleSubmission()}
        else{S.presState=PS.HINT;renderIA();}
    }
}

/* ── Called by the 7-second no-speech UI timer ── */
function handleNoSpeechTimeout(){
    if(!S.isRecording)return;
    S.isRecording=false;
    stopSilenceDetection();
    try{if(S.recognition)S.recognition.stop()}catch(e){}
    stopMR();
    playRecCue('stop');
    S.speechDetected=false;
    S._speechDetected=false;
    S._speechFrames=0;
    if(typeof skipLine==='function')skipLine();
}

/* ═══════════════════════════════════════════════════════════════
   JSON EXTRACTOR — Sanitizes AI responses before parsing
   Handles: markdown code blocks, leading text, nested JSON, etc.
═══════════════════════════════════════════════════════════════ */
