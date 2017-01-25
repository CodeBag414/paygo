import * as bunyan from 'bunyan';
import * as firebase from 'firebase';

const log = bunyan.createLogger({ name: 'meter-trx' });
const db = firebase.database();

module.exports = {
    id: 'meters-feed',
    listen: async function () {
        let skipFirst = true;
        db.ref('feed').limitToLast(1).on('child_added', async function (feedSnap) {
            if (skipFirst) { skipFirst = false; return; }

            let feed = feedSnap.val();

            await db.ref(`meters/feed/${feed.meter_id}/${feedSnap.key}`).set(feed);
        });
    }
};
