/* ── HELP MODAL ── */
function openHelp(){
    var el=document.getElementById('help-overlay');
    if(!el){
        el=document.createElement('div');
        el.id='help-overlay';
        el.className='help-overlay';
        el.innerHTML='<div class="help-modal" style="position:relative">'
            +'<button class="close-help" onclick="closeHelp()" aria-label="Close"><i class="fas fa-xmark"></i></button>'
            +'<h2><i class="fas fa-circle-question mr-2 text-copper-400"></i>How SpeakFlow Works</h2>'
            +'<p>SpeakFlow helps you practice dialogues and presentations using AI-powered speech evaluation. Here\'s how to use it:</p>'
            +'<h3><i class="fas fa-gear mr-1.5"></i>Setup</h3>'
            +'<ul>'
            +'<li>API key is optional and configured in <strong>Settings</strong></li>'
            +'<li>Choose the <strong>language</strong> of your script</li>'
            +'<li>Use the top navigation: <strong>Home, Practice, Assignment, Presentation, Settings</strong></li>'
            +'<li>Paste your script in the text box or click <strong>Example</strong></li>'
            +'<li>Use <strong>Auto-Detect</strong> to extract dialogue from messy text</li>'
            +'<li>Select <strong>which role</strong> you want to play</li>'
            +'</ul>'
            +'<h3><i class="fas fa-link mr-1.5"></i>Assignment Mode</h3>'
            +'<ul>'
            +'<li>Create a shareable assignment link from your current script</li>'
            +'<li>Opening the link auto-loads the script and switches to Assignment mode</li>'
            +'<li>Assignment runs like Practice mode with full report tracking</li>'
            +'</ul>'
            +'<h3><i class="fas fa-microphone-lines mr-1.5"></i>Practice Mode</h3>'
            +'<ul>'
            +'<li>Other characters\' lines are read aloud to you automatically</li>'
            +'<li>When it\'s your turn, <strong>speak your line</strong> or type it</li>'
            +'<li>Click the mic to record, or type in the text box and press Send</li>'
            +'<li>The AI evaluates your <strong>accuracy, grammar, and fluency</strong></li>'
            +'<li>Click Next Line to continue through the dialogue</li>'
            +'</ul>'
            +'<h3><i class="fas fa-masks-theater mr-1.5"></i>Presentation Mode</h3>'
            +'<ul>'
            +'<li>Lines start <strong>hidden (blurred)</strong> so you can\'t read them</li>'
            +'<li>When it\'s your turn, a <strong>hint</strong> is shown (first word or full text)</li>'
            +'<li><strong>Recording starts automatically</strong> — just speak!</li>'
            +'<li>After <strong>2 seconds of silence</strong>, it auto-stops and advances</li>'
            +'<li>You can also tap the stop button to move on early</li>'
            +'<li>At the end, you get a <strong>full report</strong> with scores for every line</li>'
            +'</ul>'
            +'<h3><i class="fas fa-chart-bar mr-1.5"></i>The Report</h3>'
            +'<ul>'
            +'<li>See your <strong>average score</strong> and per-line breakdown</li>'
            +'<li><strong>Green</strong> = Excellent (80+), <strong>Amber</strong> = Good (50-79), <strong>Red</strong> = Needs Work</li>'
            +'<li>Compare what you said vs. the expected line</li>'
            +'<li>Get corrections, tips, and encouragement from the AI</li>'
            +'<li>Bookmark hard lines and review leaderboard progress over time</li>'
            +'<li>Export your report as JSON, PDF, scorecard image, or print view</li>'
            +'</ul>'
            +'<h3><i class="fas fa-lightbulb mr-1.5"></i>Tips</h3>'
            +'<ul>'
            +'<li>Use <strong>Hint: Full</strong> if you\'re learning the lines for the first time</li>'
            +'<li>Use <strong>Hint: Off</strong> to test yourself from memory</li>'
            +'<li>Speak clearly and at a normal pace for best speech recognition</li>'
            +'<li>Allow microphone access when prompted — it\'s only needed once per session</li>'
            +'<li>Keyboard shortcuts: <strong>Space</strong> toggles recording, <strong>Enter</strong> submits in practice-like modes</li>'
            +'<li>Press <strong>Escape</strong> or the back arrow to exit at any time</li>'
            +'</ul>'
            +'</div>';
        el.addEventListener('click',function(e){if(e.target===el)closeHelp()});
        document.body.appendChild(el);
    }
    el.classList.add('open');
}
function closeHelp(){
    var el=document.getElementById('help-overlay');
    if(el)el.classList.remove('open');
}
