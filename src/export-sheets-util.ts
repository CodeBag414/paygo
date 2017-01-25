import * as config from './config';
import * as firebase from 'firebase';
import * as hooks from './hooks';
import * as moment from 'moment-timezone';

const google = require('googleapis');
const promisify = require('es6-promisify');

const db = firebase.database();
const sheets = google.sheets('v4');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CREDS = {
    client_email: config.GOOGLE_SERVICE_CLIENT_EMAIL,
    private_key: config.GOOGLE_SERVICE_PRIVATE_KEY.split('\\n').join('\n')
}

function columnToLetter(column) {
    let letter = '';
    while (column > 0) {
        let temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}

interface ExportToSheetOptions {
    documentName: string,
    sheetName: string,
    mapping?: { [key: string]: string },
    transform?: { [key: string]: Function },
    sourceRef: string
};

export async function exportToSheet(options: ExportToSheetOptions) {
    let documentKey = config.GOOGLE_SHEET_KEYS[options.documentName];

    let jwtClient = new google.auth.JWT(CREDS.client_email, null, CREDS.private_key, SCOPES, null);

    await promisify(jwtClient.authorize, jwtClient)();

    let documentMeta;
    try {
        documentMeta = await promisify(sheets.spreadsheets.get)({
            auth: jwtClient,
            spreadsheetId: documentKey
        });
    } catch (err) {
        err.message =
            `Sheet ${documentKey} is inaccessible. ` +
            `${err.message} ` +
            `Data export of ${options.sheetName} skipped.`;
        throw err;
    }

    let sheetMeta = null;
    for (let meta of documentMeta.sheets) {
        if (meta.properties.title === options.sheetName) {
            sheetMeta = meta;
        }
    }
    if (!sheetMeta) {
        throw new Error(
            `${documentMeta.properties.title}/${options.sheetName} sheet is missing. ` +
            `Data export canceled, please fix this manually.`);
    }

    let endColLetter = columnToLetter(sheetMeta.properties.gridProperties.columnCount);

    let headResponse = await promisify(sheets.spreadsheets.values.get)({
        auth: jwtClient,
        spreadsheetId: documentKey,
        range: `${options.sheetName}!A1:${endColLetter}`
    });
    let head = headResponse.values[0];

    let mapping = options.mapping;
    if (mapping) {
        for (let m in mapping) {
            if (head.indexOf(m) == -1) {
                throw new Error(
                    `${documentMeta.properties.title}/${options.sheetName} sheet is missing column ${m}. ` +
                    `Data export canceled, please fix this manually.`);
            }
        }
        for (let h of head) {
            if (!(h in mapping)) {
                throw new Error(
                    `${documentMeta.properties.title}/${options.sheetName} sheet contains unexpected column ${h}. ` +
                    `Data export canceled, please fix this manually.`);
            }
        }
    } else {
        mapping = {};
        for (let h of head) {
            mapping[h] = h;
        }
    }

    let mappingValues = Object.keys(mapping).map(key => mapping[key]);

    let transform = options.transform || {};
    for (let m of mappingValues) {
        if (!(m in transform)) {
            transform[m] = (v, context) => v;
        }
    }
    let transformContext = {
        sheetMeta: sheetMeta
    }

    let data = (await db.ref(options.sourceRef).once('value')).val();

    let table = [];

    for (let d in data) {
        let entry = data[d];

        let row = [];
        for (let c in head) {
            try {
                let m = mapping[head[c]];
                let v = entry[m] || '';
                let t = transform[m];
                row.push(t(v, transformContext));
            } catch (err) {
                err.message =
                    `${documentMeta.properties.title}/${options.sheetName} transforming ${d} into "${head[c]}": ` +
                    `${err.message} ` +
                    `Data export stopped, please fix this manually.`;
                throw err;
            }
        }

        table.push(row);
    }

    await promisify(sheets.spreadsheets.values.update)({
        auth: jwtClient,
        spreadsheetId: documentKey,
        valueInputOption: 'RAW',
        range: `${options.sheetName}!A2:${endColLetter}`,
        resource: {
            majorDimension: 'ROWS',
            values: table
        }
    });
}
