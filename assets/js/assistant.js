function pushAssistantMessage(role,text){
    var msgs=$('assist-msgs');
    if(!msgs)return;
    var b=document.createElement('div');
    b.className='assist-bubble '+(role==='user'?'assist-user':'assist-bot');
    b.textContent=text;
    msgs.appendChild(b);
    msgs.scrollTop=msgs.scrollHeight;
}

function getLocalAssistantReply(q){
    var t=q.toLowerCase();
    if(/home|main|start/.test(t))return 'Go to Home to get quick orientation. It explains Basic vs Advanced mode and gives one-click shortcuts.';
    if(/practice/.test(t))return 'Open the Practice tab, paste your script, choose your role, and click Start Practice.';
    if(/presentation|hint/.test(t))return 'Open Presentation, choose hint level (Full, Word, Off), then start. Lines are hidden first for recall training.';
    if(/settings|api|key|model|endpoint/.test(t))return 'Open Settings to add your optional API key, model, and endpoint. Without a key, the app still runs in Basic mode.';
    if(/chatbot|assistant|help/.test(t))return 'I can guide navigation, explain features, and answer setup questions. Add an API key in Settings for free-form AI answers.';
    if(/score|evaluate|accuracy/.test(t))return 'AI scoring is an advanced feature with API key. In Basic mode, Voqua uses local word-match feedback.';
    return 'Try asking about Home, Practice, Presentation, Settings, API setup, or scoring. I can help you find anything quickly.';
}

function toggleAssistant(open){
    var panel=$('assist-panel');
    var shouldOpen=(typeof open==='boolean')?open:!panel.classList.contains('open');
    panel.classList.toggle('open',shouldOpen);
    if(shouldOpen&&$('assist-msgs').children.length===0){
        pushAssistantMessage('bot',S.systemLanguage==='es'
            ?'Hola, soy tu asistente de Voqua. Preguntame donde estan las funciones o como funcionan los modos.'
            :'Hi, I am your Voqua assistant. Ask me where to find features or how modes work.');
    }
    if(shouldOpen)$('assist-input').focus();
}

function sendAssistantMessage(){
    var inp=$('assist-input');
    var q=inp.value.trim();
    if(!q)return;
    inp.value='';
    pushAssistantMessage('user',q);

    if(!S.apiKey){
        pushAssistantMessage('bot',getLocalAssistantReply(q));
        return;
    }

    pushAssistantMessage('bot','Thinking...');
    var botNode=$('assist-msgs').lastElementChild;
    callGLM([
        {role:'system',content:'You are Voqua Assistant. Help users navigate Home, Practice, Presentation, and Settings. Keep answers concise and practical.'},
        {role:'user',content:q}
    ],280).then(function(resp){
        botNode.textContent=resp.trim()||'I could not generate a response. Try again.';
    }).catch(function(){
        botNode.textContent=getLocalAssistantReply(q);
    });
}

