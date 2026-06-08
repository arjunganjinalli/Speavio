/* ═══════════════════════════════════════════════════════════════
    CLASSROOM
═══════════════════════════════════════════════════════════════ */

function generateClassCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createClass(teacherUid, className, subject, school) {
    var classCode = generateClassCode();
    return db.collection('classes').add({
        teacherUid:  teacherUid,
        className:   className,
        subject:     subject,
        school:      school,
        classCode:   classCode,
        studentUids: [],
        createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(docRef) {
        return docRef.id;
    });
}

function joinClass(studentUid, classCode, studentSchool) {
    return db.collection('classes')
        .where('classCode', '==', classCode)
        .get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                throw new Error('Class not found. Check your class code and try again.');
            }
            var doc = snapshot.docs[0];
            var data = doc.data();
            if (data.school !== studentSchool) {
                throw new Error('This class belongs to a different school.');
            }
            return doc.ref.update({
                studentUids: firebase.firestore.FieldValue.arrayUnion(studentUid)
            }).then(function() {
                return Object.assign({ id: doc.id }, data);
            });
        });
}

function getTeacherClasses(teacherUid) {
    return db.collection('classes')
        .where('teacherUid', '==', teacherUid)
        .get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
        });
}

function getStudentClasses(studentUid) {
    return db.collection('classes')
        .where('studentUids', 'array-contains', studentUid)
        .get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
        });
}

function initClassesTab(){
    var tab=$('panel-classes');
    if(!tab)return;
    var role=S.userProfile&&S.userProfile.role;
    if(!role)return;
    var teacherView=$('classes-teacher-view');
    var studentView=$('classes-student-view');
    if(teacherView)teacherView.classList.toggle('hidden',role!=='teacher');
    if(studentView)studentView.classList.toggle('hidden',role!=='student');
}

function renderClassesTabContent(){
    if(!S.userProfile||!S.authUser)return;
    var role=S.userProfile.role;
    if(role==='teacher'){
        var list=$('teacher-class-list');
        if(!list)return;
        list.innerHTML='<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading classes...</span></div>';
        getTeacherClasses(S.authUser.uid).then(function(classes){
            if(!classes.length){list.innerHTML='<p class="text-sf-300 text-sm">No classes yet. Create one above.</p>';return;}
            list.innerHTML=classes.map(function(c){
                return '<div class="mini-card mb-3">'
                    +'<div class="flex items-center justify-between gap-2 flex-wrap">'
                    +'<div><div class="font-display font-semibold text-sf-50">'+esc(c.className)+'</div>'
                    +'<div class="text-xs text-sf-300">'+esc(c.subject)+'</div></div>'
                    +'<div class="flex items-center gap-2">'
                    +'<span class="px-2.5 py-1 rounded-lg bg-copper-500/15 border border-copper-500/25 text-copper-400 text-xs font-mono font-bold">'+esc(c.classCode)+'</span>'
                    +'<span class="text-xs text-sf-300">'+((c.studentUids&&c.studentUids.length)||0)+' students</span>'
                    +'</div></div>'
                    +'<button onclick="showClassAssignments(\''+c.id+'\',\''+esc(c.className)+'\')" class="action-btn action-btn--sage mt-3 w-full justify-center">View Assignments</button>'
                    +'</div>';
            }).join('');
        }).catch(function(){list.innerHTML='<p class="text-coral-400 text-sm">Failed to load classes.</p>';});
    }else{
        var list=$('student-class-list');
        if(!list)return;
        list.innerHTML='<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading...</span></div>';
        getStudentClasses(S.authUser.uid).then(function(classes){
            if(!classes.length){list.innerHTML='<p class="text-sf-300 text-sm">No classes joined yet.</p>';return;}
            list.innerHTML=classes.map(function(c){
                return '<div class="mini-card mb-3">'
                    +'<div class="font-display font-semibold text-sf-50">'+esc(c.className)+'</div>'
                    +'<div class="text-xs text-sf-300 mb-2">'+esc(c.subject)+'</div>'
                    +'<button onclick="showStudentAssignments(\''+c.id+'\',\''+esc(c.className)+'\')" class="action-btn action-btn--copper w-full justify-center">View Assignments</button>'
                    +'</div>';
            }).join('');
        }).catch(function(){list.innerHTML='<p class="text-coral-400 text-sm">Failed to load classes.</p>';});
    }
}

/* ─── Assignment Views ────────────────────────────────────────────────────── */

// Context cache so onclick handlers don't need to embed raw strings in attributes
var _clsCtx = { classId: '', className: '', assignmentId: '', assignmentTitle: '', scriptMap: {} };

function showClassAssignments(classId, className) {
    _clsCtx.classId = classId;
    _clsCtx.className = className;
    var list = $('teacher-class-list');
    if (!list) return;
    list.innerHTML = '<div class="text-sf-300 text-sm">Loading assignments\u2026</div>';
    getClassAssignments(classId).then(function(assignments) {
        var html = '<div class="flex items-center justify-between mb-4 flex-wrap gap-2">'
            + '<button onclick="renderClassesTabContent()" class="action-btn"><i class="fas fa-arrow-left mr-1.5"></i>Back to Classes</button>'
            + '<button onclick="openCreateAssignmentModal()" class="action-btn action-btn--copper"><i class="fas fa-plus mr-1.5"></i>New Assignment</button>'
            + '</div>'
            + '<h3 class="font-display font-semibold text-sf-50 mb-3">' + esc(className) + ' \u2014 Assignments</h3>';
        if (!assignments.length) {
            html += '<p class="text-sf-300 text-sm">No assignments yet. Create one above.</p>';
        } else {
            html += assignments.map(function(a) {
                return '<div class="mini-card mb-3">'
                    + '<div class="flex items-start justify-between gap-2 flex-wrap">'
                    + '<div><div class="font-display font-semibold text-sf-50">' + esc(a.title) + '</div>'
                    + '<div class="text-xs text-sf-300 mt-0.5">Due: ' + esc(a.dueDate || 'No due date') + '</div></div>'
                    + '<button onclick="viewSubmissions(\'' + a.id + '\',\'' + esc(a.title).replace(/'/g, '&#39;') + '\')" class="action-btn action-btn--sage flex-shrink-0">View Submissions</button>'
                    + '</div></div>';
            }).join('');
        }
        list.innerHTML = html;
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error('showClassAssignments error:', err);
    });
}

function showStudentAssignments(classId, className) {
    _clsCtx.classId = classId;
    _clsCtx.className = className;
    var list = $('student-class-list');
    if (!list) return;
    list.innerHTML = '<div class="text-sf-300 text-sm">Loading assignments\u2026</div>';
    getClassAssignments(classId).then(function(assignments) {
        assignments.forEach(function(a) { _clsCtx.scriptMap[a.id] = a.script || ''; });
        var html = '<div class="mb-4">'
            + '<button onclick="renderClassesTabContent()" class="action-btn"><i class="fas fa-arrow-left mr-1.5"></i>Back to Classes</button>'
            + '</div>'
            + '<h3 class="font-display font-semibold text-sf-50 mb-3">' + esc(className) + ' \u2014 Assignments</h3>';
        if (!assignments.length) {
            html += '<p class="text-sf-300 text-sm">No assignments yet.</p>';
        } else {
            html += assignments.map(function(a) {
                return '<div class="mini-card mb-3">'
                    + '<div class="font-display font-semibold text-sf-50">' + esc(a.title) + '</div>'
                    + '<div class="text-xs text-sf-300 mt-0.5">Due: ' + esc(a.dueDate || 'No due date') + '</div>'
                    + (a.instructions ? '<p class="text-sm text-sf-200 mt-2">' + esc(a.instructions) + '</p>' : '')
                    + '<button onclick="startAssignment(\'' + a.id + '\')" class="action-btn action-btn--copper mt-3 w-full justify-center">Start Assignment</button>'
                    + '</div>';
            }).join('');
        }
        list.innerHTML = html;
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error('showStudentAssignments error:', err);
    });
}

function startAssignment(assignmentId) {
    var script = _clsCtx.scriptMap[assignmentId] || '';
    S.currentAssignmentId = assignmentId;
    var input = $('script-input');
    if (input) input.value = script;
    if (typeof updateParse === 'function') updateParse();
    showSetupTab('practice');
    toast('Assignment loaded. Press Start Practice when ready.', 'success');
}

function viewSubmissions(assignmentId, title) {
    _clsCtx.assignmentId = assignmentId;
    _clsCtx.assignmentTitle = title;
    var list = $('teacher-class-list');
    if (!list) return;
    list.innerHTML = '<div class="text-sf-300 text-sm">Loading submissions\u2026</div>';
    getAssignmentSubmissions(assignmentId).then(function(submissions) {
        var html = '<div class="flex items-center justify-between mb-4 flex-wrap gap-2">'
            + '<button onclick="showClassAssignments(\'' + _clsCtx.classId + '\',\'' + esc(_clsCtx.className).replace(/'/g, '&#39;') + '\')" class="action-btn"><i class="fas fa-arrow-left mr-1.5"></i>Back to Assignments</button>'
            + '</div>'
            + '<h3 class="font-display font-semibold text-sf-50 mb-3">Submissions \u2014 ' + esc(title) + '</h3>';
        if (!submissions.length) {
            html += '<p class="text-sf-300 text-sm">No submissions yet.</p>';
        } else {
            html += submissions.map(function(s) {
                var statusClass = s.status === 'graded' ? 'text-sage-400' : 'text-copper-400';
                return '<div class="mini-card mb-3">'
                    + '<div class="flex items-center justify-between gap-2 flex-wrap">'
                    + '<div>'
                    + '<div class="text-xs text-sf-300">Student: <span class="text-sf-100">' + esc(s.studentUid ? s.studentUid.slice(0, 8) + '\u2026' : 'Unknown') + '</span></div>'
                    + '<div class="text-xs text-sf-300 mt-0.5">AI Score: <span class="text-copper-400 font-semibold">' + (s.aiScore != null ? s.aiScore : '\u2014') + '</span>'
                    + ' &nbsp;&middot;&nbsp; Status: <span class="' + statusClass + ' font-semibold">' + esc(s.status) + '</span></div>'
                    + (s.teacherGrade ? '<div class="text-xs text-sf-300 mt-0.5">Grade: <span class="text-sage-400 font-semibold">' + esc(s.teacherGrade) + '</span></div>' : '')
                    + '</div>'
                    + '<button onclick="gradeSubmissionUI(\'' + s.id + '\')" class="action-btn action-btn--sage flex-shrink-0">Grade</button>'
                    + '</div></div>';
            }).join('');
        }
        list.innerHTML = html;
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load submissions.</p>';
        console.error('viewSubmissions error:', err);
    });
}

/* ─── Modals (dynamically created) ───────────────────────────────────────── */

function openCreateAssignmentModal() {
    var existing = document.getElementById('create-assignment-overlay');
    if (existing) existing.parentNode.removeChild(existing);
    var overlay = document.createElement('div');
    overlay.id = 'create-assignment-overlay';
    overlay.className = 'help-overlay';
    overlay.innerHTML = '<div class="help-modal" style="max-width:540px;position:relative;">'
        + '<button class="close-help" onclick="closeAssignmentModal()" aria-label="Close"><i class="fas fa-xmark"></i></button>'
        + '<h2>New Assignment \u2014 ' + esc(_clsCtx.className) + '</h2>'
        + '<div style="display:flex;flex-direction:column;gap:14px;">'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Title *</label>'
        + '<input id="new-assign-title" type="text" placeholder="e.g. Act 1 Scene 2 Practice" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" style="width:100%;box-sizing:border-box;"></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Instructions</label>'
        + '<textarea id="new-assign-instructions" rows="3" placeholder="Any notes for students\u2026" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Script *</label>'
        + '<textarea id="new-assign-script" rows="5" placeholder="Paste the dialogue script here\u2026" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Due Date *</label>'
        + '<input id="new-assign-due" type="date" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 outline-none transition-all" style="width:100%;box-sizing:border-box;"></div>'
        + '<p id="new-assign-error" style="font-size:12px;color:#E8756A;display:none;"></p>'
        + '<div style="display:flex;gap:10px;">'
        + '<button onclick="closeAssignmentModal()" style="flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#A8A6A1;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="new-assign-save-btn" onclick="submitCreateAssignment()" style="flex:1;padding:10px;border-radius:12px;background:linear-gradient(to right,#F59E0B,#EAB308);color:#0D0D0F;font-size:13px;font-weight:700;cursor:pointer;border:none;">Create Assignment</button>'
        + '</div>'
        + '</div></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });
    setTimeout(function() { var el = document.getElementById('new-assign-title'); if (el) el.focus(); }, 80);
}

function closeAssignmentModal() {
    var el = document.getElementById('create-assignment-overlay');
    if (el) el.parentNode.removeChild(el);
}

function submitCreateAssignment() {
    var title = (document.getElementById('new-assign-title') ? document.getElementById('new-assign-title').value : '').trim();
    var instructions = (document.getElementById('new-assign-instructions') ? document.getElementById('new-assign-instructions').value : '').trim();
    var script = (document.getElementById('new-assign-script') ? document.getElementById('new-assign-script').value : '').trim();
    var due = (document.getElementById('new-assign-due') ? document.getElementById('new-assign-due').value : '').trim();
    var errEl = document.getElementById('new-assign-error');
    if (!title || !script || !due) {
        if (errEl) { errEl.textContent = 'Title, script, and due date are required.'; errEl.style.display = 'block'; }
        return;
    }
    var saveBtn = document.getElementById('new-assign-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }
    createAssignment(_clsCtx.classId, S.authUser.uid, title, instructions, script, due)
        .then(function() {
            closeAssignmentModal();
            toast('Assignment created.', 'success');
            showClassAssignments(_clsCtx.classId, _clsCtx.className);
        })
        .catch(function(err) {
            if (errEl) { errEl.textContent = err.message || 'Failed to create assignment.'; errEl.style.display = 'block'; }
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Create Assignment'; }
        });
}

function gradeSubmissionUI(submissionId) {
    var existing = document.getElementById('grade-submission-overlay');
    if (existing) existing.parentNode.removeChild(existing);
    var overlay = document.createElement('div');
    overlay.id = 'grade-submission-overlay';
    overlay.className = 'help-overlay';
    overlay.innerHTML = '<div class="help-modal" style="max-width:420px;position:relative;">'
        + '<button class="close-help" onclick="closeGradeModal()" aria-label="Close"><i class="fas fa-xmark"></i></button>'
        + '<h2>Grade Submission</h2>'
        + '<div style="display:flex;flex-direction:column;gap:14px;">'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Grade</label>'
        + '<input id="grade-input" type="text" placeholder="e.g. A, 85, Pass\u2026" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" style="width:100%;box-sizing:border-box;"></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Comment</label>'
        + '<textarea id="grade-comment" rows="3" placeholder="Feedback for the student\u2026" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none transition-all" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<p id="grade-error" style="font-size:12px;color:#E8756A;display:none;"></p>'
        + '<div style="display:flex;gap:10px;">'
        + '<button onclick="closeGradeModal()" style="flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#A8A6A1;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="grade-submit-btn" onclick="submitGrade(\'' + submissionId + '\')" style="flex:1;padding:10px;border-radius:12px;background:linear-gradient(to right,#F59E0B,#EAB308);color:#0D0D0F;font-size:13px;font-weight:700;cursor:pointer;border:none;">Submit Grade</button>'
        + '</div>'
        + '</div></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });
    setTimeout(function() { var el = document.getElementById('grade-input'); if (el) el.focus(); }, 80);
}

function closeGradeModal() {
    var el = document.getElementById('grade-submission-overlay');
    if (el) el.parentNode.removeChild(el);
}

function submitGrade(submissionId) {
    var grade = (document.getElementById('grade-input') ? document.getElementById('grade-input').value : '').trim();
    var comment = (document.getElementById('grade-comment') ? document.getElementById('grade-comment').value : '').trim();
    var errEl = document.getElementById('grade-error');
    if (!grade) {
        if (errEl) { errEl.textContent = 'Please enter a grade.'; errEl.style.display = 'block'; }
        return;
    }
    var btn = document.getElementById('grade-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    gradeSubmission(submissionId, grade, comment)
        .then(function() {
            closeGradeModal();
            toast('Submission graded.', 'success');
            viewSubmissions(_clsCtx.assignmentId, _clsCtx.assignmentTitle);
        })
        .catch(function(err) {
            if (errEl) { errEl.textContent = err.message || 'Failed to save grade.'; errEl.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.textContent = 'Submit Grade'; }
        });
}

function showClassAssignments(classId, className){
    toast('Loading assignments for '+className+'...','info');
}

function showStudentAssignments(classId, className){
    toast('Loading assignments for '+className+'...','info');
}