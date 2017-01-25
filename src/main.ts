import * as alert from './alert';
import * as config from './config';
import * as bunyan from 'bunyan';
import * as firebaseadmin from 'firebase-admin';
import * as firebase from 'firebase';

const DATABASE_VERSION = 2;

const log = bunyan.createLogger({ name: 'main' });

//Error.stackTraceLimit=10;
//require('longjohn');

var heapdump = require('heapdump');
var memwatch = require('memwatch-next');

memwatch.on('leak', function (info) {
    console.error(info);
    var file = 'paygo-services-' + process.pid + '-' + Date.now() + '.heapsnapshot';
    heapdump.writeSnapshot(file, function (err) {
        if (err) console.error(err);
        else console.error('Wrote snapshot: ' + file);
    });
});

var cron = require('cron');

firebase.initializeApp({
    credential: firebaseadmin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.GOOGLE_SERVICE_CLIENT_EMAIL,
        privateKey: config.GOOGLE_SERVICE_PRIVATE_KEY.split('\\n').join('\n')
    }),
    authDomain: config.FIREBASE_AUTH_DOMAIN,
    databaseURL: config.FIREBASE_DATABASE_URL,
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID
});
const db = firebase.database();

let imports = [
    require('./xfer-sales'),
    
    require('./import-sheets-cylinders-info'),
    require('./import-sheets-cylinders-trx'),
    require('./import-sheets-meters-info'),
    require('./import-sheets-meters-trx'),
    require('./import-sheets-crm-info'),
    require('./import-sheets-crm-trx'),
    require('./import-sheets-payments'),
    require('./import-brck-feed'),

    require('./state-machine'),

    require('./crm-stats'),

    require('./export-sheets-crm-stats')
];

let listeners = [
    require('./cylinders-log'),
    require('./meters-alert'),
    require('./meters-feed'),
    require('./meters-latest'),
    require('./meters-log'),
    require('./crm-log'),
    require('./crm-payments')
];

let inRefresh = {};
async function refresh(name, callback) {
    if (name in inRefresh) {
        log.warn(`skipping new ${name} refresh because a prior instance is still running`);
    }
    inRefresh[name] = true;

    try {
        log.info(`begin refresh ${name}`);
        await callback();
        log.info(`end refresh ${name}`);
    } catch (err) {
        throw err;
    } finally {
        delete inRefresh[name];
    }
}

async function refreshAll(list) {
    try {
        for (let i of list) {
            await refresh(i.id, i.refresh);
        }
    } catch (err) {
        alert.alert({
            message: `Failed to refresh; the import has stopped: ` + err.message
        })
        log.error(`Failed to refresh; the import has stopped: `, err.message, err);
    }
}

async function main() {

    let version = (await db.ref('global/version').once('value')).val();
    if (version != DATABASE_VERSION) {
        throw new Error(`database version is ${version}, expected ${DATABASE_VERSION}; exiting`);
    }

    for (let l of listeners) {
        l.listen();
    }

    refreshAll(imports);

    new cron.CronJob({
        cronTime: "0 0/4 * * * *",
        onTick: function () {
            refreshAll(imports);
        },
        start: true
    });

}

main();
