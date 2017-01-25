import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as backup from './task-backup';
import * as restore from './task-restore';
import * as util from './task-util';

async function task(db, args) {
    if (await util.question('HEY! are you sure you want to upgrade the database from v0 to v1? ') != 'yes') {
        throw new Error('canceled');
    }

    let version = (await db.ref('/global/version').once('value')).val();
    if (version != null) {
        throw new Error('database is not v0; cannot upgrade');
    }

    console.log('backing up');
    await backup.task(db, { output: 'upgrade-v1-backup.json.gz' });

    try {
        let crm = (await db.ref('/crm').once('value')).val();

        for (let c in crm) {
            await util.move(db, `/crm/${c}/info`, `/crm/info/${c}`);
            await util.move(db, `/crm/${c}/latest`, `/crm/latest/${c}`);
            await util.move(db, `/crm/${c}/log`, `/crm/log/${c}`);
            await util.move(db, `/crm/${c}/stats`, `/crm/stats/${c}`);

            await util.move(db, `/crm-payments/${c}`, `/crm/payments/${c}`);
            await util.move(db, `/crm-trx/${c}`, `/crm/trx/${c}`);
        }

        await util.remove(db, '/crm-payments');
        await util.remove(db, '/crm-trx');

        let meters = (await db.ref('/meters').once('value')).val();

        for (let m in meters) {
            await util.move(db, `/meters/${m}/info`, `/meters/info/${m}`);
            await util.move(db, `/meters/${m}/latest`, `/meters/latest/${m}`);

            await util.move(db, `/meters/${m}/fetched_at`, `/meters/state/${m}/fetched_at`);
            await util.move(db, `/meters/${m}/gas_alert_at`, `/meters/state/${m}/gas_alert_at`);
            await util.move(db, `/meters/${m}/gas_alert_value`, `/meters/state/${m}/gas_alert_value`);
            await util.move(db, `/meters/${m}/voltage_alert_at`, `/meters/state/${m}/voltage_alert_at`);
            await util.move(db, `/meters/${m}/voltage_alert_value`, `/meters/state/${m}/voltage_alert_value`);
            await util.move(db, `/meters/${m}/last_gas_level`, `/meters/state/${m}/last_gas_level`);

            await util.move(db, `/meters-feed/${m}`, `/meters/feed/${m}`);
        }

        await util.remove(db, '/meters-feed');

        await db.ref('/global/version').set(1);

        console.log('finished!');
    }
    catch (err) {
        console.log(err);
        console.log('restoring backup');
        await restore.task(db, { input: 'upgrade-v1-backup.json.gz' });
    }
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
