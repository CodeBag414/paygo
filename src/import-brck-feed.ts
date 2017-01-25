import * as bunyan from 'bunyan';
import * as firebase from 'firebase';
import * as hooks from './hooks';
import * as moment from 'moment';
import * as request from 'request-promise-native';

const log = bunyan.createLogger({ name: 'import-brck-feed' });
const db = firebase.database();

async function refreshFeed(meterInfo, meterState) {
    let channelResponse = await request(
        'http://thingspeak.brck.io/channels/' + meterInfo.meter_id +
        '/feeds.json?results=1&api_key=' + meterInfo.api_key);

    let channel = JSON.parse(channelResponse).channel;

    let startFetchAt = new Date(meterState.fetched_at || channel.created_at);
    let endFetchAt = new Date(channel.updated_at);

    while (startFetchAt < endFetchAt) {
        let endRequestAt = new Date(startFetchAt);
        endRequestAt.setDate(startFetchAt.getDate() + 1);

        let feedResponse = await request(
            'http://thingspeak.brck.io/channels/' + meterInfo.meter_id + '/feeds.json?' +
            '&start=' + startFetchAt.toISOString() +
            '&end=' + endRequestAt.toISOString() +
            '&api_key=' + meterInfo.api_key);

        let feeds = JSON.parse(feedResponse).feeds;

        let nextEntryAt = moment(0);
        let lastGasLevel = meterState.last_gas_level || 0;
        let addedCount = 0;

        for (let entry of feeds) {

            const KG_PER_PULSE = 0.005;

            let gasLevel = Number.parseInt(entry.field5) * KG_PER_PULSE;
            let gasUsed = lastGasLevel - gasLevel;

            let updateForTime = moment(entry.created_at).diff(nextEntryAt) >= 0;
            let updateForGasLevel = gasUsed != 0;

            if (updateForTime || updateForGasLevel) {

                let feed = {
                    meter_id: meterInfo.meter_id,
                    id: entry.entry_id,
                    session_count: Number.parseInt(entry.field1),
                    gas_kg: gasUsed,
                    voltage: Number.parseInt(entry.field2),
                    valve: Number.parseInt(entry.field3),
                    credit: Number.parseInt(entry.field4) / 10,      // Per Backend_v1_BRCK.js:71
                    gas_level: gasLevel,
                    signal: Number.parseInt(entry.field6),
                    timestamp: entry.created_at
                };

                await hooks.execute('meter_feed_added', feed);

                await db.ref('feed').push(feed);
                
                nextEntryAt = moment(entry.created_at).add(1, 'hour');
                lastGasLevel = gasLevel;

                addedCount += 1;
            }

        }

        await db.ref(`meters/state/${meterInfo.meter_id}`).update({
            fetched_at: endRequestAt.toISOString(),
            last_gas_level: lastGasLevel
        });

        // if (addedCount) {
        //     log.info(`brck ${meterInfo.meter_id} added ${addedCount} entries through ${endRequestAt.toDateString()}`);
        // }

        startFetchAt = new Date(endRequestAt);
    }
}

module.exports = {
    id: 'import-brck-feed',
    refresh: async function () {
        let meterInfos = (await db.ref('meters/info').once('value')).val();
        let meterStates = (await db.ref('meters/state').once('value')).val() || {};

        let r = [];
        for (let id in meterInfos) {
            if (meterInfos[id].type == 'BRCK') {
                r.push(refreshFeed(meterInfos[id], meterStates[id] || {}));
                // await refreshFeed(meters[id]);
            }
        }
        await Promise.all(r);
    }
};
