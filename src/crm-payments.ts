import * as hooks from './hooks';
import * as bunyan from 'bunyan';
import * as firebase from 'firebase';

const log = bunyan.createLogger({ name: 'crm-payments' });
const db = firebase.database();

module.exports = {
    id: 'crm-payments',
    listen: async function () {
        hooks.add('payment_added', async function (options: any) {
            let payment = options.value;

            let validCustomerId = false;

            if (!payment.customer_id || payment.customer_id.toUpperCase() === 'P0000') {

                let reason = payment.customer_id
                    ? `customer_id ${payment.customer_id}`
                    : "no customer_id";

                if (!payment.sender) {
                    log.warn(
                        `Payment ${payment.transaction_id} has ${reason}, but cannot be matched to a customer ` +
                        `by full name it has no sender name. ` +
                        `The payment is being ignored and will not apply to any balance.`);
                }

                let allCrmInfos = (await db.ref('crm/info').once('value')).val();

                for (let c in allCrmInfos) {
                    let crmInfo = allCrmInfos[c];

                    if (crmInfo.full_name.toLowerCase() === payment.sender.toLowerCase()) {

                        for (let c2 in allCrmInfos) {
                            let crmInfo2 = allCrmInfos[c2];
                            if (crmInfo2 == crmInfo) {
                                continue;
                            }
                            if (crmInfo2.full_name.toLowerCase() === crmInfo.full_name.toLowerCase()) {
                                throw new Error(
                                    `Payment ${payment.transaction_id} has ${reason}, but cannot be matched to a customer ` +
                                    `by full name because ${c} and ${c2} both share the sender's full name "${payment.sender}".`);
                            }
                        }

                        payment.original_customer_id = payment.customer_id;
                        payment.customer_id = c;
                        validCustomerId = true;

                        log.warn(
                            `Payment ${payment.transaction_id} with ${reason} was matched to customer_id ${payment.customer_id} using the ` +
                            `sender's full name "${payment.sender}".`);

                        break;

                    }
                }

                if (!payment.customer_id) {
                    log.warn(
                        `Payment ${payment.transaction_id} has ${reason}, and could not be matched by sender name ` +
                        `because there is no customer named "${payment.sender}". ` + 
                        `The payment is being ignored and will not apply to any balance.`);
                }

            } else {

                let crmInfo = (await db.ref(`crm/info/${payment.customer_id}`).once('value')).val();
                if (crmInfo) {
                    validCustomerId = true;
                } else {
                    log.warn(
                        `Payment ${payment.transaction_id} has non-existent customer_id ${payment.customer_id}. ` +
                        `The payment is being ignored and will not apply to any balance.`);
                }

            }

            if (validCustomerId) {

                let existingPayment = (await db.ref(`crm/payments/${payment.customer_id}`)
                    .orderByChild('transaction_id')
                    .equalTo(payment.transaction_id)
                    .once('value')
                ).val();

                if (existingPayment) {
                    throw new Error(
                        `A payment with transaction_id ${payment.transaction_id} has already been assigned to ` +
                        `customer_id ${payment.customer_id}; aborting the import to avoid duplication.`);
                }

                await db.ref(`crm/payments/${payment.customer_id}`).push(payment);
                
            }
        });
    }
};
