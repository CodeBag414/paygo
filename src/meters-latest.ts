import * as bunyan from 'bunyan';
import * as firebase from 'firebase';
import * as hooks from './hooks';

const log = bunyan.createLogger({ name: 'meter-state' });
const db = firebase.database();

module.exports = {
    id: 'meters-latest',
    listen: async function () {
        hooks.add('meter_feed_added', async function (feed) {
            await db.ref(`meters/latest/${feed.meter_id}`).set(feed);

            let customerId = (await db.ref(`meters/info/${feed.meter_id}/customer_id`).once('value')).val();
            if (customerId) {
                await db.ref(`crm/latest/${customerId}`).set(feed);
            }
        });
    }
};
