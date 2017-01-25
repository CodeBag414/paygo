import * as argparse from 'argparse';
import * as firebase from 'firebase';
import * as fs from 'fs';
import * as zlib from 'zlib';

import * as util from './task-util';

const promisify = require('es6-promisify');

export async function task(db, args) {
    console.log('reading from', args.input);

    console.log('read');
    let zipped = await promisify(fs.readFile)(args.input);

    console.log('unzip');
    let buffer = await promisify(zlib.gunzip)(zipped);

    console.log('buffer');
    let json = buffer.toString('utf-8');

    console.log('json');
    let data = JSON.parse(json);

    if (!('global' in data && 'crm' in data && 'meters' in data)) {
        throw new Error('failed sanity check');
    }

    console.log('store');
    await db.ref('/').set(data);

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Restores the contents of the Firebase database from a gzipped JSON file.'
    });
    util.addTaskArgs(parser);
    parser.addArgument(['-i', '--input'], {
        help: 'File to read the database from.',
        dest: 'input',
        required: true
    });
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
