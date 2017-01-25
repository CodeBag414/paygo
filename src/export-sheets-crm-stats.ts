import * as exportsheetsutil from './export-sheets-util';

module.exports = {
    id: 'export-sheets-crm-stats',
    refresh: async function () {
        await exportsheetsutil.exportToSheet({
            documentName: 'PayGo CRM',
            sheetName: 'crm_stats',
            sourceRef: 'crm/stats'
        });
    }
};
