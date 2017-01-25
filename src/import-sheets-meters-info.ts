import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-meters-info',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo Meters',
            sheetName: 'Meter_info',
            mode: 'update',
            destinationRef: 'meters/info',
            destinationKey: 'meter_id',
            hook: 'meter_info_changed'
        });
    }
};
