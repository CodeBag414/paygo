import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as util from './task-util';

async function task(db, args) {
    for (let r of ['crm', 'meters']) {
        let logs = (await db.ref(r).child('log').once('value')).val();

        for (let l in logs) {
            let log = logs[l];
            for (let e in log) {
                let entry = log[e];
                if ('from' in entry) {
                    await db.ref(`${r}/log/${l}/${e}`).set({
                        key: entry['key'],
                        action: 'changed',
                        old_value: entry['from'],
                        value: entry['to'],
                        timestamp: entry['timestamp']
                    });
                    console.log(r, l, e, JSON.stringify(entry));
                }
            }
        }
    }

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Switches log entries from from/to to old_value/new_value.'
    });
    util.addTaskArgs(parser);
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
