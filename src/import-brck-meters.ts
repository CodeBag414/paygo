import * as bunyan from 'bunyan';
import * as config from './config';
import * as firebase from 'firebase';
import * as moment from 'moment';
import * as request from 'request-promise-native';

const log = bunyan.createLogger({ name: 'import-brck-meters' });
const db = firebase.database();

module.exports = {
    id: 'import-brck-meters',
    refresh: async function () {
        let response = await request('http://thingspeak.brck.io/channels.json?api_key=' + config.THINGSPEAK_API_KEY);

        for (let meter of JSON.parse(response)) {
            if (meter.name.toLowerCase().indexOf('test') == -1) {
                await db.ref(`meters/info/${meter.id}`)
                    .update({
                        type: 'brck',
                        meter_id: meter.id,
                        channel: meter.id,
                        name: meter.name,
                        description: meter.description,
                        api_key: meter.api_keys[0].api_key,
                        created_at: meter.created_at
                    });
            }
        }
    }
};
