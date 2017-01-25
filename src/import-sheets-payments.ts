import * as importsheetsutil from './import-sheets-util';

module.exports = {
    id: 'import-sheets-payments',
    refresh: async function () {
        await importsheetsutil.importFromSheet({
            documentName: 'Payments V2',
            sheetName: 'Payments_Zap',
            mode: 'push',
            startRowRef: 'global/sheets_payments_start_at',
            destinationRef: 'payments',
            mapping: {
                'Msisdn': 'msisdn',
                'Transaction ID': 'transaction_id',
                'Status': 'status',
                'Amount': 'amount',
                'Customer ID': 'customer_id',
                'Sender': 'sender',
                'Timestamp': 'timestamp'
            },
            transform: {
                amount: importsheetsutil.transformNumber,
                timestamp: importsheetsutil.transformDate
            },
            required: ['amount', 'timestamp', 'transaction_id', /*'sender',*/ 'customer_id'],
            uniqueKey: 'transaction_id',
            hook: 'payment_added'
        });
    }
};
