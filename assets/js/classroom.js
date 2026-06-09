/* ═══════════════════════════════════════════════════════════════
    CLASSROOM
═══════════════════════════════════════════════════════════════ */

var _studentClasses = [];
var _teacherClasses = [];

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
    }).then(function(docRef) { return docRef.id; });
}

function joinClass(studentUid, classCode, studentSchool) {
    return db.collection('classes')
        .where('classCode', '==', classCode)
        .get()
        .then(function(snapshot) {
            if (snapshot.empty) throw new Error('Class not found. Check your class code and try again.');
            var doc = snapshot.docs[0];
            var data = doc.data();
            if (data.school !== studentSchool) throw new Error('This class belongs to a different school.');
            return doc.ref.update({
                studentUids: firebase.firestore.FieldValue.arrayUnion(studentUid)
            }).then(function() { return Object.assign({ id: doc.id }, data); });
        });
}

function getTeacherClasses(teacherUid) {
    return db.collection('classes').where('teacherUid', '==', teacherUid).get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        });
}

function getStudentClasses(studentUid) {
    return db.collection('classes').where('studentUids', 'array-contains', studentUid).get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        });
}

function initClassesTab() {
    var role = S.userProfile && S.userProfile.role;
    var btn = $('tab-classes');
    if (btn) btn.classList.toggle('hidden', !role);
    var teacherView = $('classes-teacher-view');
    var studentView = $('classes-student-view');
    if (teacherView) teacherView.classList.toggle('hidden', role !== 'teacher');
    if (studentView) studentView.classList.toggle('hidden', role !== 'student');
}

function renderClassesTabContent() {
    if (!S.userProfile || !S.authUser) return;
    var role = S.userProfile.role;
    if (role === 'teacher') {
        var list = $('teacher-classes-list');
        if (!list) return;
        list.innerHTML = '<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading classes...</span></div>';
        getTeacherClasses(S.authUser.uid).then(function(classes) {
            if (!classes.length) { list.innerHTML = '<p class="text-sf-300 text-sm">No classes yet. Create one above.</p>'; return; }
            _teacherClasses = classes;
            renderClassCards(list, classes, role);
        }).catch(function() { list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load classes.</p>'; });
    } else {
        var list = $('student-classes-list');
        if (!list) return;
        list.innerHTML = '<div class="flex items-center gap-2 py-3"><div class="spinner"></div><span class="text-sf-300 text-sm">Loading...</span></div>';
        getStudentClasses(S.authUser.uid).then(function(classes) {
            if (!classes.length) { list.innerHTML = '<p class="text-sf-300 text-sm">No classes joined yet.</p>'; return; }
            _studentClasses = classes;
            renderClassCards(list, classes, role);
        }).catch(function() { list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load classes.</p>'; });
    }
}

function renderClassCards(list, classes, role) {
    var gradients = [
        'linear-gradient(135deg, #C8956C, #E8B88A)',
        'linear-gradient(135deg, #5BB882, #A8E0C0)',
        'linear-gradient(135deg, #D4736E, #E89590)',
        'linear-gradient(135deg, #6C8EC8, #B0C8E8)',
        'linear-gradient(135deg, #956CC8, #C4A8E0)',
        'linear-gradient(135deg, #C8B86C, #E8DCA8)'
    ];
    list.innerHTML = '';
    classes.forEach(function(c, index) {
        var studentCount = (c.studentUids && c.studentUids.length) || 0;
        var card = document.createElement('div');
        card.className = 'min-h-[180px] rounded-2xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:border-white/25 hover:-translate-y-1 hover:shadow-xl transition-all';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.onclick = (function(i, r) { return function() { openClassPageByIndex(i, r); }; })(index, role);
        card.onkeydown = function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openClassPageByIndex(index, role);
            }
        };
        card.innerHTML = '<div class="h-24 px-5 py-4 flex items-end" style="background:' + gradients[index % gradients.length] + '">'
            + '<h3 class="font-display font-bold text-2xl text-white leading-tight drop-shadow-md">' + esc(c.className || 'Untitled Class') + '</h3>'
            + '</div>'
            + '<div class="p-5">'
            + '<p class="text-base text-sf-100 mb-4">' + esc(c.subject || 'No subject') + '</p>'
            + '<div class="flex items-center justify-between gap-3 flex-wrap">'
            + '<span class="px-2.5 py-1 rounded-lg bg-copper-500/15 border border-copper-500/25 text-copper-400 text-sm font-mono font-bold">' + esc(c.classCode || 'No code') + '</span>'
            + '<span class="text-sm text-sf-300"><i class="fas fa-user-group mr-1.5"></i>' + studentCount + ' student' + (studentCount === 1 ? '' : 's') + '</span>'
            + '</div></div>';
        list.appendChild(card);
    });
}

function openClassPageByIndex(index, role) {
    var classes = role === 'teacher' ? _teacherClasses : _studentClasses;
    openClassPage(classes[index], role);
}

var _clsCtx = { classId: '', className: '', classObj: null, role: '', activeTab: 'assignments', assignmentId: '', assignmentTitle: '', scriptMap: {} };

function openClassPage(classObj, role) {
    if (!classObj) return;
    _clsCtx.classId = classObj.id;
    _clsCtx.className = classObj.className || 'Class';
    _clsCtx.classObj = classObj;
    _clsCtx.role = role;
    _clsCtx.activeTab = 'assignments';
    _clsCtx.scriptMap = {};
    $('class-page-title').textContent = _clsCtx.className;
    $('class-page-code').textContent = classObj.classCode || '';
    $('class-page-code').classList.toggle('hidden', !classObj.classCode);
    $('class-page-teacher-tabs').classList.toggle('hidden', role !== 'teacher');
    switchScreen('class');
    if (role === 'teacher') showClassPageTab('assignments');
    else showStudentAssignments(classObj.id, _clsCtx.className);
}

function closeClassPage() {
    switchScreen('setup');
    showSetupTab('classes');
}

function showClassPageTab(tab) {
    if (_clsCtx.role !== 'teacher') return;
    _clsCtx.activeTab = tab;
    var assignmentsTab = $('class-tab-assignments');
    var studentsTab = $('class-tab-students');
    assignmentsTab.className = 'action-btn min-h-[44px] px-5 text-sm' + (tab === 'assignments' ? ' action-btn--copper' : '');
    studentsTab.className = 'action-btn min-h-[44px] px-5 text-sm' + (tab === 'students' ? ' action-btn--copper' : '');
    assignmentsTab.setAttribute('aria-selected', tab === 'assignments' ? 'true' : 'false');
    studentsTab.setAttribute('aria-selected', tab === 'students' ? 'true' : 'false');
    if (tab === 'students') renderClassStudents();
    else showClassAssignments(_clsCtx.classId, _clsCtx.className);
}

function showClassAssignments(classId, className) {
    _clsCtx.classId = classId;
    _clsCtx.className = className;
    var list = $('class-page-content');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading assignments...</span></div>';
    getClassAssignments(classId).then(function(assignments) {
        var html = '<div class="flex items-center justify-between mb-6 flex-wrap gap-3">'
            + '<div><h2 class="font-display font-bold text-2xl text-sf-50">Assignments</h2><p class="text-base text-sf-300 mt-1">Create work and review student submissions.</p></div>'
            + '<button onclick="openCreateAssignmentModal()" class="action-btn action-btn--copper min-h-[44px] px-5 text-sm"><i class="fas fa-plus mr-1.5"></i>New Assignment</button>'
            + '</div>'
            + '<div class="space-y-4">';
        if (!assignments.length) {
            html += '<div class="mini-card"><p class="text-sf-300 text-base">No assignments yet. Create one above.</p></div>';
        } else {
            html += assignments.map(function(a) {
                var safeId = a.id.replace(/'/g, "\\'");
                var safeTitle = esc(a.title).replace(/'/g, "\\'");
                return '<div class="mini-card">'
                    + '<div class="font-display font-bold text-xl text-sf-50 mb-2">' + esc(a.title) + '</div>'
                    + '<div class="text-base text-sf-300 mb-5"><i class="fas fa-calendar-alt mr-1.5"></i>Due: ' + esc(a.dueDate || 'No due date') + '</div>'
                    + '<button onclick="viewSubmissions(\'' + safeId + '\',\'' + safeTitle + '\')" class="w-full min-h-[44px] font-display font-semibold rounded-xl px-4 py-3 bg-sage-500/15 border border-sage-500/25 text-sage-400 hover:bg-sage-500/25 transition-all cursor-pointer"><i class="fas fa-eye mr-2"></i>View Submissions</button>'
                    + '</div>';
            }).join('');
        }
        list.innerHTML = html + '</div>';
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error(err);
    });
}

function showStudentAssignments(classId, className) {
    _clsCtx.classId = classId;
    _clsCtx.className = className;
    var list = $('class-page-content');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading assignments...</span></div>';
    getClassAssignments(classId).then(function(assignments) {
        assignments.forEach(function(a) { _clsCtx.scriptMap[a.id] = a.script || ''; });
        var html = '<div class="mb-6"><h2 class="font-display font-bold text-2xl text-sf-50">Assignments</h2>'
            + '<p class="text-base text-sf-300 mt-1">Choose an assignment when you are ready to practice.</p></div><div class="space-y-4">';
        if (!assignments.length) {
            html += '<div class="mini-card"><p class="text-sf-300 text-base">No assignments yet.</p></div>';
        } else {
            html += assignments.map(function(a) {
                var safeId = a.id.replace(/'/g, "\\'");
                return '<div class="mini-card">'
                    + '<div class="font-display font-bold text-xl text-sf-50 mb-2">' + esc(a.title) + '</div>'
                    + '<div class="text-base text-sf-300 mb-3"><i class="fas fa-calendar-alt mr-1.5"></i>Due: ' + esc(a.dueDate || 'No due date') + '</div>'
                    + (a.instructions ? '<p class="text-base leading-relaxed text-sf-200 mb-5">' + esc(a.instructions) + '</p>' : '<div class="mb-5"></div>')
                    + '<button onclick="startAssignment(\'' + safeId + '\')" class="w-full min-h-[48px] font-display font-semibold text-base rounded-xl px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 hover:from-amber-400 hover:to-yellow-400 transition-all cursor-pointer border-0"><i class="fas fa-play mr-2"></i>Start Assignment</button>'
                    + '</div>';
            }).join('');
        }
        list.innerHTML = html + '</div>';
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error(err);
    });
}

function startAssignment(assignmentId) {
    var script = _clsCtx.scriptMap[assignmentId] || '';
    S.currentAssignmentId = assignmentId;
    var input = $('script-input');
    if (input) input.value = script;
    if (typeof updateParse === 'function') updateParse();
    switchScreen('setup');
    showSetupTab('practice');
    toast('Assignment loaded. Press Start Practice when ready.', 'success');
}

function renderClassStudents() {
    var list = $('class-page-content');
    if (!list) return;
    var students = (_clsCtx.classObj && _clsCtx.classObj.studentUids) || [];
    var html = '<div class="mb-6"><h2 class="font-display font-bold text-2xl text-sf-50">Students</h2>'
        + '<p class="text-base text-sf-300 mt-1">' + students.length + ' enrolled student' + (students.length === 1 ? '' : 's') + '</p></div>'
        + '<div class="space-y-3">';
    if (!students.length) {
        html += '<div class="mini-card"><p class="text-sf-300 text-base">No students have joined this class yet.</p></div>';
    } else {
        html += students.map(function(uid, index) {
            return '<div class="mini-card flex items-center gap-4">'
                + '<div class="w-11 h-11 rounded-xl bg-sage-500/15 border border-sage-500/25 text-sage-400 flex items-center justify-center flex-shrink-0"><i class="fas fa-user-graduate"></i></div>'
                + '<div><div class="font-display font-semibold text-lg text-sf-50">Student ' + (index + 1) + '</div>'
                + '<div class="text-sm text-sf-300 font-mono break-all">' + esc(uid) + '</div></div></div>';
        }).join('');
    }
    list.innerHTML = html + '</div>';
}

function viewSubmissions(assignmentId, title) {
    _clsCtx.assignmentId = assignmentId;
    _clsCtx.assignmentTitle = title;
    var list = $('class-page-content');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading submissions...</span></div>';
    getAssignmentSubmissions(assignmentId).then(function(submissions) {
        var html = '<div class="flex items-center justify-between mb-6 flex-wrap gap-3">'
            + '<button onclick="showClassPageTab(\'assignments\')" class="action-btn min-h-[44px] text-sm"><i class="fas fa-arrow-left mr-1.5"></i>Back to Assignments</button>'
            + '</div>'
            + '<h2 class="font-display font-bold text-2xl text-sf-50 mb-4">Submissions — ' + esc(title) + '</h2>';
        if (!submissions.length) {
            html += '<div class="mini-card"><p class="text-sf-300 text-base">No submissions yet.</p></div>';
        } else {
            html += submissions.map(function(s) {
                var safeSubId = s.id.replace(/'/g, "\\'");
                var statusClass = s.status === 'graded' ? 'text-sage-400' : 'text-copper-400';
                return '<div class="mini-card mb-3">'
                    + '<div class="flex items-center justify-between gap-2 flex-wrap">'
                    + '<div>'
                    + '<div class="text-base text-sf-300">Student UID: <span class="text-sf-100 font-mono">' + esc(s.studentUid ? s.studentUid.slice(0, 8) + '...' : 'Unknown') + '</span></div>'
                    + '<div class="text-sm text-sf-300 mt-1">AI Score: <span class="text-copper-400 font-semibold">' + (s.aiScore != null ? s.aiScore : '—') + '</span>'
                    + ' · Status: <span class="' + statusClass + ' font-semibold">' + esc(s.status) + '</span></div>'
                    + (s.teacherGrade ? '<div class="text-sm text-sf-300 mt-1">Grade: <span class="text-sage-400 font-semibold">' + esc(s.teacherGrade) + '</span></div>' : '')
                    + (s.teacherComment ? '<div class="text-sm text-sf-200 mt-1">' + esc(s.teacherComment) + '</div>' : '')
                    + '</div>'
                    + '<button onclick="gradeSubmissionUI(\'' + safeSubId + '\')" class="action-btn action-btn--sage min-h-[44px] px-5 text-sm flex-shrink-0">Grade</button>'
                    + '</div></div>';
            }).join('');
        }
        list.innerHTML = html;
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-base">Failed to load submissions.</p>';
        console.error(err);
    });
}

function openCreateAssignmentModal() {
    var existing = document.getElementById('create-assignment-overlay');
    if (existing) existing.parentNode.removeChild(existing);
    var overlay = document.createElement('div');
    overlay.id = 'create-assignment-overlay';
    overlay.className = 'help-overlay';
    overlay.innerHTML = '<div class="help-modal" style="max-width:540px;position:relative;">'
        + '<button class="close-help" onclick="closeAssignmentModal()" aria-label="Close"><i class="fas fa-xmark"></i></button>'
        + '<h2>New Assignment — ' + esc(_clsCtx.className) + '</h2>'
        + '<div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;">'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Title *</label>'
        + '<input id="new-assign-title" type="text" placeholder="e.g. Chapter 3 Dialogue" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;"></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Instructions</label>'
        + '<textarea id="new-assign-instructions" rows="2" placeholder="Notes for students..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Script *</label>'
        + '<textarea id="new-assign-script" rows="5" placeholder="Paste the dialogue script here..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Due Date *</label>'
        + '<input id="new-assign-due" type="date" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 outline-none" style="width:100%;box-sizing:border-box;"></div>'
        + '<p id="new-assign-error" style="font-size:12px;color:#E8756A;display:none;"></p>'
        + '<div style="display:flex;gap:10px;">'
        + '<button onclick="closeAssignmentModal()" style="flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#A8A6A1;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="new-assign-save-btn" onclick="submitCreateAssignment()" style="flex:1;padding:10px;border-radius:12px;background:linear-gradient(to right,#F59E0B,#EAB308);color:#0D0D0F;font-size:13px;font-weight:700;cursor:pointer;border:none;">Create Assignment</button>'
        + '</div></div></div>';
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
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
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
        + '<div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;">'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Grade</label>'
        + '<input id="grade-input" type="text" placeholder="e.g. A, 85, Pass..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;"></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Comment</label>'
        + '<textarea id="grade-comment" rows="3" placeholder="Feedback for the student..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<p id="grade-error" style="font-size:12px;color:#E8756A;display:none;"></p>'
        + '<div style="display:flex;gap:10px;">'
        + '<button onclick="closeGradeModal()" style="flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#A8A6A1;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="grade-submit-btn" onclick="submitGrade(\'' + submissionId + '\')" style="flex:1;padding:10px;border-radius:12px;background:linear-gradient(to right,#F59E0B,#EAB308);color:#0D0D0F;font-size:13px;font-weight:700;cursor:pointer;border:none;">Submit Grade</button>'
        + '</div></div></div>';
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
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
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
