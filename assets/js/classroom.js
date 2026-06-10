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

function createClass(teacherUid, className, subject, description, school) {
    var classCode = generateClassCode();
    return db.collection('classes').add({
        teacherUid:  teacherUid,
        className:   className,
        subject:     subject,
        description: description,
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
    var grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    classes.forEach(function(c, index) {
        var studentCount = (c.studentUids && c.studentUids.length) || 0;
        if (role === 'teacher') {
            var card = document.createElement('div');
            card.className = 'relative min-h-[180px] rounded-2xl overflow-visible bg-white/5 border border-white/10 cursor-pointer hover:border-white/25 hover:-translate-y-1 hover:shadow-xl transition-all text-left w-full';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.innerHTML = '<div class="h-24 px-5 py-4 flex items-end rounded-t-2xl overflow-hidden" style="background:' + gradients[index % gradients.length] + '">'
                + '<h3 class="font-display font-bold text-2xl text-white leading-tight drop-shadow-md">' + esc(c.className || 'Untitled Class') + '</h3>'
                + '</div>'
                + '<div class="p-5">'
                + '<p class="text-base text-sf-100 mb-4">' + esc(c.subject || 'No subject') + '</p>'
                + '<div class="flex items-center justify-between gap-3 flex-wrap">'
                + '<span class="px-2.5 py-1 rounded-lg bg-copper-500/15 border border-copper-500/25 text-copper-400 text-sm font-mono font-bold">' + esc(c.classCode || '') + '</span>'
                + '<span class="text-sm text-sf-300"><i class="fas fa-user-group mr-1.5"></i>' + studentCount + ' student' + (studentCount === 1 ? '' : 's') + '</span>'
                + '</div></div>';
            var menuButton = document.createElement('button');
            menuButton.type = 'button';
            menuButton.className = 'absolute top-3 right-3 z-20 w-9 h-9 rounded-lg bg-black/25 hover:bg-black/40 text-white text-xl flex items-center justify-center transition-colors';
            menuButton.setAttribute('aria-label', 'Class options');
            menuButton.innerHTML = '&#8942;';
            var menu = document.createElement('div');
            menu.id = 'class-menu-' + index;
            menu.className = 'classroom-overflow-menu hidden absolute top-12 right-3 z-30 min-w-[160px] rounded-xl bg-sf-800 border border-white/10 shadow-xl p-1';
            menu.innerHTML = '<button type="button" class="class-menu-open w-full text-left px-3 py-2.5 rounded-lg text-sm text-sf-100 hover:bg-white/5">Open</button>'
                + '<button type="button" class="class-menu-delete w-full text-left px-3 py-2.5 rounded-lg text-sm text-coral-400 hover:bg-coral-500/10">Delete Class</button>';
            card.appendChild(menuButton);
            card.appendChild(menu);
            card.addEventListener('click', function() { openClassPage(c, role); });
            card.addEventListener('keydown', function(event) {
                if (event.target !== card) return;
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openClassPage(c, role); }
            });
            menu.addEventListener('click', function(event) { event.stopPropagation(); });
            menuButton.addEventListener('click', function(event) { toggleClassroomMenu(event, menu.id); });
            menu.querySelector('.class-menu-open').addEventListener('click', function(event) {
                event.stopPropagation();
                closeClassroomMenus();
                openClassPage(c, role);
            });
            menu.querySelector('.class-menu-delete').addEventListener('click', function(event) {
                event.stopPropagation();
                closeClassroomMenus();
                openDeleteClassModal(c);
            });
            grid.appendChild(card);
            return;
        }
        var btn = document.createElement('button');
        btn.className = 'min-h-[180px] rounded-2xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:border-white/25 hover:-translate-y-1 hover:shadow-xl transition-all text-left w-full';
        btn.type = 'button';
        btn.innerHTML = '<div class="h-24 px-5 py-4 flex items-end" style="background:' + gradients[index % gradients.length] + '">'
            + '<h3 class="font-display font-bold text-2xl text-white leading-tight drop-shadow-md">' + esc(c.className || 'Untitled Class') + '</h3>'
            + '</div>'
            + '<div class="p-5">'
            + '<p class="text-base text-sf-100 mb-4">' + esc(c.subject || 'No subject') + '</p>'
            + '<div class="flex items-center justify-between gap-3 flex-wrap">'
            + '<span class="px-2.5 py-1 rounded-lg bg-copper-500/15 border border-copper-500/25 text-copper-400 text-sm font-mono font-bold">' + esc(c.classCode || '') + '</span>'
            + '<span class="text-sm text-sf-300"><i class="fas fa-user-group mr-1.5"></i>' + studentCount + ' student' + (studentCount === 1 ? '' : 's') + '</span>'
            + '</div></div>';
        btn.addEventListener('click', (function(classObj, r) {
            return function() { openClassPage(classObj, r); };
        })(c, role));
        grid.appendChild(btn);
    });
    list.appendChild(grid);
}

function openClassPageByIndex(index, role) {
    var classes = role === 'teacher' ? _teacherClasses : _studentClasses;
    openClassPage(classes[index], role);
}

var _clsCtx = { classId: '', className: '', classObj: null, role: '', activeTab: 'assignments', assignmentId: '', assignmentTitle: '', scriptMap: {}, assignmentMap: {} };
var _classStudentsRenderId = 0;
var _classStudentNames = {};
var _activeAssignment = null;
var _assignmentSessionRunning = false;

function openClassPage(classObj, role) {
    if (!classObj) return;
    _clsCtx.classId = classObj.id;
    _clsCtx.className = classObj.className || 'Class';
    _clsCtx.classObj = classObj;
    _clsCtx.role = role;
    _clsCtx.activeTab = 'assignments';
    _clsCtx.scriptMap = {};
    $('class-page-title').textContent = _clsCtx.className;
    $('class-page-subject').textContent = classObj.subject || '';
    $('class-page-description').textContent = classObj.description || '';
    $('class-page-description').classList.toggle('hidden', !classObj.description);
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
        _clsCtx.assignmentMap = {};
        assignments.forEach(function(assignment) { _clsCtx.assignmentMap[assignment.id] = assignment; });
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
                return '<div class="mini-card relative">'
                    + '<button onclick="toggleClassroomMenu(event,\'assignment-menu-' + safeId + '\')" class="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-sf-100 text-xl flex items-center justify-center transition-colors" aria-label="Assignment options">&#8942;</button>'
                    + '<div id="assignment-menu-' + safeId + '" class="classroom-overflow-menu hidden absolute top-12 right-3 z-30 min-w-[180px] rounded-xl bg-sf-800 border border-white/10 shadow-xl p-1">'
                    + '<button onclick="openAssignmentSubmissions(event,\'' + safeId + '\')" class="w-full text-left px-3 py-2.5 rounded-lg text-sm text-sf-100 hover:bg-white/5">View Submissions</button>'
                    + '<button onclick="openDeleteAssignmentModal(event,\'' + safeId + '\')" class="w-full text-left px-3 py-2.5 rounded-lg text-sm text-coral-400 hover:bg-coral-500/10">Delete Assignment</button>'
                    + '</div>'
                    + '<div class="font-display font-bold text-xl text-sf-50 mb-2 pr-10">' + esc(a.title) + '</div>'
                    + '<div class="text-base text-sf-300 mb-5"><i class="fas fa-calendar-alt mr-1.5"></i>Due: ' + esc(formatAssignmentDue(a.dueDate)) + '</div>'
                    + '</div>';
            }).join('');
        }
        list.innerHTML = html + '</div>';
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error(err);
    });
}

function openAssignmentSubmissions(event, assignmentId) {
    event.stopPropagation();
    closeClassroomMenus();
    var assignment = _clsCtx.assignmentMap[assignmentId] || {};
    viewSubmissions(assignmentId, assignment.title || 'Assignment');
}

function showStudentAssignments(classId, className) {
    _clsCtx.classId = classId;
    _clsCtx.className = className;
    var list = $('class-page-content');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading assignments...</span></div>';
    getClassAssignments(classId).then(function(assignments) {
        return getStudentAssignmentSubmissions(assignments.map(function(a) { return a.id; }), S.authUser.uid)
            .then(function(submissions) {
                return { assignments: assignments, submissions: submissions };
            });
    }).then(function(result) {
        var assignments = result.assignments;
        var submissionMap = {};
        result.submissions.forEach(function(submission) {
            submissionMap[submission.assignmentId] = submission;
        });
        _clsCtx.assignmentMap = {};
        assignments.forEach(function(a) {
            _clsCtx.scriptMap[a.id] = a.script || '';
            _clsCtx.assignmentMap[a.id] = a;
        });
        var html = '<div class="mb-6"><h2 class="font-display font-bold text-2xl text-sf-50">Assignments</h2>'
            + '<p class="text-base text-sf-300 mt-1">Choose an assignment when you are ready to practice.</p></div><div class="space-y-4">';
        if (!assignments.length) {
            html += '<div class="mini-card"><p class="text-sf-300 text-base">No assignments yet.</p></div>';
        } else {
            html += assignments.map(function(a) {
                var safeId = a.id.replace(/'/g, "\\'");
                var submission = submissionMap[a.id];
                var safeSubmissionId = submission ? submission.id.replace(/'/g, "\\'") : '';
                var buttonLabel = submission ? 'Resubmit' : 'Start';
                var practiceButton = '<button onclick="startAssignment(\'' + safeId + '\',\'practice\',\'' + safeSubmissionId + '\')" class="w-full min-h-[48px] font-display font-semibold text-base rounded-xl px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 hover:from-amber-400 hover:to-yellow-400 transition-all cursor-pointer border-0"><i class="fas fa-microphone-lines mr-2"></i>' + buttonLabel + (submission ? '' : ' Practice') + '</button>';
                var presentationButton = '<button onclick="startAssignment(\'' + safeId + '\',\'presentation\',\'' + safeSubmissionId + '\')" class="w-full min-h-[48px] font-display font-semibold text-base rounded-xl px-4 py-3 bg-sage-500/15 border border-sage-500/25 text-sage-400 hover:bg-sage-500/25 transition-all cursor-pointer"><i class="fas fa-masks-theater mr-2"></i>' + buttonLabel + (submission ? '' : ' Presentation') + '</button>';
                var assignmentButtons = a.type === 'practice' ? practiceButton
                    : a.type === 'presentation' ? presentationButton
                    : practiceButton + presentationButton;
                return '<div class="mini-card">'
                    + '<div class="flex items-start justify-between gap-3 mb-2"><div class="font-display font-bold text-xl text-sf-50">' + esc(a.title) + '</div>'
                    + (submission ? '<span class="px-2.5 py-1 rounded-lg bg-sage-500/15 border border-sage-500/25 text-sage-400 text-sm font-semibold"><i class="fas fa-circle-check mr-1.5"></i>Submitted</span>' : '')
                    + '</div>'
                    + '<div class="text-base text-sf-300 mb-3"><i class="fas fa-calendar-alt mr-1.5"></i>Due: ' + esc(formatAssignmentDue(a.dueDate)) + '</div>'
                    + (a.instructions ? '<p class="text-base leading-relaxed text-sf-200 mb-5">' + esc(a.instructions) + '</p>' : '<div class="mb-5"></div>')
                    + '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + assignmentButtons + '</div>'
                    + '</div>';
            }).join('');
        }
        list.innerHTML = html + '</div>';
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-sm">Failed to load assignments.</p>';
        console.error(err);
    });
}

function startAssignment(assignmentId, mode, submissionId) {
    var assignment = _clsCtx.assignmentMap[assignmentId] || {};
    var script = assignment.script || _clsCtx.scriptMap[assignmentId] || '';
    mode = mode === 'presentation' ? 'presentation' : 'practice';
    var lines = parseScript(script);
    var roles = [];
    lines.forEach(function(line) {
        if (roles.indexOf(line.role) === -1) roles.push(line.role);
    });
    _activeAssignment = {
        id: assignmentId,
        title: assignment.title || 'Assignment',
        script: script,
        type: assignment.type || mode,
        roles: roles,
        submissionId: submissionId || ''
    };
    S.currentAssignmentId = assignmentId;
    S.mode = mode;
    S.userRoles = [];
    $('assignment-class-name').textContent = _clsCtx.className;
    $('assignment-page-title').textContent = _activeAssignment.title;
    $('assignment-mode-badge').textContent = (mode === 'presentation' ? 'Presentation' : 'Practice') + ' Assignment';
    $('assignment-script-readonly').textContent = script;
    $('assignment-preview').classList.remove('hidden');
    $('assignment-session-mount').classList.add('hidden');
    $('assignment-result').classList.add('hidden');
    renderAssignmentRolePicker();
    switchScreen('assignment');
}

function renderAssignmentRolePicker() {
    var mount = $('assignment-role-pills');
    var startBtn = $('assignment-start-btn');
    if (!mount || !startBtn || !_activeAssignment) return;
    mount.innerHTML = '';
    _activeAssignment.roles.forEach(function(role) {
        var selected = S.userRoles.indexOf(role) !== -1;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'role-pill ' + (selected ? 'selected' : '');
        button.innerHTML = (selected ? '<i class="fas fa-check mr-1.5 text-[10px]"></i>' : '') + esc(role);
        button.addEventListener('click', function() {
            var index = S.userRoles.indexOf(role);
            if (index === -1) S.userRoles.push(role);
            else S.userRoles.splice(index, 1);
            renderAssignmentRolePicker();
        });
        mount.appendChild(button);
    });
    startBtn.disabled = !S.userRoles.length;
    var help = $('assignment-role-help');
    if (help) help.textContent = _activeAssignment.roles.length ? 'Choose at least one role to begin.' : 'No roles were found in this script.';
}

function formatAssignmentDue(value) {
    if (!value) return 'No due date';
    var date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function launchAssignmentSession() {
    if (!_activeAssignment) return;
    if (!S.userRoles.length) {
        toast('Choose at least one role before starting.', 'error');
        return;
    }
    var input = $('script-input');
    if (input) input.value = _activeAssignment.script;
    S.mode = _activeAssignment.type === 'presentation' ? 'presentation' : 'practice';
    if (typeof updateParse === 'function') updateParse();
    S.userRoles = S.userRoles.filter(function(role) { return S.roles.indexOf(role) !== -1; });
    if (!S.userRoles.length) {
        renderAssignmentRolePicker();
        toast('Choose at least one valid role before starting.', 'error');
        return;
    }
    moveAssignmentSessionElements(true);
    _assignmentSessionRunning = true;
    startSession();
}

function moveAssignmentSessionElements(toAssignment) {
    var target = toAssignment ? $('assignment-session-mount') : $('session-screen');
    ['session-progress-track', 'dialogue-context', 'interaction-area'].forEach(function(id) {
        var el = $(id);
        if (el && target) target.appendChild(el);
    });
    if (toAssignment) {
        $('assignment-preview').classList.add('hidden');
        $('assignment-result').classList.add('hidden');
        $('assignment-session-mount').classList.remove('hidden');
        $('assignment-session-mount').classList.add('flex');
    } else if ($('assignment-session-mount')) {
        $('assignment-session-mount').classList.add('hidden');
        $('assignment-session-mount').classList.remove('flex');
    }
}

function closeAssignmentSession() {
    releaseMicStream();
    stopSpeaking();
    moveAssignmentSessionElements(false);
    _assignmentSessionRunning = false;
    _activeAssignment = null;
    switchScreen('class');
    showStudentAssignments(_clsCtx.classId, _clsCtx.className);
}

function renderAssignmentCompletion() {
    var scores = Object.keys(S.lineScores).map(function(key) { return S.lineScores[key]; }).filter(function(score) { return score != null; });
    var avg = scores.length ? Math.round(scores.reduce(function(total, score) { return total + score; }, 0) / scores.length) : 0;
    _assignmentSessionRunning = false;
    moveAssignmentSessionElements(false);
    switchScreen('assignment');
    $('assignment-preview').classList.add('hidden');
    $('assignment-result').classList.remove('hidden');
    $('assignment-result').innerHTML = '<div class="glass rounded-2xl p-7 text-center">'
        + '<p class="text-sm text-sf-300 mb-2">Assignment complete</p>'
        + '<div class="text-6xl font-display font-bold text-sage-400 mb-2">' + avg + '</div>'
        + '<p class="text-base text-sf-200 mb-6">Average score</p>'
        + '<button onclick="redoActiveAssignment()" class="w-full min-h-[52px] mb-3 rounded-xl bg-white/5 border border-white/10 text-sf-100 font-display font-bold text-base hover:bg-white/10 transition-colors"><i class="fas fa-rotate-right mr-2"></i>Redo Assignment</button>'
        + '<button id="assignment-submit-btn" onclick="submitActiveAssignment()" class="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-sf-900 font-display font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"><i class="fas fa-paper-plane mr-2"></i>Submit Assignment</button>'
        + '</div>';
}

function redoActiveAssignment() {
    if (!_activeAssignment) return;
    launchAssignmentSession();
}

function submitActiveAssignment() {
    if (!_activeAssignment || !S.authUser) return;
    var submitBtn = $('assignment-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    var scores = Object.keys(S.lineScores).map(function(key) { return S.lineScores[key]; }).filter(function(score) { return score != null; });
    var avg = scores.length ? Math.round(scores.reduce(function(total, score) { return total + score; }, 0) / scores.length) : 0;
    var transcript = JSON.stringify(S.userResponses || {});
    var clipKeys = Object.keys(S.audioClips || {}).sort(function(a, b) { return Number(a) - Number(b); });
    var recording = clipKeys.length ? S.audioClips[clipKeys[clipKeys.length - 1]] : null;
    var recordingPromise = recording ? blobToBase64(recording) : Promise.resolve(null);
    recordingPromise.then(function(recordingData) {
        return submitAssignment(_activeAssignment.id, S.authUser.uid, transcript, avg, recordingData, _activeAssignment.submissionId);
    }).then(function() {
        toast('Assignment submitted.', 'success');
        _activeAssignment = null;
        switchScreen('class');
        showStudentAssignments(_clsCtx.classId, _clsCtx.className);
    }).catch(function(err) {
        toast(err.message || 'Failed to submit assignment.', 'error');
        if (submitBtn) submitBtn.disabled = false;
    });
}

function blobToBase64(blob) {
    return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onloadend = function() { resolve(reader.result); };
        reader.readAsDataURL(blob);
    });
}

function renderClassStudents(message, isError) {
    var list = $('class-page-content');
    if (!list) return;
    var renderId = ++_classStudentsRenderId;
    var students = (_clsCtx.classObj && _clsCtx.classObj.studentUids) || [];
    var html = '<div class="mb-6"><h2 class="font-display font-bold text-2xl text-sf-50">Students</h2>'
        + '<p class="text-base text-sf-300 mt-1">' + students.length + ' enrolled student' + (students.length === 1 ? '' : 's') + '</p></div>'
        + '<div class="mini-card mb-5">'
        + '<label for="class-add-student-uid" class="block text-sm font-semibold text-sf-100 mb-2">Add Student by UID</label>'
        + '<div class="flex flex-col sm:flex-row gap-3">'
        + '<input id="class-add-student-uid" type="text" placeholder="Student UID" class="input-glow flex-1 bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none">'
        + '<button onclick="addStudentToClass()" class="action-btn action-btn--sage min-h-[44px] px-5 text-sm"><i class="fas fa-user-plus"></i>Add</button>'
        + '</div>'
        + '<p id="class-student-message" class="text-sm mt-3 ' + (isError ? 'text-coral-400' : 'text-sage-400') + '">' + esc(message || '') + '</p>'
        + '</div>'
        + '<div id="class-students-list" class="space-y-3">';
    if (!students.length) {
        html += '<div class="mini-card"><p class="text-sf-300 text-base">No students have joined this class yet.</p></div>';
    } else {
        html += '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading student names...</span></div>';
    }
    list.innerHTML = html + '</div>';
    if (!students.length) return;
    Promise.all(students.map(function(uid) {
        return db.collection('users').doc(uid).get().then(function(doc) {
            var data = doc.exists ? doc.data() : null;
            return { uid: uid, fullName: data && data.fullName ? data.fullName : '' };
        }).catch(function() {
            return { uid: uid, fullName: '' };
        });
    })).then(function(studentProfiles) {
        var studentsList = $('class-students-list');
        if (!studentsList || _clsCtx.activeTab !== 'students' || renderId !== _classStudentsRenderId) return;
        _classStudentNames = {};
        studentsList.innerHTML = studentProfiles.map(function(student) {
            var safeUid = student.uid.replace(/'/g, "\\'");
            var shortUid = student.uid.length > 12 ? student.uid.slice(0, 12) + '...' : student.uid;
            _classStudentNames[student.uid] = student.fullName || shortUid;
            return '<div class="mini-card flex items-center justify-between gap-4 flex-wrap">'
                + '<div class="flex items-center gap-4 min-w-0">'
                + '<div class="w-11 h-11 rounded-xl bg-sage-500/15 border border-sage-500/25 text-sage-400 flex items-center justify-center flex-shrink-0"><i class="fas fa-user-graduate"></i></div>'
                + '<div class="min-w-0"><div class="font-display font-semibold text-lg text-sf-50">' + esc(student.fullName || shortUid) + '</div>'
                + '<div class="text-sm text-sf-300 font-mono truncate">' + esc(shortUid) + '</div></div></div>'
                + '<div class="flex gap-2 flex-wrap">'
                + '<button onclick="viewStudentGrades(\'' + safeUid + '\')" class="action-btn action-btn--sage min-h-[44px] px-4 text-sm"><i class="fas fa-chart-line"></i>View Grades</button>'
                + '<button onclick="removeStudentFromClass(\'' + safeUid + '\')" class="action-btn action-btn--coral min-h-[44px] px-4 text-sm"><i class="fas fa-user-minus"></i>Remove</button>'
                + '</div>'
                + '</div>';
        }).join('');
    });
}

function viewStudentGrades(uid, fullName) {
    fullName = fullName || _classStudentNames[uid] || uid.slice(0, 12);
    _clsCtx.gradeStudentUid = uid;
    _clsCtx.gradeStudentName = fullName;
    var list = $('class-page-content');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center gap-3 py-4"><div class="spinner"></div><span class="text-sf-300 text-base">Loading grades...</span></div>';
    db.collection('submissions').where('studentUid', '==', uid).get().then(function(snapshot) {
        var submissions = snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        return Promise.all(submissions.map(function(submission) {
            return db.collection('assignments').doc(submission.assignmentId).get().then(function(doc) {
                submission.assignmentTitle = doc.exists ? (doc.data().title || 'Assignment') : 'Assignment';
                return submission;
            });
        }));
    }).then(function(submissions) {
        var html = '<button onclick="showClassPageTab(\'students\')" class="action-btn min-h-[44px] text-sm mb-6"><i class="fas fa-arrow-left"></i>Back to Students</button>'
            + '<h2 class="font-display font-bold text-2xl text-sf-50 mb-5">' + esc(fullName) + ' — Grades</h2>';
        if (!submissions.length) html += '<div class="mini-card text-sf-300">No submissions yet.</div>';
        else html += submissions.map(function(submission) {
            var safeId = submission.id.replace(/'/g, "\\'");
            return '<div class="mini-card mb-3 flex items-center justify-between gap-4 flex-wrap"><div>'
                + '<div class="font-display font-semibold text-lg text-sf-50">' + esc(submission.assignmentTitle) + '</div>'
                + '<div class="text-sm text-sf-300 mt-1">AI Score: <span class="text-copper-400">' + (submission.aiScore != null ? submission.aiScore : '—') + '</span> · Grade: <span class="text-sage-400">' + esc(submission.teacherGrade || 'Not graded') + '</span> · ' + esc(submission.status || 'submitted') + '</div>'
                + '</div><button onclick="gradeSubmissionUI(\'' + safeId + '\')" class="action-btn action-btn--sage min-h-[44px] px-4 text-sm">Grade</button></div>';
        }).join('');
        list.innerHTML = html;
    }).catch(function(err) {
        list.innerHTML = '<p class="text-coral-400 text-base">' + esc(err.message || 'Failed to load grades.') + '</p>';
    });
}

function addStudentToClass() {
    var input = $('class-add-student-uid');
    var uid = input ? input.value.trim() : '';
    if (!uid) {
        renderClassStudents('Enter a student UID.', true);
        return;
    }
    db.collection('classes').doc(_clsCtx.classId).update({
        studentUids: firebase.firestore.FieldValue.arrayUnion(uid)
    }).then(function() {
        var students = (_clsCtx.classObj && _clsCtx.classObj.studentUids) || [];
        if (students.indexOf(uid) === -1) students.push(uid);
        _clsCtx.classObj.studentUids = students;
        renderClassStudents('Student added.', false);
    }).catch(function(err) {
        renderClassStudents(err.message || 'Failed to add student.', true);
    });
}

function removeStudentFromClass(uid) {
    db.collection('classes').doc(_clsCtx.classId).update({
        studentUids: firebase.firestore.FieldValue.arrayRemove(uid)
    }).then(function() {
        _clsCtx.classObj.studentUids = ((_clsCtx.classObj && _clsCtx.classObj.studentUids) || []).filter(function(studentUid) {
            return studentUid !== uid;
        });
        renderClassStudents('Student removed.', false);
    }).catch(function(err) {
        renderClassStudents(err.message || 'Failed to remove student.', true);
    });
}

function viewSubmissions(assignmentId, title) {
    _clsCtx.assignmentId = assignmentId;
    _clsCtx.assignmentTitle = title;
    _clsCtx.gradeStudentUid = '';
    _clsCtx.gradeStudentName = '';
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
                    + '</div>'
                    + (s.recordingData ? '<audio controls preload="metadata" class="w-full mt-4" src="' + esc(s.recordingData) + '"></audio>'
                        : '<p class="text-sm text-sf-300 mt-4">' + (s.status === 'graded' ? 'Recording removed after grading' : 'No recording') + '</p>')
                    + '</div>';
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
        + '<fieldset><legend style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:8px;">Assignment Type *</legend>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
        + '<label style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);cursor:pointer;"><input type="radio" name="new-assign-type" value="practice" required checked> Practice</label>'
        + '<label style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);cursor:pointer;"><input type="radio" name="new-assign-type" value="presentation" required> Presentation</label>'
        + '</div></fieldset>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Instructions</label>'
        + '<textarea id="new-assign-instructions" rows="2" placeholder="Notes for students..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Script *</label>'
        + '<textarea id="new-assign-script" rows="5" placeholder="Paste the dialogue script here..." class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>'
        + '<div><label style="display:block;font-size:13px;color:#A8A6A1;margin-bottom:6px;">Due Date and Time *</label>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><input id="new-assign-due-date" type="date" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 outline-none">'
        + '<input id="new-assign-due-time" type="time" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 outline-none"></div></div>'
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

var _deleteClassroomTarget = null;

function openDeleteAssignmentModal(event, assignmentId) {
    if (event) event.stopPropagation();
    closeClassroomMenus();
    var assignment = _clsCtx.assignmentMap[assignmentId];
    if (!assignment) return;
    openClassroomDeleteModal('assignment', assignmentId, assignment.title || 'Assignment');
}

function openDeleteClassModal(classObj) {
    if (!classObj) return;
    openClassroomDeleteModal('class', classObj.id, classObj.className || 'Class');
}

function openClassroomDeleteModal(type, id, name) {
    closeClassroomDeleteModal();
    _deleteClassroomTarget = { type: type, id: id, name: name };
    var isClass = type === 'class';
    var overlay = document.createElement('div');
    overlay.id = 'classroom-delete-overlay';
    overlay.className = 'help-overlay';
    overlay.innerHTML = '<div class="help-modal" style="max-width:460px;position:relative;">'
        + '<button class="close-help" onclick="closeClassroomDeleteModal()" aria-label="Close"><i class="fas fa-xmark"></i></button>'
        + '<h2>Delete ' + (isClass ? 'Class' : 'Assignment') + '</h2>'
        + '<p style="color:#E8756A;font-size:14px;line-height:1.6;margin-top:12px;">'
        + (isClass ? 'This cannot be undone. All assignments and student data for this class will be permanently deleted.' : 'This cannot be undone. All submissions for this assignment will also be permanently deleted.')
        + '</p>'
        + '<input id="classroom-delete-confirm-input" type="text" placeholder="Type the ' + (isClass ? 'class name' : 'assignment title') + ' to confirm" oninput="updateClassroomDeleteButton()" class="input-glow w-full bg-sf-800/60 border border-white/8 rounded-xl px-4 py-3 text-sm text-sf-50 placeholder-sf-300 outline-none" style="width:100%;box-sizing:border-box;margin-top:16px;">'
        + '<p id="classroom-delete-error" style="font-size:12px;color:#E8756A;display:none;margin-top:10px;"></p>'
        + '<div style="display:flex;gap:10px;margin-top:16px;">'
        + '<button onclick="closeClassroomDeleteModal()" style="flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#A8A6A1;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="classroom-delete-confirm-btn" disabled onclick="confirmClassroomDelete()" style="flex:1;padding:10px;border-radius:12px;background:#D85C55;color:white;font-size:13px;font-weight:700;cursor:pointer;border:none;opacity:.45;">Delete</button>'
        + '</div></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });
    setTimeout(function() { var input = $('classroom-delete-confirm-input'); if (input) input.focus(); }, 80);
}

function updateClassroomDeleteButton() {
    var input = $('classroom-delete-confirm-input');
    var button = $('classroom-delete-confirm-btn');
    if (!button || !_deleteClassroomTarget) return;
    button.disabled = !input || input.value !== _deleteClassroomTarget.name;
    button.style.opacity = button.disabled ? '.45' : '1';
}

function closeClassroomDeleteModal() {
    var overlay = $('classroom-delete-overlay');
    if (overlay) overlay.parentNode.removeChild(overlay);
    _deleteClassroomTarget = null;
}

function deleteFirestoreDocs(docs) {
    var commits = [];
    for (var i = 0; i < docs.length; i += 500) {
        var batch = db.batch();
        docs.slice(i, i + 500).forEach(function(doc) { batch.delete(doc.ref); });
        commits.push(batch.commit());
    }
    return Promise.all(commits);
}

function confirmClassroomDelete() {
    var target = _deleteClassroomTarget;
    var button = $('classroom-delete-confirm-btn');
    if (!target || !button || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Deleting...';
    var deletion;
    if (target.type === 'assignment') {
        deletion = db.collection('submissions').where('assignmentId', '==', target.id).get()
            .then(function(snapshot) { return deleteFirestoreDocs(snapshot.docs); })
            .then(function() { return db.collection('assignments').doc(target.id).delete(); });
    } else {
        deletion = db.collection('assignments').where('classId', '==', target.id).get().then(function(snapshot) {
            var assignmentDocs = snapshot.docs;
            return Promise.all(assignmentDocs.map(function(doc) {
                return db.collection('submissions').where('assignmentId', '==', doc.id).get();
            })).then(function(submissionSnapshots) {
                var submissionDocs = submissionSnapshots.reduce(function(all, snapshot) { return all.concat(snapshot.docs); }, []);
                return deleteFirestoreDocs(submissionDocs).then(function() { return deleteFirestoreDocs(assignmentDocs); });
            });
        }).then(function() {
            return db.collection('classes').doc(target.id).delete();
        });
    }
    deletion.then(function() {
        var deletedType = target.type;
        closeClassroomDeleteModal();
        toast(deletedType === 'class' ? 'Class deleted.' : 'Assignment deleted.', 'success');
        if (deletedType === 'class') renderClassesTabContent();
        else showClassAssignments(_clsCtx.classId, _clsCtx.className);
    }).catch(function(err) {
        var error = $('classroom-delete-error');
        if (error) { error.textContent = err.message || 'Delete failed.'; error.style.display = 'block'; }
        if (button) { button.disabled = false; button.textContent = 'Delete'; updateClassroomDeleteButton(); }
    });
}

function submitCreateAssignment() {
    var title = (document.getElementById('new-assign-title') ? document.getElementById('new-assign-title').value : '').trim();
    var instructions = (document.getElementById('new-assign-instructions') ? document.getElementById('new-assign-instructions').value : '').trim();
    var script = (document.getElementById('new-assign-script') ? document.getElementById('new-assign-script').value : '').trim();
    var dueDate = (document.getElementById('new-assign-due-date') ? document.getElementById('new-assign-due-date').value : '').trim();
    var dueTime = (document.getElementById('new-assign-due-time') ? document.getElementById('new-assign-due-time').value : '').trim();
    var due = dueDate && dueTime ? dueDate + 'T' + dueTime : '';
    var typeInput = document.querySelector('input[name="new-assign-type"]:checked');
    var type = typeInput ? typeInput.value : '';
    var errEl = document.getElementById('new-assign-error');
    if (!title || !script || !due || !type) {
        if (errEl) { errEl.textContent = 'Title, assignment type, script, and due date are required.'; errEl.style.display = 'block'; }
        return;
    }
    var saveBtn = document.getElementById('new-assign-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    createAssignment(_clsCtx.classId, S.authUser.uid, title, instructions, script, due, type)
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
            return db.collection('submissions').doc(submissionId).update({
                recordingData: firebase.firestore.FieldValue.delete()
            });
        })
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
