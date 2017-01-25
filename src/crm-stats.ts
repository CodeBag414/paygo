import * as bunyan from 'bunyan';
import * as firebase from 'firebase';
import * as moment from 'moment';
import * as schema from './schema';

const log = bunyan.createLogger({ name: 'crm-stats' });
const db = firebase.database();

async function arrayAt(path) {
    let ref = db.ref(path);
    let snap = await ref.once('value');
    let val = snap.val() || {};
    let result = [];
    for (let k in val) {
        result.push(val[k]);
    }
    return result;
}

async function dictAt(path) {
    let ref = db.ref(path);
    let snap = await ref.once('value');
    let val = snap.val() || {};
    return val;
}

module.exports = {
    id: 'crm-stats',
    refresh: async function () {
        let crmInfos = await dictAt('crm/info');

        for (let c in crmInfos) {
            let info: schema.CRMInfo = crmInfos[c];

            let state: schema.CRMState = await dictAt(`crm/state/${c}`);
            let trxs = await arrayAt(`crm/trx/${c}`);
            let payments = await arrayAt(`crm/payments/${c}`);

            let stats = {
                customer_id: c
            };

            for (let days of [7, 30]) {
                let cutoff = moment().subtract(days, 'days');
                let dateFilter = (t) => moment(t.timestamp).diff(cutoff) > 0;

                let trxs_since = trxs.filter(dateFilter);
                let payments_since = payments.filter(dateFilter);

                stats[`sessions_count_${days}d`] = trxs_since.reduce((a, t) => a + t.session_count, 0);
                stats[`gas_used_kg_${days}d`] = trxs_since.reduce((a, t) => a + t.gas_kg, 0);

                stats[`payments_count_${days}d`] = payments_since.length;
                stats[`payments_total_${days}d`] = payments_since.reduce((a, p) => a + p.amount, 0);
            }

            if (!state.deposit_paid_at) {
                stats['account_status'] = 'pre_activated';
            } else if (info.deactivated_at) {
                stats['account_status'] = 'deactivated';
            } else {
                let gas_7d = stats['gas_used_kg_7d'];
                if (gas_7d == 0) {
                    stats['account_status'] = 'not_active';
                } else {
                    let gas_30d = stats['gas_used_kg_30d'];
                    if (gas_30d <= 3000) {
                        stats['account_status'] = 'active_low';
                    } else if (gas_30d > 3000 && gas_30d < 4000) {
                        stats['account_status'] = 'active_med';
                    } else if (gas_30d >= 4000) {
                        stats['account_status'] = 'active_high';
                    }
                }
            }

            if (state.deposit_paid_at) {
                stats['fee_paid_at'] = state.deposit_paid_at;
                stats['days_since_fee_paid'] = moment().diff(moment(state.deposit_paid_at), 'days');
                stats['days_since_activation'] = moment().diff(moment(info.activated_at, 'DD/MM/YYYY').toISOString(), 'days');
            }

            stats['latest_timestamp'] = moment().toISOString();

            await db.ref(`crm/stats/${c}`).set(stats);
        }
    }
};
