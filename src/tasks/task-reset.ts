import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as util from './task-util';

async function task(db, args) {
    if (await util.question('HEY! are you sure you want to completely reset the transaction history? ') != 'yes') {
        throw new Error('canceled');
    }

    await util.drop(db, 'global/sheets_crm_service_trx_start_at');
    await util.drop(db, 'global/sheets_meters_service_trx_start_at');
    await util.drop(db, 'global/sheets_cylinders_service_trx_start_at');
    await util.drop(db, 'global/sheets_payments_start_at');
    await util.drop(db, 'global/state_at');

    await util.drop(db, `crm/service_trx`);
    await util.drop(db, `crm/payments`);
    await util.drop(db, `crm/latest`);
    await util.drop(db, `crm/state`);
    await util.drop(db, `crm/stats`);
    await util.drop(db, `crm/trx`);

    await util.drop(db, `meters/service_trx`);
    await util.drop(db, `meters/feed`);
    await util.drop(db, `meters/latest`);
    await util.drop(db, `meters/state`);
    
    await util.drop(db, `cylinders/service_trx`);
    await util.drop(db, `cylinders/state`);
    
    await util.drop(db, `payments`);
    await util.drop(db, `feed`);

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Clears transactions from the database, causing them to be reloaded from the source.'
    });
    util.addTaskArgs(parser);
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
