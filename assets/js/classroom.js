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
