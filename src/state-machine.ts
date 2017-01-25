import * as bunyan from 'bunyan';
import * as firebase from 'firebase';
import * as moment from 'moment';
import * as schema from './schema';

const log = bunyan.createLogger({ name: 'crm-trx' });
const db = firebase.database();

interface Event {
    timestamp: string;
}

interface StateMachine {
    at: string;

    crmInfos: { [customer_id: string]: schema.CRMInfo };
    meterInfos: { [meter_id: string]: schema.MeterInfo };
    cylinderInfos: { [cylinder_id: string]: schema.CylinderInfo };

    crmStates: { [customer_id: string]: schema.CRMState };
    meterStates: { [meter_id: string]: schema.MeterState };
    cylinderStates: { [cylinder_id: string]: schema.CylinderState };
}

async function getNewEvents(events: Event[], at: string, type: string, path: string) {
    let startAt = at ?
        moment(at).add('1ms') :
        moment(0);

    let newEvents = (await db.ref(path)
        .orderByChild('timestamp')
        .startAt(startAt.toISOString())
        .once('value')).val();

    for (let e in newEvents) {
        let event = newEvents[e];

        if (!('timestamp' in event)) {
            throw new Error(`The ${type} event at path ${path}/${e} is missing the timestamp field. Processing canceled.`)
        }

        event['type'] = type;

        events.push(event);
    }
}

function makeEmptyCRMState(): schema.CRMState {
    return {
        credit: 0,
        gas_price_per_kg: 300,
        deposit_paid: false,
        deposit_paid_at: "",
        meter_id: "",
        cylinder_id: "",
        stove_id: "",
        table_id: "",
        meter_received_at: "",
        cylinder_received_at: "",
    };
}

function makeEmptyMeterState(): schema.MeterState {
    return {
        customer_id: "",
        cylinder_id: "",
    };
}

function makeEmptyCylinderState(): schema.CylinderState {
    return {
        customer_id: "",
        meter_id: "",
    };
}

function getCRM(sm: StateMachine, customer_id: string): { info: schema.CRMInfo, state: schema.CRMState } {
    if (!(customer_id in sm.crmInfos)) {
        throw new Error(`Customer ${customer_id} does not exist.`);
    }
    return {
        info: sm.crmInfos[customer_id],
        state: sm.crmStates[customer_id]
    };
}

function getMeter(sm: StateMachine, meter_id: string): { info: schema.MeterInfo, state: schema.MeterState } {
    if (!(meter_id in sm.meterInfos)) {
        throw new Error(`Meter ${meter_id} does not exist.`);
    }
    return {
        info: sm.meterInfos[meter_id],
        state: sm.meterStates[meter_id]
    };
}

function getCylinder(sm: StateMachine, cylinder_id: string): { info: schema.CylinderInfo, state: schema.CylinderState } {
    if (!(cylinder_id in sm.cylinderInfos)) {
        throw new Error(`Cylinder ${cylinder_id} does not exist.`);
    }
    return {
        info: sm.cylinderInfos[cylinder_id],
        state: sm.cylinderStates[cylinder_id]
    };
}

function addCredit(sm: StateMachine, customer_id: string, amount: number, timestamp: string) {
    let crm = getCRM(sm, customer_id);

    crm.state.credit += amount;

    if (!crm.state.deposit_paid && crm.state.credit >= crm.info.fee_price) {
        // This would be a good place for a Slack announcement.
        crm.state.deposit_paid = true;
        crm.state.deposit_paid_at = timestamp;
        crm.state.credit -= crm.info.fee_price;
    }
}

function processPayment(sm: StateMachine, e) {
    addCredit(sm, e.customer_id, e.amount, e.timestamp);
}

function processFeed(sm: StateMachine, e) {
    if (e.gas_kg > 0) {
        let meter = getMeter(sm, e.meter_id);
        if (!meter.state.customer_id) {
            return; // free gas!
        }

        let gas_kg = -e.gas_kg;

        let crm = getCRM(sm, meter.state.customer_id);
        crm.state.credit -= gas_kg * crm.state.gas_price_per_kg;
    }
}

function processCRMServiceTrx(sm: StateMachine, e) {
    let crm = getCRM(sm, e.customer_id);

    switch (e.action) {

        case 'set_credit': {
            crm.state.credit = e.amount_change;
            break;
        }

        case 'add_credit': {
            addCredit(sm, e.customer_id, e.amount_change, e.timestamp);
            break;
        }

        case 'bonus_credit': {
            addCredit(sm, e.customer_id, e.amount_change, e.timestamp);
            break;
        }

        case 'update_gas_price': {
            crm.state.gas_price_per_kg = e.amount_change;
            break;
        }

        case 'update_tariff': {
            crm.state.gas_price_per_kg = e.amount_change;
            break;
        }

        case 'set_credit_ksh': {
            crm.state.credit = e.amount_change;
            break;
        }

        case 'reconcile_balance_ksh': {
            crm.state.credit = e.amount_change;
            break;
        }

        case 'add_bonus_ksh': {
            crm.state.credit += e.amount_change;
            break;
        }

        case 'set_gas_ksh_gram': {
            crm.state.gas_price_per_kg = e.amount_change;
            break;
        }

        default: {
            throw new Error(`Invalid CRM service action ${e.action}.`);
        }

    }
}

function processMeterServiceTrx(sm: StateMachine, e) {
    let meter = getMeter(sm, e.meter_id);

    switch (e.action) {

        case 'recieved_from':
        case 'received_from': {
            if (e.current_location == 'Customer') {
                meter.state.customer_id = e.customer_staff_vendor_id;

                let crm = getCRM(sm, meter.state.customer_id);
                crm.state.meter_id = meter.info.meter_id;
                crm.state.meter_received_at = e.timestamp;
            }
            break;
        }

        case 'sending_to': {
            if (e.current_location == 'Customer') {
                if (!meter.state.customer_id) {
                    throw new Error(
                        `Meter location is ${e.current_location}, but the meter ` +
                        `was not previously transferred to a customer. `);
                }
                let crm = getCRM(sm, meter.state.customer_id);
                crm.state.meter_id = "";

                meter.state.customer_id = "";
            }
            break;
        }

        default: {
            throw new Error(`Invalid Meter service action ${e.action}.`);
        }

    }
}

function processCylinderServiceTrx(sm: StateMachine, e) {
    let cylinder = getCylinder(sm, e.cylinder_id);

    switch (e.action) {

        case 'received_from_paygo_logistics_out': {
            cylinder.state.customer_id = e.customer_id;

            let crm = getCRM(sm, cylinder.state.customer_id);
            crm.state.cylinder_id = cylinder.info.cylinder_id;
            crm.state.cylinder_received_at = e.timestamp;

            break;
        }

        case 'received_from_customer': {
            if (!cylinder.state.customer_id) {
                throw new Error(
                    `Cylinder location is ${e.current_location}, but the cylinder ` +
                    `was not previously transferred to a customer. `);
            }
            let crm = getCRM(sm, cylinder.state.customer_id);
            crm.state.cylinder_id = "";

            cylinder.state.customer_id = "";

            break;
        }

        case 'received_from_vendor': 
        case 'received_from_paygo_hub_stock': 
        case 'received_from_paygo_logistics_return': 
        case 'received_from_paygo_hub_return': {
            break;
        }
        
        default: {
            throw new Error(`Unexpected Cylinder service action ${e.action}.`);
        }

    }
}

function processNewEvents(sm: StateMachine, newEvents: any[]) {
    for (let e of newEvents) {
        let functionMap = {
            payment: processPayment,
            feed: processFeed,
            crm_service_trx: processCRMServiceTrx,
            meter_service_trx: processMeterServiceTrx,
            cylinder_service_trx: processCylinderServiceTrx
        };

        if (!(e.type in functionMap)) {
            throw new Error(`Invalid event type ${e.type}.`);
        }

        let f = functionMap[e.type];

        try {
            f(sm, e);
        } catch (err) {
            err.message = 
                `While processing a ${e.type} event at ${e.timestamp}: ` +
                `${err.message} ` +
                `Data processing stopped, please fix this manually.`;
            throw err;
        }
        sm.at = e.timestamp;
    }
}

module.exports = {
    id: 'state-machine',
    refresh: async function () {
        let newEvents: Event[] = [];

        let sm: StateMachine = {
            at: (await db.ref(`global/state_at`).once('value')).val() || moment(0),

            crmInfos: (await db.ref('crm/info').once('value')).val(),
            meterInfos: (await db.ref('meters/info').once('value')).val(),
            cylinderInfos: (await db.ref('cylinders/info').once('value')).val(),

            crmStates: (await db.ref('crm/state').once('value')).val() || {},
            meterStates: (await db.ref('meters/state').once('value')).val() || {},
            cylinderStates: (await db.ref('cylinders/state').once('value')).val() || {}
        }

        await getNewEvents(newEvents, sm.at, 'feed', `feed`);

        for (let c in sm.crmInfos) {
            if (!(c in sm.crmStates)) {
                sm.crmStates[c] = makeEmptyCRMState();
            }
            await getNewEvents(newEvents, sm.at, 'crm_service_trx', `crm/service_trx/${c}`);
            await getNewEvents(newEvents, sm.at, 'payment', `crm/payments/${c}`);
        }

        for (let m in sm.meterInfos) {
            if (!(m in sm.meterStates)) {
                sm.meterStates[m] = makeEmptyMeterState();
            }
            await getNewEvents(newEvents, sm.at, 'meter_service_trx', `meters/service_trx/${m}`);
        }

        for (let c in sm.cylinderInfos) {
            if (!(c in sm.cylinderStates)) {
                sm.cylinderStates[c] = makeEmptyCylinderState();
            }
            await getNewEvents(newEvents, sm.at, 'cylinder_service_trx', `cylinders/service_trx/${c}`);
        }

        newEvents.sort(function (a, b) {
            return moment(a.timestamp, moment.ISO_8601).diff(moment(b.timestamp, moment.ISO_8601));
        });

        processNewEvents(sm, newEvents);

        await db.ref().update({
            "global/state_at": sm.at,
            "crm/state": sm.crmStates,
            "meters/state": sm.meterStates,
            "cylinders/state": sm.cylinderStates
        });
    }
};
