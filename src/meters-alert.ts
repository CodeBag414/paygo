import * as bunyan from 'bunyan';
import * as firebase from 'firebase';
import * as hooks from './hooks';

const log = bunyan.createLogger({ name: 'meter-alerts' });
const db = firebase.database();

const GAS_ALERT_LEVEL = 0.450;
const VOLTAGE_ALERT_LEVEL = 11000;

module.exports = {
    id: 'meters-alert',
    listen: async function () {
        hooks.add('meter_feed_added', async function (feed) {
            let meterStateRef = db.ref(`meters/state/${feed.meter_id}`);
            let timestamp = new Date(feed.timestamp);

            if (feed.voltage && feed.voltage < VOLTAGE_ALERT_LEVEL) {
                let latestVoltageAlertAt = new Date((await meterStateRef.child('voltage_alert_at').once('value')).val());

                if (timestamp > new Date(latestVoltageAlertAt.getTime() + 60*60000)) {
                    log.info('ALERT:', feed.meter_id, 'low voltage', feed.voltage);
                    await meterStateRef.update({
                        voltage_alert_at: feed.timestamp,
                        voltage_alert_value: feed.voltage
                    });
                }
            }

            if (feed.gas_level && feed.gas_level < GAS_ALERT_LEVEL) {
                let latestGasAlertAt = new Date((await meterStateRef.child('gas_alert_at').once('value')).val());

                if (timestamp > new Date(latestGasAlertAt.getTime() + 60*60000)) {
                    log.info('ALERT:', feed.meter_id, 'low gas', feed.gas_level);
                    await meterStateRef.update({
                        gas_alert_at: feed.timestamp,
                        gas_alert_value: feed.gas_level
                    });
                }
            }
        });
    }
};
