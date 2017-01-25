import * as config from './config';
import * as firebase from 'firebase';
import * as hooks from './hooks';
import * as moment from 'moment-timezone';

const google = require('googleapis');
const promisify = require('es6-promisify');

const sheets = google.sheets('v4');

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

export class Sheets {
    documentName: string;
    documentKey: string;
    readonly: boolean;
    jwtClient: any;
    documentMeta: any;
    sheetMeta: { [sheetName: string]: any };
    heads: { [sheetName: string]: any[] };

    constructor(documentName: string, readonly: boolean) {
        this.documentName = documentName;
        this.documentKey = config.GOOGLE_SHEET_KEYS[documentName];
        this.readonly = readonly;
        this.jwtClient = null;
        this.documentMeta = null;
        this.sheetMeta = {};
        this.heads = {};
    }

    async connect() {
        let scope = this.readonly
            ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
            : 'https://www.googleapis.com/auth/spreadsheets';

        this.jwtClient = new google.auth.JWT(CREDS.client_email, null, CREDS.private_key, [scope], null);
        await promisify(this.jwtClient.authorize, this.jwtClient)();

        try {
            this.documentMeta = await promisify(sheets.spreadsheets.get)({
                auth: this.jwtClient,
                spreadsheetId: this.documentKey
            });
        } catch (err) {
            err.message =
                `Sheet ${this.documentName} is inaccessible. ` +
                `${err.message} `;
            throw err;
        }

        for (let meta of this.documentMeta.sheets) {
            this.sheetMeta[meta.properties.title] = meta;
        }
    }

    private getSheetMeta(sheetName: string) {
        if (sheetName in this.sheetMeta) {
            return this.sheetMeta[sheetName];
        }
        throw new Error(`${this.documentName}/${sheetName} sheet is missing.`);
    }

    async head(sheetName: string): Promise<any[]> {
        if (sheetName in this.heads) {
            return this.heads[sheetName];
        }
        let meta = this.getSheetMeta(sheetName);
        let endColLetter = columnToLetter(meta.properties.gridProperties.columnCount);
        let headResponse = await promisify(sheets.spreadsheets.values.get)({
            auth: this.jwtClient,
            spreadsheetId: this.documentKey,
            range: `${sheetName}!A1:${endColLetter}`
        });
        this.heads[sheetName] = headResponse.values[0];
        return headResponse.values[0];
    }

    async get(sheetName: string, range: string): Promise<any[]> {
        let dataResponse = await promisify(sheets.spreadsheets.values.get)({
            auth: this.jwtClient,
            spreadsheetId: this.documentKey,
            range: `${sheetName}!${range}`
        });
        return dataResponse.values;
    }

    async put(sheetName: string, range: string, values: any[]) {
        await promisify(sheets.spreadsheets.values.update)({
            auth: this.jwtClient,
            spreadsheetId: this.documentKey,
            valueInputOption: 'RAW',
            range: `${sheetName}!${range}`,
            resource: {
                majorDimension: 'ROWS',
                values: values
            }
        });
    }

    async append(sheetName: string, range: string, values: any[]) {
        await promisify(sheets.spreadsheets.values.append)({
            auth: this.jwtClient,
            spreadsheetId: this.documentKey,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            range: `${sheetName}!${range}`,
            resource: {
                majorDimension: 'ROWS',
                values: values
            }
        });
    }

    async batchUpdate(requests: any[]) {
        await promisify(sheets.spreadsheets.batchUpdate)({
            auth: this.jwtClient,
            spreadsheetId: this.documentKey,
            includeSpreadsheetInResponse: false,
            resource: { requests }
        });
    }

    async resize(sheetName: string, rowCount: number, columnCount: number) {
        await this.batchUpdate([
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": this.sheetId(sheetName),
                        "gridProperties":
                        {
                            "rowCount": rowCount,
                            "columnCount": columnCount
                        }
                    },
                    "fields": "gridProperties"
                }
            }
        ]);
    }

    async columnLetter(sheetName: string, columnName: string): Promise<string> {
        let head = await this.head(sheetName);
        let index = head.indexOf(columnName);
        if (index == -1) {
            throw new Error(`Sheet ${sheetName} is missing column ${columnName}.`);
        }
        return columnToLetter(index + 1);
    }

    endColumnLetter(sheetName: string) {
        let meta = this.getSheetMeta(sheetName);
        return columnToLetter(meta.properties.gridProperties.columnCount);
    }

    rowCount(sheetName: string) {
        let meta = this.getSheetMeta(sheetName);
        return meta.properties.gridProperties.rowCount;
    }

    sheetId(sheetName: string) {
        let meta = this.getSheetMeta(sheetName);
        return meta.properties.sheetId;
    }
}

