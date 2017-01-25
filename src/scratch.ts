import * as config from './config';
import * as firebase from 'firebase';

firebase.initializeApp({
    apiKey: config.FIREBASE_API_KEY,
    authDomain: config.FIREBASE_AUTH_DOMAIN,
    databaseURL: config.FIREBASE_DATABASE_URL,
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID
});

const db = firebase.database();

db.ref('nonexistent').remove();

db.ref('nonexistent').child('child').on('value', (value) => {
    console.log(value.val());
});

db.ref('nonexistent').child('child').set(true);
db.ref('nonexistent').child('child').set(false);

db.ref('nonexistent').remove();

db.ref('nonexistent').child('child').set(true);
db.ref('nonexistent').child('child').set(false);
