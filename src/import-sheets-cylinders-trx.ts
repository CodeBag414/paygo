import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-cylinders-trx',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo Cylinders',
            sheetName: 'Cylinder_trx',
            mode: 'push',
            startRowRef: 'global/sheets_cylinders_service_trx_start_at',
            destinationRef: 'cylinders/service_trx',
            destinationKey: 'cylinder_id',
            uniqueKey: 'unique_id',
            required: ['timestamp', 'action', 'current_location', 'cylinder_id'],
            transform: {
                timestamp: importsheetsutil.transformDate
            },
            hook: 'cylinder_trx_added'
        });
    }
};
