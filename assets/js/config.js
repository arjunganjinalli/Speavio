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
    leaderboard:'speakflow_leaderboard',
    uiTheme:'speakflow_ui_theme',
    onboardingDone:'speakflow_onboarding_done'
};

var UI_TEXT={
    en:{
        navHome:'Home',navPractice:'Practice',navPresentation:'Presentation',navSettings:'Settings',
        homeQuickTitle:'Get Around Quickly',homeQuickBody:'Use the header tabs like GitHub navigation. Start in Practice or Presentation, then tune AI keys in Settings.',
        homeGoPractice:'Go to Practice',homeGoPresentation:'Go to Presentation',homeOpenSettings:'Open Settings',
        homeModeTitle:'Basic vs Advanced',homeModeBody:'Basic mode works without API keys. Add any OpenAI-compatible API key in Settings to unlock advanced AI features.',
        homeHelpTitle:'Need Help?',homeHelpBody:'Use the assistant bubble in the bottom-right to ask where features are, what each mode does, and how to configure advanced setup.',
        scriptLanguage:'Script Language',hintDifficulty:'Hint Difficulty',dialogueScript:'Dialogue Script',autoDetect:'Auto-Detect',
        systemLanguage:'System Language',systemLanguageDesc:'Changes website text language only (not script recognition language).',
        homeButton:'Home',startPractice:'Start Practice',startPresentation:'Start Presentation',
        modePracticeTitle:'Practice Setup',modePresentationTitle:'Presentation Setup',
        modePracticeDesc:'Practice with line-by-line feedback and smooth repetition.',
        modePresentationDesc:'Lines are hidden first. Use hints and voice delivery for realistic practice.',
        modePracticeBadge:'Practice',modePresentationBadge:'Presentation',
        basicMode:'Basic mode active',advancedMode:'Advanced mode active',
        assistantBasic:'Basic guide mode',assistantAdvanced:'Advanced AI mode'
    },
    es:{
        navHome:'Inicio',navPractice:'Practica',navPresentation:'Presentacion',navSettings:'Configuracion',
        homeQuickTitle:'Navega Rapido',homeQuickBody:'Usa las pestanas superiores como navegacion principal. Empieza en Practica o Presentacion y ajusta las claves en Configuracion.',
        homeGoPractice:'Ir a Practica',homeGoPresentation:'Ir a Presentacion',homeOpenSettings:'Abrir Configuracion',
        homeModeTitle:'Basico vs Avanzado',homeModeBody:'El modo basico funciona sin clave API. Agrega una clave compatible en Configuracion para funciones avanzadas de IA.',
        homeHelpTitle:'Necesitas Ayuda?',homeHelpBody:'Usa el asistente para preguntar donde estan las funciones y como configurar el modo avanzado.',
        scriptLanguage:'Idioma del Guion',hintDifficulty:'Dificultad de Pista',dialogueScript:'Guion de Dialogo',autoDetect:'Auto-Detectar',
        systemLanguage:'Idioma del Sistema',systemLanguageDesc:'Cambia solo el idioma del texto de la web (no el idioma del reconocimiento del guion).',
        homeButton:'Inicio',startPractice:'Iniciar Practica',startPresentation:'Iniciar Presentacion',
        modePracticeTitle:'Configurar Practica',modePresentationTitle:'Configurar Presentacion',
        modePracticeDesc:'Practica con retroalimentacion linea por linea.',
        modePresentationDesc:'Las lineas empiezan ocultas. Usa pistas y voz para una practica realista.',
        modePracticeBadge:'Practica',modePresentationBadge:'Presentacion',
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

var EXAMPLE={
    en:"[Alex]: Okay, what are we watching tonight?\n[Jamie]: Something scary. I want to be terrified.\n[Sam]: No way! Last time you hid behind a pillow the whole time.\n[Alex]: That's true. You screamed at a commercial.\n[Jamie]: It was a very loud commercial.\n[Sam]: How about a comedy instead?\n[Alex]: Perfect. I'll make popcorn.\n[Jamie]: Make extra. I stress-eat when I'm scared.\n[Sam]: You just said no scary movies!\n[Jamie]: I know. I'm already nervous about the commercials.",
    es:"[Alex]: ¿Qué vemos esta noche?\n[Jamie]: Algo de terror. Quiero asustarme.\n[Sam]: ¡Ni hablar! La última vez te escondiste detrás del cojín.\n[Alex]: Es verdad. Gritaste por un anuncio.\n[Jamie]: Era un anuncio muy fuerte.\n[Sam]: ¿Y si ponemos una comedia?\n[Alex]: Perfecto. Yo hago las palomitas.\n[Jamie]: Haz de más. Como por nervios cuando me asusto.\n[Sam]: ¡Pero acabas de decir que no quieres terror!\n[Jamie]: Ya lo sé. Los anuncios ya me ponen nervioso.",
    fr:"[Alex]: Alors, qu'est-ce qu'on regarde ce soir ?\n[Jamie]: Un film d'horreur. Je veux avoir peur.\n[Sam]: Hors de question ! La dernière fois, tu t'es caché derrière un coussin.\n[Alex]: C'est vrai. Tu as crié à cause d'une pub.\n[Jamie]: C'était une pub très bruyante.\n[Sam]: Et si on regardait une comédie ?\n[Alex]: Parfait. Je fais le popcorn.\n[Jamie]: Fais-en beaucoup. Je mange quand je stresse.\n[Sam]: Mais tu viens de dire non à l'horreur !\n[Jamie]: Je sais. Les pubs me stressent déjà.",
    de:"[Alex]: Also, was schauen wir heute Abend?\n[Jamie]: Einen Horrorfilm. Ich will Angst haben.\n[Sam]: Auf keinen Fall! Letztes Mal hast du dich hinter dem Kissen versteckt.\n[Alex]: Stimmt. Du hast wegen einer Werbung geschrien.\n[Jamie]: Das war eine sehr laute Werbung.\n[Sam]: Wie wäre es mit einer Komödie?\n[Alex]: Perfekt. Ich mache Popcorn.\n[Jamie]: Mach viel davon. Ich esse aus Stress.\n[Sam]: Du hast gerade Nein zu Horror gesagt!\n[Jamie]: Ich weiß. Die Werbung macht mich schon nervös.",
    zh:"[Alex]: 我们今晚看什么？\n[Jamie]: 恐怖片。我想被吓到。\n[Sam]: 不行！上次你躲在枕头后面一整晚。\n[Alex]: 说得对。你被广告吓得尖叫。\n[Jamie]: 那个广告声音太大了。\n[Sam]: 看喜剧怎么样？\n[Alex]: 完美。我去做爆米花。\n[Jamie]: 多做一点。我紧张的时候爱吃东西。\n[Sam]: 你刚才还说不看恐怖片！\n[Jamie]: 我知道。广告已经让我紧张了。",
    ja:"[Alex]: 今夜は何を見る？\n[Jamie]: ホラーがいい。怖い思いをしたい。\n[Sam]: ダメ！この前ずっとクッションに隠れてたじゃない。\n[Alex]: そうそう。CMで叫んでたし。\n[Jamie]: あれはすごく大きい音のCMだったから。\n[Sam]: じゃあコメディにしよう？\n[Alex]: いいね。ポップコーン作るよ。\n[Jamie]: たくさん作って。緊張すると食べちゃうから。\n[Sam]: ホラーはイヤって言ったばかりでしょ！\n[Jamie]: わかってる。CMでもう緊張してる。",
    ko:"[Alex]: 오늘 밤엔 뭐 볼까?\n[Jamie]: 공포 영화요! 무서운 거 보고 싶어요.\n[Sam]: 안 돼요! 지난번엔 쿠션 뒤에 숨어 있었잖아요.\n[Alex]: 맞아요. 광고 보다가 소리도 질렀잖아요.\n[Jamie]: 그 광고가 너무 컸어요.\n[Sam]: 그럼 코미디 어때요?\n[Alex]: 좋아요. 제가 팝콘 만들게요.\n[Jamie]: 많이 만들어요. 긴장하면 많이 먹게 되거든요.\n[Sam]: 방금 공포 영화는 싫다고 했잖아요!\n[Jamie]: 알아요. 광고만 봐도 이미 긴장돼요.",
    it:"[Alex]: Allora, cosa guardiamo stasera?\n[Jamie]: Un horror. Voglio avere paura.\n[Sam]: Assolutamente no! L'ultima volta ti sei nascosto dietro il cuscino.\n[Alex]: È vero. Hai urlato per una pubblicità.\n[Jamie]: Era una pubblicità molto rumorosa.\n[Sam]: E se guardassimo una commedia?\n[Alex]: Perfetto. Faccio i popcorn.\n[Jamie]: Fanne tanti. Mangio quando sono sotto stress.\n[Sam]: Hai appena detto no all'horror!\n[Jamie]: Lo so. Le pubblicità mi mettono già ansia.",
    pt:"[Alex]: Então, o que vemos esta noite?\n[Jamie]: Um terror. Quero me assustar.\n[Sam]: De jeito nenhum! Da última vez você se escondeu atrás do travesseiro.\n[Alex]: É verdade. Você gritou por causa de um comercial.\n[Jamie]: Era um comercial muito barulhento.\n[Sam]: Que tal uma comédia?\n[Alex]: Perfeito. Eu faço a pipoca.\n[Jamie]: Faz bastante. Eu como quando estou nervoso.\n[Sam]: Você acabou de dizer não ao terror!\n[Jamie]: Eu sei. Os comerciais já me deixam nervoso.",
    ru:"[Alex]: Итак, что смотрим сегодня вечером?\n[Jamie]: Ужастик. Хочу как следует испугаться.\n[Sam]: Ни за что! В прошлый раз ты прятался за подушкой весь вечер.\n[Alex]: Правда. Ты кричал из-за рекламы.\n[Jamie]: Там была очень громкая реклама.\n[Sam]: А если комедию?\n[Alex]: Отлично. Я сделаю попкорн.\n[Jamie]: Побольше. Я ем от стресса.\n[Sam]: Ты только что сказал нет ужастикам!\n[Jamie]: Знаю. Реклама уже меня нервирует.",
    ar:"[Alex]: حسنًا، ماذا نشاهد الليلة؟\n[Jamie]: فيلم رعب. أريد أن أخاف.\n[Sam]: لا أبدًا! في المرة الأخيرة اختبأت خلف الوسادة طوال الوقت.\n[Alex]: صحيح. كنت تصرخ بسبب إعلان تجاري.\n[Jamie]: كان إعلانًا صاخبًا جدًا.\n[Sam]: ماذا عن فيلم كوميدي؟\n[Alex]: ممتاز. سأحضر الفشار.\n[Jamie]: اعمل كثيرًا منه. آكل حين أكون متوترًا.\n[Sam]: لكنك قلت للتو لا للرعب!\n[Jamie]: أعلم. الإعلانات تجعلني متوترًا مسبقًا."
};

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
    lines:[],roles:[],userRoles:[],
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
    _langManualOverride:false,
    authReady:false,
    isAuthenticated:false,
    authUser:null
};

var $=function(id){return document.getElementById(id)};
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
