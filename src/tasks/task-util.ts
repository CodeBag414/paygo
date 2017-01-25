import * as argparse from 'argparse';
import * as config from '../config';
import * as firebaseadmin from 'firebase-admin';
import * as firebase from 'firebase';
import * as readline from 'readline';

const promisify = require('es6-promisify');

export let FIREBASE_CONFIGS = {};

for (let c of ['prod', 'dev', 'mwasyl']) {
    let config = require(`../config-${c}`);
    FIREBASE_CONFIGS[c] = {
        credential: firebaseadmin.credential.cert({
            projectId: config.FIREBASE_PROJECT_ID,
            clientEmail: config.GOOGLE_SERVICE_CLIENT_EMAIL,
            privateKey: config.GOOGLE_SERVICE_PRIVATE_KEY.split('\\n').join('\n')
        }),
        authDomain: config.FIREBASE_AUTH_DOMAIN,
        databaseURL: config.FIREBASE_DATABASE_URL,
        storageBucket: config.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID
    }
}

export function addTaskArgs(parser: argparse.ArgumentParser) {
    parser.addArgument(['-e', '--environment'], {
        help: 'Use the given environment.',
        choices: ['dev', 'prod'],
        defaultValue: 'dev'
    });
}

export async function question(prompt: string) {
    return new Promise((resolve, reject) => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

export async function move(db: firebase.database.Database, from: string, to: string) {
    let existing = (await db.ref(to).once('value')).val();
    if (existing != null) {
        throw new Error(`${to} is not empty; cannot remove`);
    }

    let val = (await db.ref(from).once('value')).val();
    await db.ref(to).set(val);
    await db.ref(from).remove();
    console.log(`moved ${from} -> ${to}`)
}

export async function remove(db: firebase.database.Database, path: string) {
    let val = (await db.ref(path).once('value')).val();
    if (val != null) {
        throw new Error(`${path} is not empty; cannot remove`);
    }
    await db.ref(path).remove();
}

export async function drop(db: firebase.database.Database, path: string) {
    await db.ref(path).remove();
}

export const ZAPIER_HOOK_URL = 'https://hooks.zapier.com/hooks/catch/1617387/tmbt5x/';

export const THINGSPEAK_API_KEY = 'Y23JIN2K4QZMF4V8';

export const GOOGLE_SHEET_KEYS = {
    'PayGo Sales': '1HUwvQP_cCUFALxXoXoJWz04p8Y7kAYY6wv-ZawMy7aU',
    'PayGo CRM': '1fHuPtdN2i0GcUYocc490fXXPPPvm7PWufl7XXmEbwjk',
    'PayGo Cylinders': '1RVYQR21_8VqtW3YzP-5uniPT_NmtB6v7vTam1P2-3HY',
    'PayGo Meters': '1V4UXnaRCzeFeS6kXF9u7BqzDCQu7iz2FSaGMGD9jSuE',
    'Payments V2': '1r1Esa_xHFQH4epYRyJdYjx6z_ci6ymGXtg8jb2PdxF4',
}