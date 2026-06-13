// Onboarding Wizard
var _obStep = 1;

function initOnboardingScreen() {
    _obStep = 1;
    ['ob-name', 'ob-dob', 'ob-school', 'ob-grade'].forEach(function(id) {
        var el = $(id); if (el) el.value = '';
    });
    var err = $('ob-error-1');
    if (err) err.classList.add('hidden');
    var nextBtn = $('ob-next-btn');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Next'; nextBtn.onclick = obNext; }
    showOnboardingStep(1);
}

function showOnboardingStep(n) {
    _obStep = n;
    [1, 2].forEach(function(i) {
        var el = $('ob-step-' + i);
        if (el) el.classList.toggle('hidden', i !== n);
    });
    var label = $('ob-step-label');
    if (label) label.textContent = 'Step ' + n + ' of 2';
    var fill = $('ob-progress-fill');
    if (fill) fill.style.width = ((n / 2) * 100).toFixed(2) + '%';
    var backBtn = $('ob-back-btn');
    if (backBtn) backBtn.classList.toggle('hidden', n === 1);
    var nextBtn = $('ob-next-btn');
    if (nextBtn) {
        if (n === 2) {
            nextBtn.textContent = "Let's get started";
            nextBtn.onclick = submitOnboardingProfile;
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.onclick = obNext;
        }
    }
}

function obNext() {
    if (_obStep === 1) {
        var name = $('ob-name') ? $('ob-name').value.trim() : '';
        var dob = $('ob-dob') ? $('ob-dob').value : '';
        var school = $('ob-school') ? $('ob-school').value.trim() : '';
        var grade = $('ob-grade') ? $('ob-grade').value.trim() : '';
        var err = $('ob-error-1');
        if (!name || !dob || !school || !grade) {
            if (err) err.classList.remove('hidden');
            return;
        }
        if (err) err.classList.add('hidden');
        var welcome = $('ob-welcome-name');
        if (welcome) welcome.textContent = 'Welcome, ' + name + '!';
        showOnboardingStep(2);
    }
}

function obBack() {
    if (_obStep > 1) showOnboardingStep(_obStep - 1);
}

function submitOnboardingProfile() {
    var nextBtn = $('ob-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving\u2026'; }
    var data = {
        fullName: $('ob-name') ? $('ob-name').value.trim() : '',
        dob: $('ob-dob') ? $('ob-dob').value : '',
        school: $('ob-school') ? $('ob-school').value.trim() : '',
        grade: $('ob-grade') ? $('ob-grade').value.trim() : '',
        email: S.authUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    localStorage.setItem('voqua_ob_' + S.authUser.uid, '1');
    localStorage.setItem('voqua_profile_' + S.authUser.uid, JSON.stringify(data));
    S.userProfile = data;
    completeOnboardingAndStartApp();
    db.collection('users').doc(S.authUser.uid).set(data)
        .then(function() { console.log('Profile synced to Firestore'); })
        .catch(function(err) { console.warn('Profile sync failed:', err.message); });
}

function loadProfileIntoSettings() {
    if (!S.userProfile) return;
    var p = S.userProfile;
    if ($('profile-name')) $('profile-name').value = p.fullName || '';
    if ($('profile-dob')) $('profile-dob').value = p.dob || '';
    if ($('profile-school')) $('profile-school').value = p.school || '';
    if ($('profile-grade-label')) $('profile-grade-label').textContent = 'Grade';
    if ($('profile-grade')) $('profile-grade').value = p.grade || '';
    var statusEl = $('profile-save-status');
    if (statusEl) statusEl.textContent = '';
}

function saveProfileFromSettings() {
    if (!S.authUser || !S.authUser.uid) return;
    var name = $('profile-name') ? $('profile-name').value.trim() : '';
    var dob = $('profile-dob') ? $('profile-dob').value : '';
    var school = $('profile-school') ? $('profile-school').value.trim() : '';
    var grade = $('profile-grade') ? $('profile-grade').value.trim() : '';
    var statusEl = $('profile-save-status');
    var updateData = { fullName: name, dob: dob, school: school, grade: grade };
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
