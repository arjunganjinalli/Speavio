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

function showClassAssignments(classId, className){
    toast('Loading assignments for '+className+'...','info');
}

function showStudentAssignments(classId, className){
    toast('Loading assignments for '+className+'...','info');
}