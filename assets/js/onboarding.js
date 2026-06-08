// ─── Onboarding Wizard ────────────────────────────────────────────────────────
var _obStep = 1;
var _obRole = null;

function initOnboardingScreen() {
    _obStep = 1;
    _obRole = null;
    ['ob-name', 'ob-dob', 'ob-school', 'ob-grade'].forEach(function(id) {
        var el = $(id); if (el) el.value = '';
    });
    document.querySelectorAll('.onboarding-role-card').forEach(function(c) {
        c.classList.remove('selected');
    });
    ['ob-error-1', 'ob-error-2', 'ob-submit-error'].forEach(function(id) {
        var el = $(id); if (el) el.classList.add('hidden');
    });
    var nextBtn = $('ob-next-btn');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Next'; nextBtn.onclick = obNext; }
    showOnboardingStep(1);
}

function showOnboardingStep(n) {
    _obStep = n;
    [1, 2, 3].forEach(function(i) {
        var el = $('ob-step-' + i);
        if (el) el.classList.toggle('hidden', i !== n);
    });
    var label = $('ob-step-label');
    if (label) label.textContent = 'Step ' + n + ' of 3';
    var fill = $('ob-progress-fill');
    if (fill) fill.style.width = ((n / 3) * 100).toFixed(2) + '%';
    var backBtn = $('ob-back-btn');
    if (backBtn) backBtn.classList.toggle('hidden', n === 1);
    var nextBtn = $('ob-next-btn');
    if (nextBtn) {
        if (n === 3) {
            nextBtn.textContent = "Let's get started";
            nextBtn.onclick = submitOnboardingProfile;
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.onclick = obNext;
        }
    }
}

function selectOnboardingRole(role) {
    _obRole = role;
    document.querySelectorAll('.onboarding-role-card').forEach(function(c) {
        c.classList.toggle('selected', c.dataset.role === role);
    });
    var label = $('ob-grade-label');
    if (label) label.textContent = role === 'teacher' ? 'Subject' : 'Grade';
    var input = $('ob-grade');
    if (input) input.placeholder = role === 'teacher' ? 'e.g. English, Mathematics' : 'e.g. Grade 10 / Year 2';
}

function obNext() {
    if (_obStep === 1) {
        var err = $('ob-error-1');
        if (!_obRole) { if (err) err.classList.remove('hidden'); return; }
        if (err) err.classList.add('hidden');
        showOnboardingStep(2);
    } else if (_obStep === 2) {
        if (!_validateObStep2()) return;
        var name = $('ob-name') ? $('ob-name').value.trim() : '';
        var welcome = $('ob-welcome-name');
        if (welcome) welcome.textContent = 'Welcome, ' + name + '!';
        showOnboardingStep(3);
    }
}

function obBack() {
    if (_obStep > 1) showOnboardingStep(_obStep - 1);
}

function _validateObStep2() {
    var name   = $('ob-name')   ? $('ob-name').value.trim()   : '';
    var dob    = $('ob-dob')    ? $('ob-dob').value            : '';
    var school = $('ob-school') ? $('ob-school').value.trim()  : '';
    var grade  = $('ob-grade')  ? $('ob-grade').value.trim()   : '';
    var err = $('ob-error-2');
    if (!name || !dob || !school || !grade) {
        if (err) err.classList.remove('hidden');
        return false;
    }
    if (err) err.classList.add('hidden');
    return true;
}

function submitOnboardingProfile() {
    var nextBtn = $('ob-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving\u2026'; }
    var data = {
        role:      _obRole,
        fullName:  $('ob-name').value.trim(),
        dob:       $('ob-dob').value,
        school:    $('ob-school').value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (_obRole === 'student') {
        data.grade = $('ob-grade').value.trim();
    } else {
        data.subject = $('ob-grade').value.trim();
    }
    var writePromise = db.collection('users').doc(S.authUser.uid).set(data);
    var timeoutPromise = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Firestore write timed out after 10s')); }, 10000);
    });
    Promise.race([writePromise, timeoutPromise])
        .then(function() {
            console.log('Firestore write success');
            S.userProfile = data;
            if(S.authUser&&S.authUser.uid) localStorage.setItem('voqua_ob_'+S.authUser.uid,'1');
            completeOnboardingAndStartApp();
        })
        .catch(function(err) {
            console.error('Firestore write failed or timed out:', err.message);
            var errEl = $('ob-submit-error');
            if (errEl) errEl.classList.remove('hidden');
            var nextBtn = $('ob-next-btn');
            if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "Let\u2019s get started"; }
        });
}

// ─── Settings Profile ─────────────────────────────────────────────────────────
function loadProfileIntoSettings() {
    if (!S.userProfile) return;
    var p = S.userProfile;
    if ($('profile-name'))   $('profile-name').value   = p.fullName || '';
    if ($('profile-dob'))    $('profile-dob').value    = p.dob      || '';
    if ($('profile-school')) $('profile-school').value = p.school   || '';
    var isTeacher = p.role === 'teacher';
    if ($('profile-grade-label'))
        $('profile-grade-label').textContent = isTeacher ? 'Subject' : 'Grade';
    if ($('profile-grade'))
        $('profile-grade').value = (isTeacher ? p.subject : p.grade) || '';
    var statusEl = $('profile-save-status');
    if (statusEl) statusEl.textContent = '';
}

function saveProfileFromSettings() {
    if (!S.authUser || !S.authUser.uid) return;
    var name           = $('profile-name')   ? $('profile-name').value.trim()   : '';
    var dob            = $('profile-dob')    ? $('profile-dob').value            : '';
    var school         = $('profile-school') ? $('profile-school').value.trim()  : '';
    var gradeOrSubject = $('profile-grade')  ? $('profile-grade').value.trim()   : '';
    var role = S.userProfile ? S.userProfile.role : null;
    var statusEl = $('profile-save-status');
    var updateData = { fullName: name, dob: dob, school: school };
    if (role === 'teacher') { updateData.subject = gradeOrSubject; }
    else                    { updateData.grade   = gradeOrSubject; }
    if (statusEl) statusEl.textContent = 'Saving\u2026';
    db.collection('users').doc(S.authUser.uid).update(updateData)
        .then(function() {
            if (S.userProfile) Object.assign(S.userProfile, updateData);
            if (statusEl) statusEl.textContent = 'Saved!';
            setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2500);
        })
        .catch(function(err) {
            console.error('Profile save failed:', err);
            if (statusEl) statusEl.textContent = 'Save failed. Try again.';
        });
}
