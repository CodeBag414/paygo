import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as backup from './task-backup';
import * as util from './task-util';

export async function task(db, args) {
    if (await util.question('HEY! are you sure you want to completely wipe the database? ') != 'yes') {
        throw new Error('canceled');
    }

    console.log('clear');
    await db.ref().remove();

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Saves the contents of the Firebase database to a zipped JSON file.'
    });
    util.addTaskArgs(parser);
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
