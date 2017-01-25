import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-cylinders-info',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'PayGo Cylinders',
            sheetName: 'Cylinder_info',
            mode: 'update',
            destinationRef: 'cylinders/info',
            destinationKey: 'cylinder_id',
            required: ['cylinder_id', 'tare_weight_kg', 'alert_gas_weight_kg'],
            hook: 'cylinder_info_changed'
        });
    }
};
