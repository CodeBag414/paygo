import * as sheetsutil from './sheets-util';

async function filterOpportunitiesToCrm() {

    let salesSheet = new sheetsutil.Sheets('PayGo Sales', true);
    await salesSheet.connect();

    let crmSheet = new sheetsutil.Sheets('PayGo CRM', false);
    await crmSheet.connect();

    let opIdCol = await salesSheet.columnLetter('Opportunities', 'customer id');
    let opIds = (await salesSheet.get('Opportunities', `${opIdCol}2:${opIdCol}`))
        .map((row) => row[0]);

    let crmIdCol = await crmSheet.columnLetter('crm_info', 'customer_id');
    let crmIds = (await crmSheet.get('crm_info', `${crmIdCol}2:${crmIdCol}`))
        .map((row) => row[0]);

    let columnRelation = {
        'customer_id': 'customer id', //CN
        'first_name': 'PayGo Lead First Name', //F
        'last_name': 'PayGo Lead Last Name', //G
        'full_name': 'PayGo lead full name', //H
        'gender': 'Gender', //Q
        'phone_1': 'PayGo Lead Phone Number', //R
        'phone_2': 'PayGo Lead additional Phone Number', //S
        'sales_staff_id': 'Paygo Staff Name', //D
        'account_manager_id': 'Account manager ID',
        'national_id': 'National ID number', //DD
        'id_front_url': 'Copy of ID Front', //DE
        'id_back_url': 'Copy of ID Back', //DF
        'photo_url': 'Photo of Customer', //DI
        'location_area': 'Area', //X
        'location_sub_area': 'Sub Area', //Y
        'gps': 'GPS1', //Z
        'location_description': 'Location notes (key landmarks)', //AA
        'lead_created_at': 'Lead Created Timestamp', //B
        'lead_qualified_at': 'Qualified Lead Timestamp', //AH
        'activated_at': 'Account Created Timestamp', //CO
        'deactivated_at': 'Not Active Timestamp', //EL
        'fee_price': 'Fee Required', //CZ
        'timezone': 'Timezone', //DX
    };

    let opHead = await salesSheet.head('Opportunities');
    let crmHead = await crmSheet.head('crm_info');

    for (let i in opIds) {
        let opId = opIds[i];
        if (opId) {

            if (crmIds.indexOf(opId) == -1) {

                let row = 2 + Number(i);
                let fromRow = await salesSheet.get('Opportunities', `A${row}:ZZZ${row}`);
                let toRow = [];

                for (let to of crmHead) {

                    if (!(to in columnRelation)) {
                        throw new Error(
                            `PayGo CRM/crm_info has column heading ${to}, but there is no recorded correspondence ` +
                            `with the PayGo Sales/Opportunities sheet.`);
                    }

                    let from = columnRelation[to];
                    let fromIndex = opHead.indexOf(from);
                    if (fromIndex == -1) {
                        throw new Error(
                            `Column heading ${to} in the PayGo Sales/Opportunities sheet is expected to correspond ` +
                            `with column heading ${from} in PayGo CRM/crm_info, but it is missing.`);
                    }

                    toRow.push(fromRow[0][fromIndex]);

                }

                await crmSheet.append('crm_info', 'A1', [toRow]);
            }
        }
    }

}

async function transferToCRMInfo() {
    let salesSheet = new sheetsutil.Sheets('PayGo Sales', false);
    await salesSheet.connect();

    let salesCRMRows = await salesSheet.get('CRM', `A:ZZZ`);

    let crmSheet = new sheetsutil.Sheets('PayGo CRM', false);
    await crmSheet.connect();

    await crmSheet.resize('crm_info', salesCRMRows.length, salesCRMRows[0].length);
    await crmSheet.put('crm_info', 'A:ZZZ', salesCRMRows);
}

module.exports = {
    id: 'xfer-sales',
    refresh: async function () {

        await filterOpportunitiesToCrm();
        // await transferToCRMInfo();

    }
};
