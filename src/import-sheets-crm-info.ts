import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-crm-info',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo CRM',
            sheetName: 'crm_info',
            mode: 'update',
            destinationRef: 'crm/info',
            destinationKey: 'customer_id',
            required: ['customer_id', 'full_name', 'fee_price', 'timezone'],
            transform: {
                fee_price: importsheetsutil.transformNumber,
            },
            hook: 'crm_info_changed'
        });
    }
};
