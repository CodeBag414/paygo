import * as argparse from 'argparse';
import * as firebase from 'firebase';
import * as fs from 'fs';
import * as zlib from 'zlib';

import * as util from './task-util';

const promisify = require('es6-promisify');

export async function task(db, args) {
    console.log('saving to', args.output);

    console.log('fetch');
    let data = (await db.ref('/').once('value')).val();

    console.log('json');
    let json = JSON.stringify(data);

    console.log('buffer');
    let buffer = new Buffer(json, 'utf-8');

    console.log('zip');
    let zipped = await promisify(zlib.gzip)(buffer);

    console.log('write');
    await promisify(fs.writeFile)(args.output, zipped);

    console.log('finished!');
}

if (require.main === module) {
    let parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'Saves the contents of the Firebase database to a gzipped JSON file.'
    });
    util.addTaskArgs(parser);
    parser.addArgument(['-o', '--output'], {
        help: 'File to write the database to; default is backup. Date and .json.gz are appended automatically.',
        dest: 'output',
        defaultValue: 'backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json.gz'
    });
    let args = parser.parseArgs();

    firebase.initializeApp(util.FIREBASE_CONFIGS[args.environment]);
    const db = firebase.database();

    task(db, args).then(() => { process.exit() });
}
