import * as argparse from 'argparse';
import * as firebase from 'firebase';

import * as util from './task-util';

const promisify = require('es6-promisify');

async function task(args) {
    let prodDb = firebase.initializeApp(util.FIREBASE_CONFIGS[args.from_environment], args.from_environment).database();
    let devDb = firebase.initializeApp(util.FIREBASE_CONFIGS[args.to_environment], args.to_environment).database();

    console.log('fetch');
    let data = (await prodDb.ref('/').once('value')).val();

    console.log('clear');
    await devDb.ref('/').remove();

    console.log('store');
    await devDb.ref('/').set(data);

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Copies the contents of one database to another.'
    });
    parser.addArgument(['-f', '--from-environment'], {
        help: 'Transfer from the given environment.',
        choices: Object.keys(util.FIREBASE_CONFIGS),
    });
    parser.addArgument(['-t', '--to-environment'], {
        help: 'Transfer to the given environment.',
        choices: Object.keys(util.FIREBASE_CONFIGS),
    });
    let args = parser.parseArgs();

    task(args).then(() => { process.exit() });
}
