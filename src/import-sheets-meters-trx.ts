import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-meters-trx',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo Meters',
            sheetName: 'Meter_service_trx',
            mode: 'push',
            startRowRef: 'global/sheets_meters_service_trx_start_at',
            destinationRef: 'meters/service_trx',
            destinationKey: 'meter_id',
            required: ['timestamp', 'staff_id', 'action', 'current_location', 'meter_id', 'customer_staff_vendor_id'],
            transform: {
                timestamp: importsheetsutil.transformDate
            },
            hook: 'meter_trx_added'
        });
    }
};
