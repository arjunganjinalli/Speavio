/* ═══════════════════════════════════════════════════════════════
   CONFIG — Change these to match your provider
═══════════════════════════════════════════════════════════════ */
/*
   ┌──────────────────────────────────────────────────────────┐
   │  MODEL — Change ONE word to switch AI providers:        │
   │                                                          │
   │  GLM (z.ai):   glm-4-air, glm-4-air-x, glm-4-plus,     │
   │                 glm-4-flash, glm-4-long, glm-3-turbo     │
   │  OpenAI:       gpt-4o, gpt-4o-mini, gpt-3.5-turbo      │
   │  Anthropic:    claude-3-sonnet (via compatible proxy)   │
   │  Groq:         llama-3.3-70b-versatile, mixtral-8x7b   │
   │  DeepSeek:     deepseek-chat, deepseek-reasoner         │
   └──────────────────────────────────────────────────────────┘
*/
var MODEL = 'glm-4-air';

/*
   MODEL_FALLBACK — If MODEL fails with "Unknown Model", the app
   automatically tries each model in this list until one works.
   The working model is cached for the rest of the session.
*/
var MODEL_FALLBACK = [
    'glm-4-air', 'glm-4-air-x', 'glm-4-plus', 'glm-4-flash',
    'glm-4-long', 'glm-4v', 'glm-3-turbo'
];
var _workingModel = null; /* cached once a working model is found */

/*
   API_PROXY — URL of your server-side proxy.
    Default: '/api/chat' (adjust in Settings for your backend route)
   This proxy forwards requests to your configured AI provider endpoint.
*/
var API_PROXY = '/api/chat';

var STORAGE_KEYS={
    sessions:'speakflow_sessions',
    scripts:'speakflow_scripts',
    bookmarks:'speakflow_bookmarks',
    assignments:'speakflow_assignments',
    assignmentsMap:'speakflow_assignments_map',
    assignmentRecent:'speakflow_assignments_recent',
    leaderboard:'speakflow_leaderboard',
    uiTheme:'speakflow_ui_theme',
    onboardingDone:'speakflow_onboarding_done'
};

var UI_TEXT={
    en:{
        navHome:'Home',navPractice:'Practice',navAssignment:'Assignment',navPresentation:'Presentation',navSettings:'Settings',
        homeQuickTitle:'Get Around Quickly',homeQuickBody:'Use the header tabs like GitHub navigation. Start in Practice or Presentation, then tune AI keys in Settings.',
        homeGoPractice:'Go to Practice',homeGoAssignment:'Go to Assignment',homeGoPresentation:'Go to Presentation',homeOpenSettings:'Open Settings',
        homeModeTitle:'Basic vs Advanced',homeModeBody:'Basic mode works without API keys. Add any OpenAI-compatible API key in Settings to unlock advanced AI features.',
        homeHelpTitle:'Need Help?',homeHelpBody:'Use the assistant bubble in the bottom-right to ask where features are, what each mode does, and how to configure advanced setup.',
        scriptLanguage:'Script Language',hintDifficulty:'Hint Difficulty',dialogueScript:'Dialogue Script',autoDetect:'Auto-Detect',
        systemLanguage:'System Language',systemLanguageDesc:'Changes website text language only (not script recognition language).',
        homeButton:'Home',startPractice:'Start Practice',startAssignment:'Start Assignment',startPresentation:'Start Presentation',
        modePracticeTitle:'Practice Setup',modeAssignmentTitle:'Assignment Setup',modePresentationTitle:'Presentation Setup',
        modePracticeDesc:'Practice with line-by-line feedback and smooth repetition.',
        modeAssignmentDesc:'Complete a shared assignment script and track your score.',
        modePresentationDesc:'Lines are hidden first. Use hints and voice delivery for realistic practice.',
        modePracticeBadge:'Practice',modeAssignmentBadge:'Assignment',modePresentationBadge:'Presentation',
        basicMode:'Basic mode active',advancedMode:'Advanced mode active',
        assistantBasic:'Basic guide mode',assistantAdvanced:'Advanced AI mode'
    },
    es:{
        navHome:'Inicio',navPractice:'Practica',navAssignment:'Tarea',navPresentation:'Presentacion',navSettings:'Configuracion',
        homeQuickTitle:'Navega Rapido',homeQuickBody:'Usa las pestanas superiores como navegacion principal. Empieza en Practica o Presentacion y ajusta las claves en Configuracion.',
        homeGoPractice:'Ir a Practica',homeGoAssignment:'Ir a Tarea',homeGoPresentation:'Ir a Presentacion',homeOpenSettings:'Abrir Configuracion',
        homeModeTitle:'Basico vs Avanzado',homeModeBody:'El modo basico funciona sin clave API. Agrega una clave compatible en Configuracion para funciones avanzadas de IA.',
        homeHelpTitle:'Necesitas Ayuda?',homeHelpBody:'Usa el asistente para preguntar donde estan las funciones y como configurar el modo avanzado.',
        scriptLanguage:'Idioma del Guion',hintDifficulty:'Dificultad de Pista',dialogueScript:'Guion de Dialogo',autoDetect:'Auto-Detectar',
        systemLanguage:'Idioma del Sistema',systemLanguageDesc:'Cambia solo el idioma del texto de la web (no el idioma del reconocimiento del guion).',
        homeButton:'Inicio',startPractice:'Iniciar Practica',startAssignment:'Iniciar Tarea',startPresentation:'Iniciar Presentacion',
        modePracticeTitle:'Configurar Practica',modeAssignmentTitle:'Configurar Tarea',modePresentationTitle:'Configurar Presentacion',
        modePracticeDesc:'Practica con retroalimentacion linea por linea.',
        modeAssignmentDesc:'Completa un guion compartido y sigue tu puntuacion.',
        modePresentationDesc:'Las lineas empiezan ocultas. Usa pistas y voz para una practica realista.',
        modePracticeBadge:'Practica',modeAssignmentBadge:'Tarea',modePresentationBadge:'Presentacion',
        basicMode:'Modo basico activo',advancedMode:'Modo avanzado activo',
        assistantBasic:'Modo guia basico',assistantAdvanced:'Modo IA avanzado'
    }
};

function t(k){
    var lang=UI_TEXT[S.systemLanguage]||UI_TEXT.en;
    return lang[k]||UI_TEXT.en[k]||k;
}

var LANG={
    en:{name:'English',stt:'en-US',tts:'en-US',badge:'EN'},
    es:{name:'Espanol',stt:'es-ES',tts:'es-ES',badge:'ES'},
    fr:{name:'Francais',stt:'fr-FR',tts:'fr-FR',badge:'FR'},
    de:{name:'Deutsch',stt:'de-DE',tts:'de-DE',badge:'DE'},
    zh:{name:'Chinese',stt:'zh-CN',tts:'zh-CN',badge:'ZH'},
    ja:{name:'Japanese',stt:'ja-JP',tts:'ja-JP',badge:'JA'},
    ko:{name:'Korean',stt:'ko-KR',tts:'ko-KR',badge:'KO'},
    it:{name:'Italiano',stt:'it-IT',tts:'it-IT',badge:'IT'},
    pt:{name:'Portugues',stt:'pt-BR',tts:'pt-BR',badge:'PT'},
    ru:{name:'Russian',stt:'ru-RU',tts:'ru-RU',badge:'RU'},
    ar:{name:'Arabic',stt:'ar-SA',tts:'ar-SA',badge:'AR'}
};

var EXAMPLE="[Joe]: Alright everyone, settle in. Today we're doing a group presentation on US geography and the American Revolution. I'll start with the big picture, then Max will cover the buildup to war, and Paul will take us through the war itself.\n[Joe]: So, the United States is the third largest country in the world by land area. It stretches over three thousand miles from the Atlantic Ocean all the way to the Pacific. In between you've got the Great Plains, the Rocky Mountains, and the Mississippi River Valley.\n[Joe]: But here's what's really interesting: geography directly shaped how the colonies developed. The original thirteen colonies sat along the Atlantic coast, and their natural harbors made trade and shipping possible. That's why cities like Boston, New York, and Philadelphia became political hubs.\n[Joe]: So before I hand it over to Max, remember this: the layout of the land decided where people lived, where they traded, and eventually where they fought. Alright Max, take it away.\n[Max]: Thanks Joe. So by the mid seventeen hundreds, the British Empire was drowning in debt after the French and Indian War. Parliament's solution? Tax the colonies. They passed the Stamp Act in seventeen sixty-five and then the Townshend Acts shortly after.\n[Max]: The colonists were absolutely furious. Their argument was straightforward: no elected representation in Parliament meant no right to tax them. That's where the slogan 'No taxation without representation' came from, and protests spread across every single colony.\n[Paul]: And the situation only got worse from there. In seventeen seventy, British soldiers fired into a crowd in Boston, killing five people. That became known as the Boston Massacre. Then in seventeen seventy-three, protesters dumped three hundred and forty-two chests of British tea straight into the harbor, the Boston Tea Party.\n[Paul]: King George the Third responded with the Intolerable Acts, which shut down Boston's port and stripped Massachusetts of its self-government. The colonies realized they had to unite, so they formed the First Continental Congress in seventeen seventy-four.\n[Paul]: On April nineteenth, seventeen seventy-five, everything exploded. The Revolutionary War began at Lexington and Concord. The 'shot heard round the world' was fired that morning. Thirteen colonies were now going to war against the most powerful military on the planet.\n[Max]: That's right Paul. And it's worth noting that geography was a massive advantage for the colonists during the war. Britain had to supply its army from over three thousand miles across the Atlantic. Meanwhile the Americans were fighting on their own soil and knew every hill, forest, and river.\n[Paul]: Exactly. On July fourth, seventeen seventy-six, the Declaration of Independence was adopted. Thomas Jefferson wrote most of it, arguing that all men are created equal with unalienable rights to life, liberty, and the pursuit of happiness.\n[Paul]: The war dragged on for eight years. The turning point was Yorktown in seventeen eighty-one, where American and French forces trapped the British on a peninsula in Virginia. Cornwallis surrendered, and that was effectively the end.\n[Joe]: And the final result was the Treaty of Paris in seventeen eighty-three. The United States was officially recognized as an independent nation, with borders stretching from the Atlantic to the Mississippi, and from the Great Lakes down to Florida.\n[Joe]: So to wrap it all up: geography gave the colonies their economic power through those coastal harbors, and that same geography, the sheer distance from Britain, helped them win the war. The land literally built the nation. Thanks everyone, we'll take questions now.";

/* ═══════════════════════════════════════════════════════════════
   PRESENTATION MODE STATES
   HIDDEN  → line blurred, show [Hint] + [Mic] buttons side by side
   HINT    → hint text revealed, [Mic] button prominent
   REC     → recording in progress, silence detection running
   EVAL    → waiting for API
   RESULT  → scorecard shown, user clicks Retry or Continue
═══════════════════════════════════════════════════════════════ */
var PS={HIDDEN:'hidden',HINT:'hint',REC:'rec',EVAL:'eval',RESULT:'result'};

/* ═══════════════════════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════════════════════ */
var S={
    screen:'setup',
    activeSetupTab:'home',
    apiKey:'',apiProxy:API_PROXY,apiEndpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',apiModel:'',premiumPlaceholder:false,
    systemLanguage:'en',
    language:'en',mode:'practice',
    lines:[],roles:[],userRole:'',
    currentLine:0,
    practicePickerActive:false,
    isRecording:false,isProcessing:false,isSpeaking:false,
    showExpected:true,
    userInput:'',
    sessionStart:0,
    recognition:null,
    mediaRecorder:null,audioChunks:[],audioStream:null,
    ttsAudio:null,ttsProvider:'browser',elevenlabsKey:'',elevenlabsVoiceId:'21m00Tcm4TlvDq8ikWAM',clonedVoiceId:'',
    lineScores:{},lineDetails:{},userResponses:{},audioClips:{},attemptCount:{},practiceScoreHistory:{},
    audioContext:null,analyser:null,silenceInterval:null,silenceFrames:0,recordStartTime:0,
    /* Silence detection: 2 seconds of RMS below threshold = auto-stop */
    SILENCE_THRESH:0.012,   /* RMS threshold — below this = silence */
    SILENCE_FRAMES:40,      /* 40 frames × 50ms = 2 seconds */
    MIN_REC_MS:600,         /* minimum 600ms recording before silence check kicks in */
    currentRMS:0,
    hintLevel:'first',hintShown:{},
    presState:PS.HIDDEN,
    npcSlowReplay:false,
    scriptDifficulty:{score:0,label:'Easy',metrics:null},
    uiTheme:'system',
    scriptSource:'manual',
    scriptLabel:'Manual Script',
    scriptRef:'',
    authReady:false,
    isAuthenticated:false,
    authUser:null
};

var $=function(id){return document.getElementById(id)};
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
