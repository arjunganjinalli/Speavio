var db = firebase.firestore();
var storage = firebase.storage();

db.enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
    console.warn('Firestore persistence unavailable:', err.code);
  });
