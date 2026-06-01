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

function exportJSON(){
    var scores=[],k;
    for(k in S.lineScores){if(S.lineScores[k]!=null)scores.push(S.lineScores[k])}
    var data={session:{language:S.language,mode:S.mode,hintLevel:S.hintLevel,duration:Math.round((Date.now()-S.sessionStart)/1000),timestamp:new Date().toISOString(),model:_workingModel||MODEL},overall:{avgScore:scores.length?Math.round(scores.reduce(function(a,b){return a+b},0)/scores.length):0,bestScore:scores.length?Math.max.apply(null,scores):0,linesEvaluated:scores.length,totalLines:S.lines.length},lines:S.lines.map(function(l,i){return{index:i,role:l.role,isUser:S.userRoles.indexOf(l.role)!==-1,expectedText:l.text,userResponse:S.userResponses[i]||null,score:S.lineScores[i]!=null?S.lineScores[i]:null,feedback:S.lineDetails[i]||null,attempts:S.attemptCount[i]||0,hasAudio:!!S.audioClips[i]}})};
    var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    var u=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=u;a.download='voqua-report-'+Date.now()+'.json';a.click();URL.revokeObjectURL(u);
    toast('Report exported.','success');
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
    if(typeof html2pdf==='undefined'){toast('PDF tool is loading. Try again.','info');return}

    /* ── Raw stats ── */
    var scores=[],k;
    for(k in S.lineScores){if(S.lineScores[k]!=null)scores.push(S.lineScores[k])}
    var avg=scores.length?Math.round(scores.reduce(function(a,b){return a+b},0)/scores.length):0;
    var best=scores.length?Math.max.apply(null,scores):0;
    var worst=scores.length?Math.min.apply(null,scores):100;
    var evalCount=scores.length;
    var userLineCount=S.lines.filter(function(l){return isUserRole(l.role)}).length;
    var linesCorrect=scores.filter(function(s){return s>=80}).length;
    var linesGood=scores.filter(function(s){return s>=50&&s<80}).length;
    var linesWeak=scores.filter(function(s){return s<50}).length;
    var linesSkipped=userLineCount-evalCount;
    var elapsed=Math.round((Date.now()-S.sessionStart)/1000);
    var ts=elapsed>=60?Math.floor(elapsed/60)+'m '+Math.floor(elapsed%60)+'s':elapsed+'s';
    var modeLabel=S.mode==='presentation'?'Presentation':'Practice';
    var avgCol=avg>=80?'#166534':avg>=50?'#92400e':'#991b1b';
    var avgBg=avg>=80?'#f0fdf4':avg>=50?'#fffbeb':'#fef2f2';
    var langName=LANG[S.language].name;
    var diff=S.scriptDifficulty||{label:'Unknown',score:0};

    /* ── Aggregate feedback + word-match across all evaluated lines ── */
    var allCorrections=[],allSuggestions=[],allDelivery=[],wordMatchScores=[];
    for(k in S.lineDetails){
        var _d=S.lineDetails[k];if(!_d)continue;
        if(_d.corrections)_d.corrections.forEach(function(c){allCorrections.push(c)});
        if(_d.suggestions)_d.suggestions.forEach(function(s){allSuggestions.push(s)});
        if(_d.deliveryNotes)_d.deliveryNotes.forEach(function(n){allDelivery.push(n)});
        var _resp=S.userResponses[k],_line=S.lines[parseInt(k)];
        if(_resp&&_line){wordMatchScores.push(wordDiff(_line.text,_resp).pct);}
    }
    var avgWordMatch=wordMatchScores.length?Math.round(wordMatchScores.reduce(function(a,b){return a+b},0)/wordMatchScores.length):0;

    /* ── Standard deviation ── */
    var scoreVariance=0;
    if(scores.length>1){scores.forEach(function(s){scoreVariance+=(s-avg)*(s-avg)});scoreVariance=Math.round(scoreVariance/scores.length);}
    var stdDev=Math.round(Math.sqrt(scoreVariance));

    /* ── Ordered scored lines for chart ── */
    var scoredWithIdx=[];
    for(k in S.lineScores){if(S.lineScores[k]!=null)scoredWithIdx.push({i:parseInt(k),s:S.lineScores[k]})}
    scoredWithIdx.sort(function(a,b){return a.i-b.i});

    /* ── Executive summary prose ── */
    var overallGrade=avg>=90?'Outstanding':avg>=80?'Strong':avg>=65?'Solid':avg>=50?'Developing':'Needs Significant Work';
    var coverageNote=evalCount===userLineCount
        ?'All '+userLineCount+' of your lines were spoken and evaluated.'
        :'You spoke '+evalCount+' of '+userLineCount+' lines'+(linesSkipped>0?' ('+linesSkipped+' skipped).':'.');
    var consistencyNote=stdDev<=10
        ?'Your performance was highly consistent (std.\u00a0dev.\u00a0'+stdDev+'), suggesting stable command of the material.'
        :stdDev<=20
            ?'Scores varied moderately (std.\u00a0dev.\u00a0'+stdDev+') \u2014 normal for scripts where some lines are harder than others.'
            :'Scores varied considerably (std.\u00a0dev.\u00a0'+stdDev+'), indicating well-mastered lines alongside ones needing targeted attention.';
    var wordMatchNote=avgWordMatch>=85
        ?'Average word accuracy of '+avgWordMatch+'% shows high-fidelity script delivery.'
        :avgWordMatch>=65
            ?'Average word accuracy of '+avgWordMatch+'% shows reasonable alignment, with some omissions or substitutions worth reviewing.'
            :'Average word accuracy of '+avgWordMatch+'% suggests frequent deviation from the script \u2014 slow read-throughs and memorisation drills are recommended.';
    var strengthNote=linesCorrect>0
        ?linesCorrect+' line'+(linesCorrect>1?'s':'')+(linesCorrect>1?' scored':' scored')+' Excellent (80+), demonstrating strong delivery in those moments.'
        :'No lines reached the Excellent threshold yet \u2014 this will improve with focused repetition.';
    var weakNote=linesWeak>0
        ?linesWeak+' line'+(linesWeak>1?'s':'')+(linesWeak>1?' scored':' scored')+' below 50 \u2014 these are your clearest targets for improvement.'
        :'No lines scored below 50 \u2014 a strong overall showing.';

    /* ── Score distribution bar (HTML) ── */
    var den=Math.max(1,userLineCount);
    var corrPct=Math.round(linesCorrect/den*100);
    var goodPct=Math.round(linesGood/den*100);
    var weakPct=Math.round(linesWeak/den*100);
    var skipPct=Math.round(linesSkipped/den*100);
    var distBar='<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:#f3f4f6;margin:8px 0">'
        +(corrPct?'<div style="width:'+corrPct+'%;background:#16a34a"></div>':'')
        +(goodPct?'<div style="width:'+goodPct+'%;background:#d97706"></div>':'')
        +(weakPct?'<div style="width:'+weakPct+'%;background:#dc2626"></div>':'')
        +(skipPct?'<div style="width:'+skipPct+'%;background:#e5e7eb"></div>':'')
        +'</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:10px;color:#6b7280;margin-top:4px">'
        +'<span><b style="color:#16a34a">\u25cf</b> Excellent\u00a080-100:\u00a0<b>'+linesCorrect+'</b>\u00a0('+corrPct+'%)</span>'
        +'<span><b style="color:#d97706">\u25cf</b> Good\u00a050-79:\u00a0<b>'+linesGood+'</b>\u00a0('+goodPct+'%)</span>'
        +'<span><b style="color:#dc2626">\u25cf</b> Needs\u00a0Work\u00a00-49:\u00a0<b>'+linesWeak+'</b>\u00a0('+weakPct+'%)</span>'
        +(linesSkipped?'<span><b style="color:#9ca3af">\u25cf</b> Skipped:\u00a0<b>'+linesSkipped+'</b></span>':'')
        +'</div>';

    /* ── Per-line bar chart (inline SVG) ── */
    var chartSVG='';
    if(scoredWithIdx.length>1){
        var bw=Math.max(12,Math.min(26,Math.floor(490/scoredWithIdx.length)-3));
        var bars=scoredWithIdx.map(function(item,n){
            var col=item.s>=80?'#16a34a':item.s>=50?'#d97706':'#dc2626';
            var bh=Math.round((item.s/100)*70);
            return '<g transform="translate('+(n*(bw+3))+',0)">'
                +'<rect x="0" y="'+(70-bh)+'" width="'+bw+'" height="'+bh+'" fill="'+col+'" rx="2"/>'
                +'<text x="'+(bw/2)+'" y="84" font-size="7.5" text-anchor="middle" fill="#9ca3af">L'+(item.i+1)+'</text>'
                +'<text x="'+(bw/2)+'" y="'+(70-bh-3)+'" font-size="7.5" text-anchor="middle" fill="'+col+'">'+item.s+'</text>'
                +'</g>';
        }).join('');
        var cw=scoredWithIdx.length*(bw+3);
        chartSVG='<div style="overflow-x:auto;padding:4px 0">'
            +'<svg viewBox="0 0 '+cw+' 90" width="'+Math.min(cw,680)+'" height="90" style="display:block;margin:0 auto">'
            +'<line x1="0" y1="70" x2="'+cw+'" y2="70" stroke="#e5e7eb" stroke-width="1"/>'
            +bars+'</svg>'
            +'<div style="text-align:center;font-size:9px;color:#9ca3af;margin-top:2px">L# = line number in script</div>'
            +'</div>';
    }

    /* ── Deduplicated aggregated feedback lists ── */
    function _dedup(arr){var seen={};return arr.filter(function(x){var key=x.toLowerCase().slice(0,42);if(seen[key])return false;seen[key]=true;return true})}
    var uCorr=_dedup(allCorrections).slice(0,10);
    var uSugg=_dedup(allSuggestions).slice(0,8);
    var uDeliv=_dedup(allDelivery).slice(0,8);
    var liOf=function(arr,col){return arr.length
        ?arr.map(function(x){return '<li style="margin-bottom:3px;color:'+col+'">'+esc(x)+'</li>'}).join('')
        :'<li style="color:#9ca3af;font-style:italic">None flagged.</li>';};

    /* ── Detailed per-line cards ── */
    var lineCards=S.lines.map(function(l,i){
        var isU=isUserRole(l.role);
        var sc=S.lineScores[i],resp=S.userResponses[i],det=S.lineDetails[i],att=S.attemptCount[i]||0;
        if(!isU){
            return '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 12px;margin-bottom:7px;display:flex;align-items:center;gap:10px">'
                +'<span style="font-size:10px;color:#9ca3af;width:18px;text-align:right;flex-shrink:0">'+(i+1)+'</span>'
                +'<span style="font-size:10px;font-weight:700;color:#6b7280;min-width:55px;flex-shrink:0">'+esc(l.role)+'</span>'
                +'<span style="font-size:11px;color:#9ca3af;flex:1">'+esc(l.text)+'</span>'
                +'<span style="font-size:9px;color:#d1d5db">NPC</span>'
                +'</div>';
        }
        var scCol=sc!=null?(sc>=80?'#166534':sc>=50?'#92400e':'#991b1b'):'#9ca3af';
        var scBg=sc!=null?(sc>=80?'#f0fdf4':sc>=50?'#fffbeb':'#fef2f2'):'#f9fafb';
        var scLabel=sc!=null?(sc>=80?'Excellent':sc>=50?'Good':'Needs Work'):'Skipped';
        var borderCol=sc!=null?(sc>=80?'#86efac':sc>=50?'#fcd34d':'#fca5a5'):'#e5e7eb';

        /* Word diff */
        var wdHtml='';
        if(resp){
            var _wd=wordDiff(l.text,resp);
            var wdCol=_wd.pct>=80?'#166534':_wd.pct>=50?'#92400e':'#991b1b';
            wdHtml='<div style="font-size:10px;color:#6b7280;margin-top:5px">'
                +'<b>Word accuracy:</b> <span style="color:'+wdCol+';font-weight:700">'+_wd.pct+'%</span>'
                +' ('+_wd.correct+'/'+_wd.total+' words)'
                +(_wd.total>_wd.correct?' \u2014 '+(_wd.total-_wd.correct)+' word'+(_wd.total-_wd.correct!==1?'s':'')+' missed/substituted':'')
                +'</div>';
        }

        /* Feedback block */
        var fbHtml='';
        if(det){
            var frows=[['Accuracy',det.accuracy],['Pronunciation',det.grammar],['Fluency',det.fluency]].filter(function(r){return r[1]});
            if(frows.length){
                fbHtml+='<table style="width:100%;border-collapse:collapse;margin-top:7px">';
                frows.forEach(function(r){fbHtml+='<tr><td style="padding:2px 8px 2px 0;font-size:10px;font-weight:700;color:#6b7280;white-space:nowrap;width:85px">'+r[0]+'</td><td style="padding:2px 0;font-size:11px;color:#374151">'+esc(r[1])+'</td></tr>';});
                fbHtml+='</table>';
            }
            if(det.encouragement)fbHtml+='<div style="font-size:11px;color:#166534;font-style:italic;margin-top:5px;padding:4px 8px;background:#f0fdf4;border-radius:4px">\u2665 '+esc(det.encouragement)+'</div>';
            if(det.corrections&&det.corrections.length){
                fbHtml+='<div style="margin-top:5px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#991b1b;margin-bottom:2px">Corrections</div>';
                det.corrections.forEach(function(c){fbHtml+='<div style="font-size:11px;color:#991b1b;margin-bottom:2px">\u2717 '+esc(c)+'</div>';});
                fbHtml+='</div>';
            }
            if(det.suggestions&&det.suggestions.length){
                fbHtml+='<div style="margin-top:5px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#92400e;margin-bottom:2px">Tips</div>';
                det.suggestions.forEach(function(sg){fbHtml+='<div style="font-size:11px;color:#92400e;margin-bottom:2px">\u2192 '+esc(sg)+'</div>';});
                fbHtml+='</div>';
            }
            if(det.deliveryNotes&&det.deliveryNotes.length){
                fbHtml+='<div style="margin-top:5px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1d4ed8;margin-bottom:2px">Delivery</div>';
                det.deliveryNotes.forEach(function(n){fbHtml+='<div style="font-size:11px;color:#1d4ed8;margin-bottom:2px">\u25b8 '+esc(n)+'</div>';});
                fbHtml+='</div>';
            }
        }

        return '<div style="border:1.5px solid '+borderCol+';border-radius:9px;padding:13px 15px;margin-bottom:11px;background:'+scBg+'">'
            +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:7px">'
            +'<div style="flex:1">'
            +'<div style="font-size:9.5px;font-weight:800;color:#9ca3af;margin-bottom:3px">LINE '+(i+1)+(att>1?' \u00b7 '+att+' attempts':'')+'</div>'
            +'<div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:4px">'+esc(l.role)+'</div>'
            +'<div style="font-size:12px;color:#374151;font-style:italic;line-height:1.5">\u201c'+esc(l.text)+'\u201d</div>'
            +'</div>'
            +'<div style="text-align:center;flex-shrink:0;background:#fff;border:2px solid '+borderCol+';border-radius:8px;padding:5px 11px">'
            +'<div style="font-size:21px;font-weight:900;color:'+scCol+';line-height:1">'+(sc!=null?sc:'\u2014')+'</div>'
            +'<div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;color:'+scCol+'">'+scLabel+'</div>'
            +'</div>'
            +'</div>'
            +(resp
                ?'<div style="background:#fff;border:1px solid #e5e7eb;border-radius:5px;padding:6px 9px;margin-bottom:5px">'
                    +'<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:2px">You Said</div>'
                    +'<div style="font-size:12px;color:#111827;line-height:1.5">'+esc(resp)+'</div>'
                    +'</div>'
                :'<div style="font-size:11px;color:#9ca3af;font-style:italic;margin-bottom:5px">No response recorded.</div>'
            )
            +wdHtml+fbHtml
            +'</div>';
    }).join('');

    /* ── Recommendations (data-driven) ── */
    var recs=[];
    if(linesWeak>0)recs.push('Focus on the <b>'+linesWeak+' line'+(linesWeak>1?'s':'')+'</b> scored below 50 \u2014 isolate each in Practice Mode and repeat until consistently hitting 70+.');
    if(avgWordMatch<75)recs.push('Word accuracy ('+avgWordMatch+'%) is below the 75% target. Read the script aloud slowly before the next session to build muscle memory for the exact phrasing.');
    if(linesSkipped>0)recs.push('<b>'+linesSkipped+' line'+(linesSkipped>1?'s were':' was')+'</b> skipped and left unevaluated. Returning to these in Practice Mode will give you a complete picture of your performance.');
    if(stdDev>20)recs.push('Score variance is high (std.\u00a0dev.\u00a0'+stdDev+'\u00a0pts). Review the chart above to identify the lowest-scoring lines and address them specifically.');
    if(allCorrections.length>3)recs.push('The AI flagged <b>'+allCorrections.length+' correction'+(allCorrections.length>1?'s':'')+' total</b> across your lines. Read the Corrections items in each card \u2014 recurring patterns often indicate a specific grammar or vocabulary habit to break.');
    if(avg>=80&&linesCorrect===evalCount)recs.push('Perfect consistency \u2014 every scored line hit Excellent. Consider increasing difficulty, removing hints, or practising the script in a new context to continue growing.');
    else if(avg>=80)recs.push('Strong overall average. Target the remaining sub-80 lines for full Excellent consistency.');
    if(!recs.length)recs.push('Solid session. Consistent daily practice is the single biggest driver of long-term improvement \u2014 keep it up.');

    /* ── HTML helpers ── */
    var SH=function(title){return '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin:26px 0 12px">'+title+'</div>';};
    var IB=function(label,value,col){return '<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px 7px;text-align:center;min-width:68px"><div style="font-size:19px;font-weight:800;color:'+(col||'#374151')+'">'+value+'</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-top:2px">'+label+'</div></div>';};

    var html='<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
        +'<body style="font-family:Helvetica Neue,Arial,sans-serif;margin:0;padding:30px 38px;background:#fff;color:#111;font-size:13px">'

        /* Header */
        +'<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C8956C;padding-bottom:14px;margin-bottom:18px">'
        +'<div>'
        +'<div style="font-size:22px;font-weight:900;color:#C8956C;margin-bottom:4px">Voqua \u2014 Analytical Session Report</div>'
        +'<div style="font-size:12px;color:#6b7280">'+esc(langName)+' \u00b7 '+modeLabel+' Mode \u00b7 '+new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})+'</div>'
        +(S.scriptLabel?'<div style="font-size:11px;color:#9ca3af;margin-top:1px">Script: <b>'+esc(S.scriptLabel)+'</b></div>':'')
        +'<div style="font-size:11px;color:#9ca3af;margin-top:1px">Difficulty: <b>'+esc(diff.label)+'</b> ('+diff.score+') \u00b7 Duration: <b>'+ts+'</b></div>'
        +'</div>'
        +'<div style="text-align:right;background:'+avgBg+';border:2px solid '+(avg>=80?'#86efac':avg>=50?'#fcd34d':'#fca5a5')+';border-radius:11px;padding:9px 16px">'
        +'<div style="font-size:44px;font-weight:900;line-height:1;color:'+avgCol+'">'+avg+'</div>'
        +'<div style="font-size:9px;color:'+avgCol+';text-transform:uppercase;letter-spacing:.5px;font-weight:700">'+overallGrade+'</div>'
        +'<div style="font-size:8.5px;color:#9ca3af;margin-top:1px">Average Score</div>'
        +'</div>'
        +'</div>'

        /* Stat row */
        +'<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:4px">'
        +IB('Best',best+'%',best>=80?'#166534':best>=50?'#92400e':'#991b1b')
        +IB('Worst',worst+'%',worst>=80?'#166534':worst>=50?'#92400e':'#991b1b')
        +IB('Spoken',evalCount+'/'+userLineCount,'#374151')
        +IB('Word Match',avgWordMatch+'%',avgWordMatch>=80?'#166534':avgWordMatch>=60?'#92400e':'#991b1b')
        +IB('Corrections',allCorrections.length,'#991b1b')
        +IB('Std. Dev.',stdDev+' pts',stdDev<=10?'#166534':stdDev<=20?'#92400e':'#991b1b')
        +'</div>'

        /* Executive Summary */
        +SH('Executive Summary')
        +'<div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:13px 15px;line-height:1.8;font-size:12px;color:#374151">'
        +'<p style="margin:0 0 7px">This session covered <b>'+S.lines.length+' total lines</b>, of which <b>'+userLineCount+'</b> belonged to your role'+(S.userRoles.length>1?' ('+S.userRoles.join(', ')+')':'')+'. '+coverageNote+'</p>'
        +'<p style="margin:0 0 7px">Your average of <b>'+avg+'/100</b> places this session in the <b style="color:'+avgCol+'">'+overallGrade+'</b> range. '+strengthNote+' '+weakNote+'</p>'
        +'<p style="margin:0 0 7px">'+consistencyNote+'</p>'
        +'<p style="margin:0">'+wordMatchNote+'</p>'
        +'</div>'

        /* Distribution */
        +SH('Score Distribution')
        +'<p style="font-size:11px;color:#6b7280;margin:0 0 7px">Distribution of your lines across performance tiers. A healthy result shows most lines in the Excellent (green) band.</p>'
        +distBar

        /* Chart */
        +(scoredWithIdx.length>1
            ?SH('Score Trend \u2014 Per Line')
            +'<p style="font-size:11px;color:#6b7280;margin:0 0 8px">Each bar represents one scored line in script order. Red/orange bars identify your priority improvement targets. A flat or rising pattern indicates consistent delivery.</p>'
            +chartSVG
            :'')

        /* Aggregated feedback */
        +SH('Aggregated AI Feedback')
        +'<p style="font-size:11px;color:#6b7280;margin:0 0 10px">Compiled across all evaluated lines. Recurring items in Corrections often signal a systematic pattern \u2014 these deserve the most attention.</p>'
        +'<div style="display:flex;gap:14px">'
        +'<div style="flex:1;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:11px 13px">'
        +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#991b1b;margin-bottom:7px">\u2717 Corrections ('+allCorrections.length+')</div>'
        +'<ul style="margin:0;padding-left:13px;font-size:11px;line-height:1.7">'+liOf(uCorr,'#991b1b')+'</ul></div>'
        +'<div style="flex:1;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:11px 13px">'
        +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#92400e;margin-bottom:7px">\u2192 Tips ('+allSuggestions.length+')</div>'
        +'<ul style="margin:0;padding-left:13px;font-size:11px;line-height:1.7">'+liOf(uSugg,'#92400e')+'</ul></div>'
        +'<div style="flex:1;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:11px 13px">'
        +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1d4ed8;margin-bottom:7px">\u25b8 Delivery ('+allDelivery.length+')</div>'
        +'<ul style="margin:0;padding-left:13px;font-size:11px;line-height:1.7">'+liOf(uDeliv,'#1d4ed8')+'</ul></div>'
        +'</div>'

        /* Recommendations */
        +SH('Recommendations')
        +'<p style="font-size:11px;color:#6b7280;margin:0 0 8px">Prioritised action items derived from your results:</p>'
        +'<ol style="margin:0;padding-left:17px;font-size:12px;color:#374151;line-height:1.9">'
        +recs.map(function(r){return '<li>'+r+'</li>'}).join('')
        +'</ol>'

        /* Line-by-line */
        +SH('Line-by-Line Breakdown')
        +'<p style="font-size:11px;color:#6b7280;margin:0 0 12px">Each card shows the expected line, your response, word accuracy, and the full AI evaluation. NPC lines are shown condensed for script context.</p>'
        +lineCards

        /* Methodology */
        +SH('Evaluation Methodology')
        +'<p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 7px">Each spoken line is evaluated by an AI language model comparing your response to the expected script in context. The score (0\u2013100) is a composite of <b>Accuracy</b> (vocabulary and meaning alignment), <b>Pronunciation / Grammar</b> (correctness of spoken forms), <b>Fluency</b> (natural flow and pacing), and <b>Correct Word Delivery</b> (whether specific script words were used). Word-match percentage is computed separately via a three-pass fuzzy algorithm: exact positional matching, exact anywhere matching, and Levenshtein distance matching \u2014 designed to handle speech-to-text approximations.</p>'
        +'<p style="font-size:11px;color:#374151;line-height:1.7;margin:0"><b>Thresholds:</b> 80\u2013100 = Excellent; 50\u201379 = Good Effort; 0\u201349 = Needs Work. Skipped lines are excluded from the average. Standard deviation measures consistency across lines \u2014 lower is better.</p>'

        /* Footer */
        +'<div style="margin-top:38px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:9.5px;color:#d1d5db;text-align:center">'
        +'Generated by Voqua \u00b7 AI-powered language coaching \u00b7 '+new Date().toISOString()
        +'</div>'
        +'</body></html>';

    var container=document.createElement('div');
    container.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1';
    container.innerHTML=html;
    document.body.appendChild(container);
    var opt={
        margin:[8,8,8,8],
        filename:'voqua-report-'+Date.now()+'.pdf',
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0,windowWidth:794},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };
    setTimeout(function(){
        html2pdf().set(opt).from(container).save().then(function(){
            document.body.removeChild(container);
            toast('PDF exported.','success');
        }).catch(function(err){
            document.body.removeChild(container);
            console.error(err);
            toast('Could not export PDF.','error');
        });
    },300);
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
