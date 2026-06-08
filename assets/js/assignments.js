/* ═══════════════════════════════════════════════════════════════
    ASSIGNMENTS
═══════════════════════════════════════════════════════════════ */

function createAssignment(classId, teacherUid, title, instructions, script, dueDate) {
    return db.collection('assignments').add({
        classId:      classId,
        teacherUid:   teacherUid,
        title:        title,
        instructions: instructions,
        script:       script,
        dueDate:      dueDate,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(docRef) {
        return docRef.id;
    });
}

function getClassAssignments(classId) {
    return db.collection('assignments')
        .where('classId', '==', classId)
        .orderBy('dueDate')
        .get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
        });
}

function getStudentAssignments(studentUid) {
    return getStudentClasses(studentUid).then(function(classes) {
        if (!classes.length) return [];
        var promises = classes.map(function(c) {
            return db.collection('assignments')
                .where('classId', '==', c.id)
                .orderBy('dueDate')
                .get()
                .then(function(snapshot) {
                    return snapshot.docs.map(function(doc) {
                        return Object.assign({ id: doc.id, classId: c.id }, doc.data());
                    });
                });
        });
        return Promise.all(promises).then(function(results) {
            return results.reduce(function(acc, arr) { return acc.concat(arr); }, []);
        });
    });
}

function submitAssignment(assignmentId, studentUid, transcript, aiScore, recordingUrl) {
    return db.collection('submissions').add({
        assignmentId:    assignmentId,
        studentUid:      studentUid,
        transcript:      transcript,
        aiScore:         aiScore,
        recordingUrl:    recordingUrl,
        teacherGrade:    '',
        teacherComment:  '',
        status:          'submitted',
        submittedAt:     firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(docRef) {
        return docRef.id;
    });
}

function getAssignmentSubmissions(assignmentId) {
    return db.collection('submissions')
        .where('assignmentId', '==', assignmentId)
        .get()
        .then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
        });
}

function gradeSubmission(submissionId, teacherGrade, teacherComment) {
    return db.collection('submissions').doc(submissionId).update({
        teacherGrade:   teacherGrade,
        teacherComment: teacherComment,
        status:         'graded',
        gradedAt:       firebase.firestore.FieldValue.serverTimestamp()
    });
}
