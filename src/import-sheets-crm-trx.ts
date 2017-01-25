import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-crm-trx',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo CRM',
            sheetName: 'crm_service_trx',
            mode: 'push',
            startRowRef: 'global/sheets_crm_service_trx_start_at',
            destinationRef: 'crm/service_trx',
            destinationKey: 'customer_id',
            required: ['timestamp', 'action', 'customer_id', 'staff_id'],
            transform: {
                amount_change: importsheetsutil.transformNumber,
                timestamp: importsheetsutil.transformDate
            },
            hook: 'crm_trx_added'
        });
    }
};
