import * as firebase from 'firebase';
import * as hooks from './hooks';

const db = firebase.database();

export async function logInfoChanges(logRef: string, options: hooks.InfoChangedOptions) {
    let timestamp = new Date().toISOString();
    
    for (let k in options.old) {
        if (!(k in options.new)) {
            await db.ref(logRef).child(options.key).push({
                key: k,
                value: options.old[k],
                action: 'deleted',
                timestamp: timestamp
            });
        }
    }

    for (let k in options.new) {
        if (!(k in options.old)) {
            await db.ref(logRef).child(options.key).push({
                key: k,
                value: options.new[k],
                action: 'added',
                timestamp: timestamp
            });
        }
    }

    for (let k in options.new) {
        if (k in options.old) {
            if (options.new[k] !== options.old[k]) {
                await db.ref(logRef).child(options.key).push({
                    key: k,
                    old_value: options.old[k],
                    value: options.new[k],
                    action: 'changed',
                    timestamp: timestamp
                });
            }
        }
    }
}
