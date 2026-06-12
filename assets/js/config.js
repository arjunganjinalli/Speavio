/* AI Provider configs — auto-set when user picks a provider */
var AI_PROVIDERS = {
    groq: {
        name: 'Groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        keyUrl: 'https://console.groq.com/keys',
        badge: 'Free'
    },
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
        keyUrl: 'https://platform.openai.com/api-keys',
        badge: null
    },
    gemini: {
        name: 'Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: 'gemini-2.0-flash',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        badge: 'Free'
    },
    other: {
        name: 'Other',
        endpoint: '',
        model: '',
        keyUrl: null,
        badge: null
    }
};

var API_PROXY = '/api/chat';
var _activeProvider = null;

var STORAGE_KEYS={
    sessions:'voqua_sessions',
    scripts:'voqua_scripts',
    bookmarks:'voqua_bookmarks',
    leaderboard:'voqua_leaderboard',
    uiTheme:'voqua_ui_theme',
    onboardingDone:'voqua_onboarding_done'
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
    en:"[Alex]: Good morning everyone. Today we are presenting on the Solar System.\n[Jamie]: Our Solar System has eight planets. The four inner ones are rocky, and the four outer ones are gas giants.\n[Sam]: Beyond Neptune lies the Kuiper Belt, a region full of icy rocks and dwarf planets like Pluto.\n[Alex]: The Solar System formed about four point six billion years ago from a cloud of gas and dust.\n[Jamie]: Earth is the only planet known to support life. It sits at just the right distance from the Sun.\n[Sam]: Scientists believe there may be a ninth planet far out in the Solar System, but it has not been found yet.\n[Alex]: At its center is the Sun, which contains ninety-nine percent of all the mass in the system.\n[Jamie]: Jupiter is the largest planet. One thousand three hundred Earths could fit inside it.\n[Sam]: Space exploration continues to reveal new discoveries. We still have much to learn about our cosmic neighborhood.",
    es:"[Alex]: Buenos días a todos. Hoy presentamos sobre el Sistema Solar.\n[Jamie]: El Sistema Solar tiene ocho planetas. Los cuatro interiores son rocosos y los cuatro exteriores son gigantes gaseosos.\n[Sam]: Más allá de Neptuno está el Cinturón de Kuiper, una región llena de rocas heladas y planetas enanos como Plutón.\n[Alex]: El Sistema Solar se formó hace unos cuatro mil seiscientos millones de años a partir de una nube de gas y polvo.\n[Jamie]: La Tierra es el único planeta conocido que alberga vida. Está a la distancia perfecta del Sol.\n[Sam]: Los científicos creen que puede haber un noveno planeta muy lejos en el Sistema Solar, pero aún no se ha encontrado.\n[Alex]: En su centro está el Sol, que contiene el noventa y nueve por ciento de toda la masa del sistema.\n[Jamie]: Júpiter es el planeta más grande. Mil trescientas Tierras cabrían dentro de él.\n[Sam]: La exploración espacial sigue revelando nuevos descubrimientos. Todavía tenemos mucho que aprender sobre nuestro vecindario cósmico.",
    fr:"[Alex]: Bonjour à tous. Aujourd'hui nous présentons le Système Solaire.\n[Jamie]: Notre Système Solaire compte huit planètes. Les quatre intérieures sont rocheuses et les quatre extérieures sont des géantes gazeuses.\n[Sam]: Au-delà de Neptune se trouve la Ceinture de Kuiper, une région remplie de roches glacées et de planètes naines comme Pluton.\n[Alex]: Le Système Solaire s'est formé il y a environ quatre virgule six milliards d'années à partir d'un nuage de gaz et de poussière.\n[Jamie]: La Terre est la seule planète connue à abriter la vie. Elle se trouve à la bonne distance du Soleil.\n[Sam]: Les scientifiques pensent qu'il pourrait exister une neuvième planète très loin dans le Système Solaire, mais elle n'a pas encore été trouvée.\n[Alex]: En son centre se trouve le Soleil, qui contient quatre-vingt-dix-neuf pour cent de toute la masse du système.\n[Jamie]: Jupiter est la plus grande planète. Mille trois cents Terres pourraient tenir à l'intérieur.\n[Sam]: L'exploration spatiale continue de révéler de nouvelles découvertes. Nous avons encore beaucoup à apprendre sur notre voisinage cosmique.",
    de:"[Alex]: Guten Morgen alle zusammen. Heute präsentieren wir das Sonnensystem.\n[Jamie]: Unser Sonnensystem hat acht Planeten. Die vier inneren sind felsig und die vier äußeren sind Gasriesen.\n[Sam]: Jenseits von Neptun liegt der Kuipergürtel, eine Region voller eisiger Gesteine und Zwergplaneten wie Pluto.\n[Alex]: Das Sonnensystem entstand vor etwa vier Komma sechs Milliarden Jahren aus einer Wolke aus Gas und Staub.\n[Jamie]: Die Erde ist der einzige bekannte Planet, auf dem Leben existiert. Sie befindet sich genau im richtigen Abstand zur Sonne.\n[Sam]: Wissenschaftler glauben, dass es einen neunten Planeten weit draußen im Sonnensystem geben könnte, aber er wurde noch nicht gefunden.\n[Alex]: In seinem Zentrum befindet sich die Sonne, die neunundneunzig Prozent der gesamten Masse des Systems enthält.\n[Jamie]: Jupiter ist der größte Planet. Eintausenddreihundert Erden würden in ihn hineinpassen.\n[Sam]: Die Weltraumforschung enthüllt weiterhin neue Entdeckungen. Wir haben noch viel über unsere kosmische Nachbarschaft zu lernen.",
    zh:"[Alex]: 大家早上好。今天我们要介绍太阳系。\n[Jamie]: 太阳系有八颗行星。内侧四颗是岩石行星，外侧四颗是气态巨行星。\n[Sam]: 海王星之外是柯伊伯带，那里充满了冰冻岩石和像冥王星这样的矮行星。\n[Alex]: 太阳系大约在四十六亿年前由一团气体和尘埃云形成。\n[Jamie]: 地球是目前已知唯一有生命存在的行星，位于距太阳恰好合适的位置。\n[Sam]: 科学家认为太阳系深处可能存在第九颗行星，但目前还没有被发现。\n[Alex]: 太阳位于中心，包含了整个系统百分之九十九的质量。\n[Jamie]: 木星是最大的行星，内部可以容纳一千三百个地球。\n[Sam]: 太空探索不断揭示新的发现，我们对宇宙邻居的了解还有很多。",
    ja:"[Alex]: みなさん、おはようございます。今日は太陽系についてご発表します。\n[Jamie]: 太陽系には八つの惑星があります。内側の四つは岩石惑星で、外側の四つはガス惑星です。\n[Sam]: 海王星の外側にはカイパーベルトがあり、冥王星のような氷の岩石や矮小惑星が多く存在します。\n[Alex]: 太陽系は約四十六億年前にガスと塵の雲から形成されました。\n[Jamie]: 地球は生命が存在することが知られている唯一の惑星です。太陽からちょうどよい距離にあります。\n[Sam]: 科学者たちは太陽系の遥か遠くに九番目の惑星がある可能性があると考えていますが、まだ発見されていません。\n[Alex]: 中心には太陽があり、系全体の質量の九十九パーセントを占めています。\n[Jamie]: 木星は最大の惑星で、内部には地球が千三百個入るほどの大きさがあります。\n[Sam]: 宇宙探査は新たな発見を次々と明らかにしています。私たちの宇宙の近傍についてはまだ多くを学ぶ必要があります。",
    ko:"[Alex]: 안녕하세요. 오늘은 태양계에 대해 발표하겠습니다.\n[Jamie]: 태양계에는 8개의 행성이 있습니다. 안쪽 4개는 암석 행성이고 바깥쪽 4개는 가스 행성입니다.\n[Sam]: 해왕성 너머에는 카이퍼 벨트가 있으며, 명왕성 같은 얼음 암석과 왜소 행성들이 가득합니다.\n[Alex]: 태양계는 약 46억 년 전 가스와 먼지 구름으로부터 형성되었습니다.\n[Jamie]: 지구는 생명이 존재하는 것으로 알려진 유일한 행성입니다. 태양으로부터 적절한 거리에 위치합니다.\n[Sam]: 과학자들은 태양계 먼 곳에 아홉 번째 행성이 있을 수 있다고 생각하지만 아직 발견되지 않았습니다.\n[Alex]: 중심에는 태양이 있으며, 태양계 전체 질량의 99퍼센트를 차지합니다.\n[Jamie]: 목성은 가장 큰 행성으로, 내부에 지구 1300개가 들어갈 수 있습니다.\n[Sam]: 우주 탐사는 계속해서 새로운 발견을 밝혀내고 있습니다. 우리의 우주 이웃에 대해 배울 것이 아직 많습니다.",
    it:"[Alex]: Buongiorno a tutti. Oggi presentiamo il Sistema Solare.\n[Jamie]: Il nostro Sistema Solare ha otto pianeti. I quattro interni sono rocciosi e i quattro esterni sono giganti gassosi.\n[Sam]: Oltre Nettuno si trova la Fascia di Kuiper, una regione piena di rocce ghiacciate e pianeti nani come Plutone.\n[Alex]: Il Sistema Solare si è formato circa quattro virgola sei miliardi di anni fa da una nube di gas e polvere.\n[Jamie]: La Terra è l'unico pianeta noto che ospita la vita. Si trova alla giusta distanza dal Sole.\n[Sam]: Gli scienziati ritengono che potrebbe esserci un nono pianeta molto lontano nel Sistema Solare, ma non è ancora stato trovato.\n[Alex]: Al suo centro si trova il Sole, che contiene il novantanove per cento di tutta la massa del sistema.\n[Jamie]: Giove è il pianeta più grande. Al suo interno entrerebbero milletrecento Terre.\n[Sam]: L'esplorazione spaziale continua a rivelare nuove scoperte. Abbiamo ancora molto da imparare sul nostro vicinato cosmico.",
    pt:"[Alex]: Bom dia a todos. Hoje vamos apresentar sobre o Sistema Solar.\n[Jamie]: Nosso Sistema Solar tem oito planetas. Os quatro interiores são rochosos e os quatro exteriores são gigantes gasosos.\n[Sam]: Além de Netuno fica o Cinturão de Kuiper, uma região cheia de rochas geladas e planetas anões como Plutão.\n[Alex]: O Sistema Solar se formou há cerca de quatro vírgula seis bilhões de anos a partir de uma nuvem de gás e poeira.\n[Jamie]: A Terra é o único planeta conhecido que abriga vida. Ela está na distância perfeita do Sol.\n[Sam]: Cientistas acreditam que pode haver um nono planeta muito distante no Sistema Solar, mas ele ainda não foi encontrado.\n[Alex]: No seu centro está o Sol, que contém noventa e nove por cento de toda a massa do sistema.\n[Jamie]: Júpiter é o maior planeta. Mil e trezentas Terras caberiam dentro dele.\n[Sam]: A exploração espacial continua revelando novas descobertas. Ainda temos muito a aprender sobre nossa vizinhança cósmica.",
    ru:"[Alex]: Доброе утро всем. Сегодня мы делаем презентацию о Солнечной системе.\n[Jamie]: В нашей Солнечной системе восемь планет. Четыре внутренние — каменистые, а четыре внешние — газовые гиганты.\n[Sam]: За Нептуном находится пояс Койпера — область, полная ледяных камней и карликовых планет, таких как Плутон.\n[Alex]: Солнечная система образовалась около четырёх с половиной миллиардов лет назад из облака газа и пыли.\n[Jamie]: Земля — единственная известная планета, на которой существует жизнь. Она находится на идеальном расстоянии от Солнца.\n[Sam]: Учёные считают, что вдали в Солнечной системе может существовать девятая планета, но она ещё не найдена.\n[Alex]: В её центре находится Солнце, которое содержит девяносто девять процентов всей массы системы.\n[Jamie]: Юпитер — самая большая планета. Внутри него поместились бы тысяча триста Земель.\n[Sam]: Космические исследования продолжают открывать новые тайны. Нам ещё многое предстоит узнать о нашем космическом соседстве.",
    ar:"[Alex]: صباح الخير جميعًا. اليوم سنقدم عرضًا عن المجموعة الشمسية.\n[Jamie]: تضم مجموعتنا الشمسية ثمانية كواكب. الأربعة الداخلية صخرية والأربعة الخارجية عمالقة غازية.\n[Sam]: يقع خلف نبتون حزام كايبر، وهو منطقة مليئة بالصخور الجليدية والكواكب القزمة مثل بلوتو.\n[Alex]: تشكّلت المجموعة الشمسية منذ نحو أربعة فاصل ستة مليارات سنة من سحابة من الغاز والغبار.\n[Jamie]: الأرض هي الكوكب الوحيد المعروف الذي يحتضن الحياة، وتقع على المسافة المثالية من الشمس.\n[Sam]: يعتقد العلماء أنه قد يوجد كوكب تاسع في أعماق المجموعة الشمسية، لكنه لم يُكتشف بعد.\n[Alex]: في مركزها تقع الشمس، التي تحتوي على تسعة وتسعين بالمئة من كتلة المجموعة بأكملها.\n[Jamie]: المشتري هو أكبر الكواكب، ويمكن أن يتسع في داخله ألف وثلاثمئة أرض.\n[Sam]: يواصل استكشاف الفضاء الكشف عن اكتشافات جديدة. ولا يزال أمامنا الكثير لنتعلمه عن جوارنا الكوني."
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
    apiKey:'',apiProxy:API_PROXY,apiEndpoint:'',apiModel:'',aiProvider:'',aiConnected:false,premiumPlaceholder:false,
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
    preferredMicId:'',preferredSpeakerId:'',
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
    authUser:null,
    userProfile:null
};

var $=function(id){return document.getElementById(id)};
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
