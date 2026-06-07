function pushSessionHistory(avgScore,totalLines,totalUserLines,linesEvaluated){
    var sessions=getSavedSessions();
    sessions.push({
        timestamp:new Date().toISOString(),
        avgScore:avgScore,
        mode:S.mode,
        language:S.language,
        totalLines:totalLines,
        totalUserLines:totalUserLines,
        linesEvaluated:linesEvaluated,
        difficulty:S.scriptDifficulty
    });
    while(sessions.length>120)sessions.shift();
    writeStoreJSON(STORAGE_KEYS.sessions,sessions);
    refreshHomeProgressSnapshot();
    return sessions;
}

function buildScoreTrendSVG(scores){
    if(!scores.length)return '';
    var w=320,h=90,pad=20;
    var min=Math.min.apply(null,scores),max=Math.max.apply(null,scores);
    var span=Math.max(1,max-min);
    var pts=scores.map(function(s,i){
        var x=pad+(i*(w-2*pad))/Math.max(1,scores.length-1);
        var y=pad+((max-s)/span)*(h-2*pad);
        return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    var last=scores[scores.length-1]||0;
    return '<svg viewBox="0 0 '+w+' '+h+'" class="w-full h-[90px]">'
        +'<polyline points="'+pts+'" fill="none" stroke="var(--sf-chart-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        +'<line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="var(--sf-chart-axis)" stroke-width="1"/>'
        +'<text x="'+(w-pad)+'" y="14" fill="var(--sf-chart-accent)" font-size="11" text-anchor="end">Latest: '+last+'</text>'
        +'</svg>';
}

function launchPerfectScoreConfetti(){
    var prev=document.getElementById('sf-confetti-layer');
    if(prev)prev.remove();
    var layer=document.createElement('div');
    layer.id='sf-confetti-layer';
    layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden;';
    var rs=getComputedStyle(document.documentElement);
    var colors=[
        rs.getPropertyValue('--sf-confetti-1').trim()||'#C8956C',
        rs.getPropertyValue('--sf-confetti-2').trim()||'#5BB882',
        rs.getPropertyValue('--sf-confetti-3').trim()||'#E8B88A',
        rs.getPropertyValue('--sf-confetti-4').trim()||'#E89590',
        rs.getPropertyValue('--sf-confetti-5').trim()||'#E8E6E1'
    ];
    var count=100;
    var vh=Math.max(window.innerHeight||0,640);

    for(var i=0;i<count;i++){
        var p=document.createElement('span');
        var left=Math.random()*100;
        var drift=(Math.random()*220)-110;
        var rotate=(Math.random()*900)-450;
        var delay=Math.random()*180;
        var dur=1600+Math.random()*900;
        p.style.cssText='position:absolute;top:-18px;left:'+left+'%;width:8px;height:14px;border-radius:2px;background:'+colors[i%colors.length]+';opacity:.95;transform:translate3d(0,0,0) rotate(0deg);transition:transform '+dur+'ms cubic-bezier(.12,.72,.2,1),opacity '+dur+'ms linear;';
        layer.appendChild(p);
        (function(el,dx,rot,d,ms){
            setTimeout(function(){
                el.style.transform='translate3d('+dx+'px,'+(vh+36)+'px,0) rotate('+rot+'deg)';
                el.style.opacity='0';
            },d);
        })(p,drift,rotate,delay,dur);
    }

    document.body.appendChild(layer);
    setTimeout(function(){if(layer&&layer.parentNode)layer.parentNode.removeChild(layer)},3200);
}

function getReportScriptKey(){
    if(typeof getCurrentScriptKey==='function')return getCurrentScriptKey();
    var scriptLines=(S.lines||[]).map(function(l){return (l.role||'')+':'+(l.text||'')}).join('\n');
    var seed=[S.language||'',S.userRoles.slice().sort().join('+')||'',scriptLines].join('||');
    var h=2166136261;
    for(var i=0;i<seed.length;i++){
        h^=seed.charCodeAt(i);
        h=Math.imul(h,16777619);
    }
    return 'sc_'+(h>>>0).toString(36);
}

function getReportBookmarksStore(){
    if(typeof getSavedBookmarks==='function')return getSavedBookmarks();
    return readStoreJSON(STORAGE_KEYS.bookmarks,{});
}

function writeReportBookmarksStore(val){
    writeStoreJSON(STORAGE_KEYS.bookmarks,val);
}

function isReportLineBookmarked(lineIndex,lineText){
    if(typeof isBookmarkedLine==='function')return isBookmarkedLine(lineIndex,lineText);
    var all=getReportBookmarksStore();
    var scriptKey=getReportScriptKey();
    var row=all[scriptKey]&&all[scriptKey][String(lineIndex)];
    if(!row)return false;
    if(lineText&&row.lineText&&row.lineText!==lineText)return false;
    return true;
}

function toggleReportLineBookmark(lineIndex,lineText,score){
    if(typeof toggleBookmarkedLine==='function')return toggleBookmarkedLine(lineIndex,lineText,score);
    var all=getReportBookmarksStore();
    var scriptKey=getReportScriptKey();
    var idx=String(lineIndex);
    if(!all[scriptKey])all[scriptKey]={};

    if(all[scriptKey][idx]){
        delete all[scriptKey][idx];
        if(!Object.keys(all[scriptKey]).length)delete all[scriptKey];
        writeReportBookmarksStore(all);
        return false;
    }

    all[scriptKey][idx]={
        lineText:lineText||'',
        score:typeof score==='number'?score:null,
        savedAt:new Date().toISOString()
    };
    writeReportBookmarksStore(all);
    return true;
}

function getReportBookmarkedLineCount(){
    if(typeof getBookmarkedLineCountForCurrentScript==='function')return getBookmarkedLineCountForCurrentScript();
    var all=getReportBookmarksStore();
    var scriptKey=getReportScriptKey();
    return Object.keys(all[scriptKey]||{}).length;
}

function buildAdvancedStatsHTML(){
    if(!S.apiKey)return '';
    var corr=0,sugg=0,delivery=0,scored=0,high=0;
    for(var k in S.lineDetails){
        var d=S.lineDetails[k];
        if(!d)continue;
        scored++;
        if(S.lineScores[k]>=80)high++;
        corr+=(d.corrections&&d.corrections.length)||0;
        sugg+=(d.suggestions&&d.suggestions.length)||0;
        delivery+=(d.deliveryNotes&&d.deliveryNotes.length)||0;
    }
    if(!scored)return '';
    return '<div class="mini-card">'
        +'<h4 class="text-sf-50 font-display font-semibold mb-2">Advanced AI Stats</h4>'
        +'<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-sf-100 font-semibold">'+high+'/'+scored+'</div><div class="text-sf-300">Strong Lines</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-coral-400 font-semibold">'+corr+'</div><div class="text-sf-300">Corrections</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-copper-400 font-semibold">'+sugg+'</div><div class="text-sf-300">Suggestions</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-sage-400 font-semibold">'+delivery+'</div><div class="text-sf-300">Delivery Notes</div></div>'
        +'</div>'
        +'</div>';
}

function renderReportInsights(avgScore,totalLines,totalUserLines,linesEvaluated){
    var box=$('report-insights');
    if(!box)return;
    var sessions=pushSessionHistory(avgScore,totalLines,totalUserLines,linesEvaluated);
    updateLeaderboardFromSession(avgScore,totalUserLines,linesEvaluated);
    var recent=sessions.slice(-12).map(function(s){return s.avgScore||0});
    var streak=calcDailyStreak(sessions);
    var diff=S.scriptDifficulty||{label:'Easy',score:0};
    var bookmarkedCount=getReportBookmarkedLineCount();
    box.innerHTML=''
        +'<div class="mini-card">'
        +'<div class="flex items-center justify-between gap-2 mb-2">'
        +'<h4 class="text-sf-50 font-display font-semibold">Progress Over Time</h4>'
        +'<span class="text-xs text-sf-300">'+sessions.length+' sessions</span>'
        +'</div>'
        +buildScoreTrendSVG(recent)
        +'<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-sage-400 font-semibold">'+streak+'</div><div class="text-sf-300">Day Streak</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-copper-400 font-semibold">'+diff.label+' ('+diff.score+')</div><div class="text-sf-300">Script Difficulty</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-sf-100 font-semibold">'+linesEvaluated+'/'+totalUserLines+'</div><div class="text-sf-300">Lines Scored</div></div>'
        +'<div class="bg-white/3 rounded-lg p-2 text-center"><div class="text-copper-400 font-semibold">'+bookmarkedCount+'</div><div class="text-sf-300">Bookmarked</div></div>'
        +'</div>'
        +'</div>'
        +buildAdvancedStatsHTML();
}

function updateBookmarkButton(btn,isMarked){
    if(!btn)return;
    btn.className='ml-auto w-7 h-7 rounded-md border transition-all flex items-center justify-center '
        +(isMarked
            ?'bg-copper-500/20 border-copper-500/35 text-copper-400'
            :'bg-white/5 border-white/10 text-sf-300 hover:text-sf-100 hover:bg-white/10');
    btn.title=isMarked?'Remove bookmark':'Bookmark hard line';
    btn.setAttribute('aria-label',btn.title);
    btn.innerHTML='<i class="fas fa-bookmark"></i>';
}

function toggleLineBookmark(i){
    var line=S.lines[i];
    if(!line||S.userRoles.indexOf(line.role)===-1)return;
    var marked=toggleReportLineBookmark(i,line.text,S.lineScores[i]);
    updateBookmarkButton(document.getElementById('bm-line-'+i),marked);
    toast(marked?'Bookmarked line '+(i+1)+'.':'Removed bookmark for line '+(i+1)+'.','info');
}

function shareScorecardImage(){
    var target=document.querySelector('#complete-screen .max-w-4xl');
    if(!target){toast('Scorecard not available yet.','error');return}
    if(typeof html2canvas==='undefined'){toast('Share tool is loading. Try again.','info');return}

    var bg=getComputedStyle(document.documentElement).getPropertyValue('--sf-bg').trim()||'#0D0D0F';
    html2canvas(target,{backgroundColor:bg,scale:2,useCORS:true})
        .then(function(canvas){
            return new Promise(function(resolve,reject){
                canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error('No image blob produced'))},'image/png');
            });
        })
        .then(function(blob){
            var filename='voqua-scorecard-'+Date.now()+'.png';
            var file=new File([blob],filename,{type:'image/png'});
            if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
                return navigator.share({title:'My Voqua Scorecard',text:'My latest Voqua report',files:[file]})
                    .then(function(){toast('Scorecard shared.','success')})
                    .catch(function(err){if(err&&err.name!=='AbortError')throw err});
            }
            var u=URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=u;
            a.download=filename;
            a.click();
            setTimeout(function(){URL.revokeObjectURL(u)},0);
            toast('Scorecard image downloaded.','success');
        })
        .catch(function(err){
            console.error(err);
            toast('Could not create scorecard image.','error');
        });
}

function renderReportUI(){
    S.screen='complete';

    /* ── Gather all stats ── */
    var scores=[],k;
    var totalUserLines=S.lines.filter(function(l){return S.userRoles.indexOf(l.role)!==-1}).length;
    var totalLines=S.lines.length;

    for(k in S.lineScores){if(S.lineScores[k]!=null)scores.push(S.lineScores[k])}
    var avg=scores.length?Math.round(scores.reduce(function(a,b){return a+b},0)/scores.length):0;
    var best=scores.length?Math.max.apply(null,scores):0;
    var worst=scores.length?Math.min.apply(null,scores):0;
    var linesEvaluated=scores.length;
    var linesCorrect=scores.filter(function(s){return s>=80}).length;
    var linesGood=scores.filter(function(s){return s>=50&&s<80}).length;
    var linesNeedsWork=scores.filter(function(s){return s<50}).length;
    var linesSkipped=totalUserLines-linesEvaluated;
    var correctPct=linesEvaluated?Math.round(linesCorrect/linesEvaluated*100):0;

    $('st-lines').textContent=totalUserLines;
    $('st-eval').textContent=linesEvaluated;
    $('st-correct').textContent=linesCorrect;
    $('st-best').textContent=best;
    $('final-score').textContent=avg;
    var elapsed=Math.round((Date.now()-S.sessionStart)/1000);
    $('st-time').textContent=elapsed>=60?Math.floor(elapsed/60)+'m '+elapsed%60+'s':elapsed+'s';

    var C=326.73,off=C*(1-avg/100),ring=$('final-ring');
    ring.style.strokeDashoffset=C;
    requestAnimationFrame(function(){requestAnimationFrame(function(){ring.style.strokeDashoffset=off})});
    if(avg===100)launchPerfectScoreConfetti();
    renderReportInsights(avg,totalLines,totalUserLines,linesEvaluated);

    /* ── Build stats summary bar ── */
    var statsHtml='<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold text-sf-50">'+totalLines+'</div><div class="text-[10px] text-sf-300 mt-0.5">Total Lines</div></div>'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold text-copper-400">'+totalUserLines+'</div><div class="text-[10px] text-sf-300 mt-0.5">Your Lines</div></div>'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold text-sage-400">'+linesEvaluated+'</div><div class="text-[10px] text-sf-300 mt-0.5">Lines Spoken</div></div>'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold '+(correctPct>=70?'text-sage-400':correctPct>=40?'text-copper-400':'text-coral-400')+'">'+correctPct+'%</div><div class="text-[10px] text-sf-300 mt-0.5">Correct (≥80)</div></div>'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold text-sf-50">'+avg+'<span class="text-xs text-sf-300 font-normal">/100</span></div><div class="text-[10px] text-sf-300 mt-0.5">Avg Score</div></div>'
        +'<div class="bg-white/3 rounded-xl p-3 text-center"><div class="text-lg font-display font-bold text-sf-50">'+best+'<span class="text-xs text-sf-300 font-normal"> / '+worst+'</span></div><div class="text-[10px] text-sf-300 mt-0.5">Best / Worst</div></div>'
        +'</div>';

    /* ── Grade distribution bar ── */
    var userLineDen=Math.max(1,totalUserLines);
    var gradeBar='<div class="flex items-center gap-4 mb-6">'
        +'<div class="flex-1 flex h-3 rounded-full overflow-hidden bg-white/5">'
        +'<div class="bg-sage-500 transition-all duration-700" style="width:'+(linesEvaluated?(linesCorrect/userLineDen*100):0)+'%" title="Excellent ('+linesCorrect+')"></div>'
        +'<div class="bg-copper-500 transition-all duration-700" style="width:'+(linesEvaluated?(linesGood/userLineDen*100):0)+'%" title="Good ('+linesGood+')"></div>'
        +'<div class="bg-coral-500 transition-all duration-700" style="width:'+(linesEvaluated?(linesNeedsWork/userLineDen*100):0)+'%" title="Needs Work ('+linesNeedsWork+')"></div>'
        +'</div>'
        +'</div>';

    var legend='<div class="flex flex-wrap items-center gap-4 mb-6 text-xs">'
        +'<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sage-500 inline-block"></span><span class="text-sf-300">Excellent (80-100): <strong class="text-sage-400">'+linesCorrect+'</strong></span></div>'
        +'<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-copper-500 inline-block"></span><span class="text-sf-300">Good (50-79): <strong class="text-copper-400">'+linesGood+'</strong></span></div>'
        +'<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-coral-500 inline-block"></span><span class="text-sf-300">Needs Work (0-49): <strong class="text-coral-400">'+linesNeedsWork+'</strong></span></div>'
        +(linesSkipped>0?'<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-white/10 inline-block border border-white/20"></span><span class="text-sf-300">Skipped: <strong class="text-sf-100">'+linesSkipped+'</strong></span></div>':'')
        +'</div>';

    /* ── Line-by-line breakdown ── */
    var rc=$('report-lines');
    rc.innerHTML=statsHtml+gradeBar+legend+'<h3 class="font-display font-semibold text-lg text-sf-50 mb-4">Line-by-Line Breakdown</h3>'
        +S.lines.map(function(line,i){
        var isU=S.userRoles.indexOf(line.role)!==-1,sc=S.lineScores[i],det=S.lineDetails[i],resp=S.userResponses[i],clip=S.audioClips[i],isLow=sc!=null&&sc<50;
        var isMarked=isU&&isReportLineBookmarked(i,line.text);
        if(!isU)return '<div class="report-card bg-white/2 rounded-xl px-4 py-3 border border-white/5 flex items-start gap-3"><span class="text-xs text-sf-300 font-mono w-6 text-right flex-shrink-0 pt-0.5">'+(i+1)+'</span><div class="flex-1 min-w-0"><span class="text-xs text-sage-400 font-semibold">'+esc(line.role)+'</span><p class="text-sm text-sf-200 mt-0.5 truncate">'+esc(line.text)+'</p></div><span class="text-[10px] text-sf-300 flex-shrink-0 pt-1">NPC</span></div>';
        var sb=sc!=null?'<span class="px-2.5 py-1 rounded-lg text-sm font-bold '+(sc>=80?'bg-sage-500/15 text-sage-400':sc>=50?'bg-copper-500/15 text-copper-400':'bg-coral-500/15 text-coral-400')+'">'+sc+'%</span>':'<span class="px-2.5 py-1 rounded-lg text-sm text-sf-300 bg-white/3">Skipped</span>';
        var bm='<button id="bm-line-'+i+'" onclick="toggleLineBookmark('+i+')" class="ml-auto w-7 h-7 rounded-md border transition-all flex items-center justify-center '+(isMarked?'bg-copper-500/20 border-copper-500/35 text-copper-400':'bg-white/5 border-white/10 text-sf-300 hover:text-sf-100 hover:bg-white/10')+'" title="'+(isMarked?'Remove bookmark':'Bookmark hard line')+'" aria-label="'+(isMarked?'Remove bookmark':'Bookmark hard line')+'"><i class="fas fa-bookmark"></i></button>';
        var dh='';
        if(det){
            dh='<div class="mt-2 space-y-1.5"><div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><div class="bg-white/3 rounded-lg p-2.5"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-0.5">Expected</div><p class="text-xs text-sf-100">'+esc(line.text)+'</p></div><div class="bg-white/3 rounded-lg p-2.5"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-0.5">You Said</div><p class="text-xs '+(isLow?'text-coral-400':'text-sf-100')+'">'+(resp?esc(resp):'<span class="text-sf-300 italic">No response</span>')+'</p></div></div>';
            if(det.correct_words!=null){var iy=det.correct_words.toLowerCase().indexOf('yes')!==-1;dh+='<div class="text-[10px] bg-white/2 rounded px-2 py-1.5"><span class="text-sf-300">Correct: </span><span class="check-badge '+(iy?'check-yes':'check-no')+' text-[11px]"><i class="fas '+(iy?'fa-check':'fa-xmark')+'"></i>'+esc(det.correct_words)+'</span></div>'}
            if(det.accuracy)dh+='<p class="text-[11px] text-sf-200 mt-1"><span class="text-sf-300">Accuracy:</span> '+esc(det.accuracy)+'</p>';
            if(det.encouragement)dh+='<p class="text-xs text-sage-400 italic">'+esc(det.encouragement)+'</p>';
            if(det.corrections&&det.corrections.length){dh+='<div class="text-xs text-coral-400">';det.corrections.forEach(function(c){dh+='<div><i class="fas fa-xmark mr-1" style="font-size:10px"></i>'+esc(c)+'</div>'});dh+='</div>'}
            if(det.suggestions&&det.suggestions.length){dh+='<div class="text-xs text-copper-400">';det.suggestions.forEach(function(sg){dh+='<div><i class="fas fa-lightbulb mr-1" style="font-size:10px"></i>'+esc(sg)+'</div>'});dh+='</div>'}
            if(det.deliveryNotes&&det.deliveryNotes.length){dh+='<div class="text-xs text-sage-400">';det.deliveryNotes.forEach(function(n){dh+='<div><i class="fas fa-wave-square mr-1" style="font-size:10px"></i>'+esc(n)+'</div>'});dh+='</div>'}
            dh+='</div>';
        }else if(resp){
            dh='<div class="mt-2"><div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><div class="bg-white/3 rounded-lg p-2.5"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-0.5">Expected</div><p class="text-xs text-sf-100">'+esc(line.text)+'</p></div><div class="bg-white/3 rounded-lg p-2.5"><div class="text-[10px] text-sf-300 font-semibold uppercase mb-0.5">You Said</div><p class="text-xs text-sf-100">'+esc(resp)+'</p></div></div></div>';
        }
        /* Word-level diff: show green/red words */
        if(resp)dh+=renderWordDiffHTML(line.text,resp);
        var ah='';if(clip&&clip.size>10000){var clipUrl=URL.createObjectURL(clip);_reportBlobURLs.push(clipUrl);ah='<div class="mt-2"><audio controls src="'+clipUrl+'" class="w-full h-8"></audio></div>'}
        var gradeLabel=sc!=null?(sc>=80?'<span class="text-[10px] bg-sage-500/15 text-sage-400 px-2 py-0.5 rounded font-semibold">Excellent</span>':sc>=50?'<span class="text-[10px] bg-copper-500/15 text-copper-400 px-2 py-0.5 rounded font-semibold">Good</span>':'<span class="text-[10px] bg-coral-500/15 text-coral-400 px-2 py-0.5 rounded font-semibold">Needs Work</span>'):(resp?'<span class="text-[10px] bg-white/5 text-sf-300 px-2 py-0.5 rounded font-semibold">No eval</span>':'');
        return '<div class="report-card '+(isLow?'low':'')+' bg-white/2 rounded-xl px-4 py-3 border '+(isLow?'border-coral-500/25':'border-white/5')+'"><div class="flex items-start gap-3"><span class="text-xs '+(isLow?'text-coral-400':'text-sf-300')+' font-mono w-6 text-right flex-shrink-0 pt-0.5">'+(i+1)+'</span><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="text-xs '+(isLow?'text-coral-400':'text-copper-400')+' font-semibold">'+esc(line.role)+'</span>'+sb+gradeLabel+bm+'</div>'+dh+ah+'</div></div></div>';
    }).join('');
}


function playClip(i){
    var b=S.audioClips[i];if(!b)return;
    var u=URL.createObjectURL(b),a=new Audio(u);
    a.onended=function(){URL.revokeObjectURL(u)};
    a.play().catch(function(){URL.revokeObjectURL(u)});
}
function playLatestRecording(){
    var idx=-1;
    for(var i=S.lines.length-1;i>=0;i--){
        if(S.audioClips[i]&&S.audioClips[i].size>10000){idx=i;break}
    }
    if(idx===-1){toast('No voice recording available.','info');return}
    playClip(idx);
    toast('Playing your latest recording.','success');
}

/* ═══════════════════════════════════════════════════════════════
   REPORT
═══════════════════════════════════════════════════════════════ */
function showReport(){
    stopSpeaking();
    releaseMicStream();
    switchScreen('complete');
    renderReportUI();
}

function exportPrint(){
    var scores=[],k;
    for(k in S.lineScores){if(S.lineScores[k]!=null)scores.push(S.lineScores[k])}
    var avg=scores.length?Math.round(scores.reduce(function(a,b){return a+b},0)/scores.length):0;
    var elapsed=Math.round((Date.now()-S.sessionStart)/1000);
    var rs=getComputedStyle(document.documentElement);
    var chartPrimary=rs.getPropertyValue('--sf-chart-primary').trim()||'#C8956C';
    var statusRecording=rs.getPropertyValue('--sf-status-recording').trim()||'#D4736E';
    var rows=S.lines.map(function(l,i){var sc=S.lineScores[i],resp=S.userResponses[i],det=S.lineDetails[i],isU=S.userRoles.indexOf(l.role)!==-1;return '<tr style="border-bottom:1px solid #ddd;'+(!isU?'opacity:.68':'')+'"><td style="padding:8px;font-size:13px">'+(i+1)+'</td><td style="padding:8px;font-size:13px;font-weight:600">'+esc(l.role)+'</td><td style="padding:8px;font-size:13px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.text)+'</td><td style="padding:8px;font-size:13px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(resp?esc(resp):'--')+'</td><td style="padding:8px;font-size:13px;text-align:center;'+(sc!=null&&sc<50?'color:'+statusRecording+';font-weight:700':'')+'">'+(sc!=null?sc:'--')+'</td><td style="padding:8px;font-size:12px;color:#555;max-width:160px">'+(det&&det.encouragement?esc(det.encouragement):'--')+'</td></tr>'}).join('');
    var modeLabel=S.mode==='presentation'?'Presentation':'Practice';
    var html='<!DOCTYPE html><html><head><title>Voqua Report</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#222}h1{font-size:28px;margin-bottom:4px;color:'+chartPrimary+'}h2{font-size:16px;color:#666;font-weight:400;margin-bottom:20px}.stats{display:flex;gap:24px;margin-bottom:24px}.stat{text-align:center}.stat .val{font-size:32px;font-weight:700}.stat .lbl{font-size:12px;color:#888}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #ddd}</style></head><body><h1>Voqua Report</h1><h2>'+LANG[S.language].name+' &middot; '+modeLabel+' &middot; '+new Date().toLocaleDateString()+'</h2><div class="stats"><div class="stat"><div class="val">'+avg+'</div><div class="lbl">Average</div></div><div class="stat"><div class="val">'+(scores.length?Math.max.apply(null,scores):0)+'</div><div class="lbl">Best</div></div><div class="stat"><div class="val">'+S.lines.length+'</div><div class="lbl">Lines</div></div><div class="stat"><div class="val">'+(elapsed>=60?Math.floor(elapsed/60)+'m '+elapsed%60+'s':elapsed+'s')+'</div><div class="lbl">Time</div></div></div><table><thead><tr><th>#</th><th>Role</th><th>Expected</th><th>You Said</th><th>Score</th><th>Feedback</th></tr></thead><tbody>'+rows+'</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
    var w=window.open('','_blank');
    if(w){w.document.write(html);w.document.close()}else toast('Pop-up blocked.','error');
}

function exportPDF(){
    var scores=[],k;
    for(k in S.lineScores){if(S.lineScores[k]!=null)scores.push(S.lineScores[k])}
    if(!scores.length){toast('No scores to export yet.','info');return}
    var avg=scores.length?Math.round(scores.reduce(function(a,b){return a+b},0)/scores.length):0;
    var best=scores.length?Math.max.apply(null,scores):0;
    var worst=scores.length?Math.min.apply(null,scores):0;
    var elapsed=Math.round((Date.now()-S.sessionStart)/1000);
    var modeLabel=S.mode==='presentation'?'Presentation':'Practice';
    var fileName='voqua-report-'+Date.now()+'.pdf';
    var totalUserLines=S.lines.filter(function(l){return S.userRoles.indexOf(l.role)!==-1}).length;
    var linesCorrect=scores.filter(function(s){return s>=80}).length;
    var linesGood=scores.filter(function(s){return s>=50&&s<80}).length;
    var linesNeedsWork=scores.filter(function(s){return s<50}).length;
    var avgCol=avg>=80?'#166534':avg>=50?'#92400e':'#991b1b';
    var avgBg=avg>=80?'#dcfce7':avg>=50?'#fef9c3':'#fee2e2';

    var distBar='<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin:10px 0 6px">'
        +'<div style="background:#5BB882;width:'+(totalUserLines?linesCorrect/totalUserLines*100:0)+'%"></div>'
        +'<div style="background:#E8B88A;width:'+(totalUserLines?linesGood/totalUserLines*100:0)+'%"></div>'
        +'<div style="background:#D4736E;width:'+(totalUserLines?linesNeedsWork/totalUserLines*100:0)+'%"></div>'
        +'</div>'
        +'<div style="display:flex;gap:16px;font-size:10px;color:#6b7280;margin-bottom:20px">'
        +'<span><span style="color:#5BB882">&#9632;</span> Excellent (80+): '+linesCorrect+'</span>'
        +'<span><span style="color:#E8B88A">&#9632;</span> Good (50-79): '+linesGood+'</span>'
        +'<span><span style="color:#D4736E">&#9632;</span> Needs Work: '+linesNeedsWork+'</span>'
        +'</div>';

    var rows=S.lines.map(function(l,i){
        var sc=S.lineScores[i];
        var resp=S.userResponses[i];
        var det=S.lineDetails[i];
        var isU=S.userRoles.indexOf(l.role)!==-1;
        var scoreColor=sc!=null?(sc>=80?'#166534':sc>=50?'#8f3f0e':'#991b1b'):'#9ca3af';
        var scoreBg=sc!=null?(sc>=80?'#dcfce7':sc>=50?'#fef9c3':'#fee2e2'):'#f3f4f6';
        var rowBg=!isU?'#f9fafb':'#ffffff';
        return '<tr style="border-bottom:1px solid #e5e7eb;background:'+rowBg+'">'
            +'<td style="padding:9px 8px;font-size:11px;color:#9ca3af;text-align:center">'+(i+1)+'</td>'
            +'<td style="padding:9px 8px;font-size:12px;font-weight:600;color:'+(!isU?'#9ca3af':'#111827')+'">'+esc(l.role)+((!isU)?' <span style="font-size:9px;font-weight:400">(NPC)</span>':'')+'</td>'
            +'<td style="padding:9px 8px;font-size:12px;color:#374151">'+esc(l.text)+'</td>'
            +'<td style="padding:9px 8px;font-size:12px;color:#374151">'+(resp?esc(resp):'<span style="color:#9ca3af;font-style:italic">\u2014</span>')+'</td>'
            +'<td style="padding:9px 8px;text-align:center">'
            +(sc!=null?'<span style="background:'+scoreBg+';color:'+scoreColor+';padding:3px 9px;border-radius:6px;font-size:12px;font-weight:700">'+sc+'</span>':(!isU?'':'<span style="color:#9ca3af;font-size:11px">Skip</span>'))
            +'</td>'
            +'<td style="padding:9px 8px;font-size:11px;color:#6b7280">'+(det&&det.encouragement?esc(det.encouragement):(det&&det.accuracy?esc(det.accuracy):''))+'</td>'
            +'</tr>';
    }).join('');

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Voqua Report</title>'
        +'<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>'
        +'<style>'
        +'*{box-sizing:border-box;margin:0;padding:0}'
        +'body{font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#111827;background:#fff;font-size:13px}'
        +'.header{border-bottom:3px solid #C8956C;padding-bottom:16px;margin-bottom:20px}'
        +'.brand{font-size:26px;font-weight:800;color:#C8956C;letter-spacing:-0.5px}'
        +'.subtitle{font-size:12px;color:#6b7280;margin-top:3px}'
        +'.stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px}'
        +'.stat-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center}'
        +'.stat-val{font-size:20px;font-weight:700;color:#111827}'
        +'.stat-lbl{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}'
        +'.section-title{font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}'
        +'table{width:100%;border-collapse:collapse}'
        +'th{text-align:left;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9ca3af;border-bottom:2px solid #e5e7eb;background:#f9fafb}'
        +'.footer{margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#d1d5db;text-align:center}'
        +'</style></head><body>'
        +'<div class="header">'
        +'<div class="brand">Voqua</div>'
        +'<div class="subtitle">'+LANG[S.language].name+' &nbsp;&middot;&nbsp; '+modeLabel+' Mode &nbsp;&middot;&nbsp; '+new Date().toLocaleDateString()+' &nbsp;&middot;&nbsp; '+(elapsed>=60?Math.floor(elapsed/60)+'m '+elapsed%60+'s':elapsed+'s')+'</div>'
        +'</div>'
        +'<div class="stats-grid">'
        +'<div class="stat-box"><div class="stat-val" style="color:'+avgCol+'">'+avg+'</div><div class="stat-lbl">Average</div></div>'
        +'<div class="stat-box"><div class="stat-val">'+best+'</div><div class="stat-lbl">Best</div></div>'
        +'<div class="stat-box"><div class="stat-val">'+worst+'</div><div class="stat-lbl">Worst</div></div>'
        +'<div class="stat-box"><div class="stat-val">'+S.lines.length+'</div><div class="stat-lbl">Total Lines</div></div>'
        +'<div class="stat-box"><div class="stat-val">'+totalUserLines+'</div><div class="stat-lbl">Your Lines</div></div>'
        +'<div class="stat-box"><div class="stat-val">'+scores.length+'</div><div class="stat-lbl">Evaluated</div></div>'
        +'</div>'
        +'<p class="section-title">Score Distribution</p>'
        +distBar
        +'<p class="section-title">Line by Line Breakdown</p>'
        +'<table><thead><tr><th>#</th><th>Role</th><th>Expected</th><th>You Said</th><th>Score</th><th>Feedback</th></tr></thead><tbody>'+rows+'</tbody></table>'
        +'<div class="footer">Generated by Voqua &middot; AI-powered speech coaching &middot; '+new Date().toISOString()+'</div>'
        +'<script>window.onload=function(){html2pdf().set({margin:[8,8,8,8],filename:"'+fileName+'",image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(document.body).save().then(function(){setTimeout(function(){window.close()},500);});}<\/script>'
        +'</body></html>';

    var w=window.open('','_blank');
    if(w){w.document.write(html);w.document.close();}
    else{toast('Popup blocked. Allow popups and try again.','error');}
}

function restartSession(){
    releaseMicStream();
    S.currentLine=0;S.userInput='';S.isProcessing=false;S.sessionStart=Date.now();
    S.lineScores={};S.lineDetails={};S.userResponses={};S.audioClips={};S.attemptCount={};S.hintShown={};S.presState=PS.HIDDEN;
    stopSpeaking();
    switchScreen('session');
    $('hint-ctrl').classList.toggle('hidden',S.mode!=='presentation');
    renderAllHintPills();
    renderSession();
    if(isPracticeLikeMode()){var fl=S.lines[0];if(fl&&S.userRoles.indexOf(fl.role)===-1)speak(fl.text,null,false)}
}
function newDialogue(){releaseMicStream();switchScreen('setup');showSetupTab('home')}

/* ═══════════════════════════════════════════════════════════════
   WORD-LEVEL DIFF
   Compare expected vs spoken word-by-word, ignoring punctuation.
   Uses 3-pass matching: exact position, exact anywhere, fuzzy (Levenshtein).
═══════════════════════════════════════════════════════════════ */
function levenshtein(a,b){
    if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
    var m=[];for(var i=0;i<=b.length;i++)m[i]=[i];
    for(var j=0;j<=a.length;j++)m[0][j]=j;
    for(var i=1;i<=b.length;i++)for(var j=1;j<=a.length;j++)
        m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1);
    return m[b.length][a.length];
}
function wordDiff(expected,actual){
    /* Strip punctuation, normalize whitespace, lowercase */
    var clean=function(s){return s.replace(/[.,;:!?"'()\[\]{}\-–—…\u00A0]/g,' ').replace(/\s+/g,' ').trim().toLowerCase()};
    var expW=clean(expected).split(' ').filter(function(w){return w.length>0});
    var actW=clean(actual).split(' ').filter(function(w){return w.length>0});
    if(!expW.length)return{html:'',pct:0,correct:0,total:0};
    if(!actW.length)return{html:'<span class="wd-miss">'+esc(expected)+'</span>',pct:0,correct:0,total:expW.length};
    /* Pass 1: exact match in same position */
    var matched=new Array(expW.length).fill(false);
    var used=new Array(actW.length).fill(false);
    for(var i=0;i<Math.min(expW.length,actW.length);i++){
        if(expW[i]===actW[i]){matched[i]=true;used[i]=true}
    }
    /* Pass 2: exact match anywhere else */
    for(var i=0;i<expW.length;i++){if(matched[i])continue;for(var j=0;j<actW.length;j++){if(!used[j]&&expW[i]===actW[j]){matched[i]=true;used[j]=true;break}}}
    /* Pass 3: fuzzy match (Levenshtein distance ≤ threshold) */
    for(var i=0;i<expW.length;i++){if(matched[i])continue;
        var thr=Math.max(1,Math.floor(Math.min(expW[i].length,4)/3));
        for(var j=0;j<actW.length;j++){if(!used[j]&&levenshtein(expW[i],actW[j])<=thr){matched[i]=true;used[j]=true;break}}
    }
    /* Build colored HTML */
    var html='',correct=0;
    for(var i=0;i<expW.length;i++){
        if(matched[i]){html+='<span class="wd-ok">'+esc(expW[i])+'</span> ';correct++}
        else html+='<span class="wd-miss">'+esc(expW[i])+'</span> ';
    }
    return{html:html,pct:Math.round(correct/expW.length*100),correct:correct,total:expW.length};
}
function renderWordDiffHTML(expected,actual){
    if(!actual)return'';
    var wd=wordDiff(expected,actual);
    var pctColor=wd.pct>=80?'text-sage-400':wd.pct>=50?'text-copper-400':'text-coral-400';
    return '<div class="wd-section mt-2">'
        +'<div class="wd-label"><i class="fas fa-spell-check mr-1"></i>Word Match: <span class="'+pctColor+'">'+wd.pct+'%</span> <span class="text-sf-300">('+wd.correct+'/'+wd.total+')</span></div>'
        +'<div class="wd-words">'+wd.html+'</div>'
        +'</div>';
}
