/* ═══════════════════════════════════════════════════════════════
    ASSIGNMENTS
═══════════════════════════════════════════════════════════════ */

function createAssignment(classId, teacherUid, title, instructions, script, dueDate, type) {
    return db.collection('assignments').add({
        classId:      classId,
        teacherUid:   teacherUid,
        title:        title,
        instructions: instructions,
        script:       script,
        dueDate:      dueDate,
        type:         type,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(docRef) {
        return docRef.id;
    });
}

function getClassAssignments(classId) {
    return db.collection('assignments')
        .where('classId', '==', classId)
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

function submitAssignment(assignmentId, studentUid, lineRecordings, lineScores, lineDetails, lineResponses, lineTexts) {
    var data = {
        assignmentId:    assignmentId,
        studentUid:      studentUid,
        lineRecordings:  lineRecordings,
        lineScores:      lineScores,
        lineDetails:     lineDetails,
        lineResponses:   lineResponses,
        lineTexts:       lineTexts,
        teacherGrade:    '',
        teacherComment:  '',
        status:          'submitted',
        submittedAt:     firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('submissions')
        .where('assignmentId', '==', assignmentId)
        .where('studentUid', '==', studentUid)
        .get()
        .then(function(snapshot) {
            var existing = snapshot.docs[0];
            if (existing) {
                return existing.ref.set(data).then(function() { return existing.id; });
            }
            return db.collection('submissions').add(data).then(function(docRef) {
                return docRef.id;
            });
        });
}

function getStudentAssignmentSubmissions(assignmentIds, studentUid) {
    if (!assignmentIds.length) return Promise.resolve([]);
    var queries = [];
    for (var i = 0; i < assignmentIds.length; i += 10) {
        queries.push(db.collection('submissions')
            .where('assignmentId', 'in', assignmentIds.slice(i, i + 10))
            .where('studentUid', '==', studentUid)
            .get());
    }
    return Promise.all(queries).then(function(snapshots) {
        return snapshots.reduce(function(submissions, snapshot) {
            return submissions.concat(snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            }));
        }, []);
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
