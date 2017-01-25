import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as backup from './task-backup';
import * as restore from './task-restore';
import * as util from './task-util';

async function task(db, args) {
    if (await util.question('HEY! are you sure you want to upgrade the database from v1 to v2? ') != 'yes') {
        throw new Error('canceled');
    }

    let version = (await db.ref('/global/version').once('value')).val();
    if (version != 1) {
        throw new Error('database is not v1; cannot upgrade');
    }

    console.log('backing up');
    await backup.task(db, { output: 'upgrade-v2-backup.json.gz' });

    try {
        console.log('remove payments');
        await util.drop(db, 'global/feed_sheets_payments_start_at');
        await util.drop(db, 'payments');
        await util.drop(db, `/crm/payments`);

        await db.ref('/global/version').set(2);

        console.log('finished!');
    }
    catch (err) {
        console.log(err);
        console.log('restoring backup');
        await restore.task(db, { input: 'upgrade-v2-backup.json.gz' });
    }
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Upgrades the Firebase database to v2.'
    });
    util.addTaskArgs(parser);
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
