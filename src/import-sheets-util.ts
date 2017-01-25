import * as config from './config';
import * as firebase from 'firebase';
import * as hooks from './hooks';
import * as bunyan from 'bunyan'; 
import * as moment from 'moment-timezone';

const google = require('googleapis');
const promisify = require('es6-promisify');

const log = bunyan.createLogger({ name: 'import-sheets-util' });

const db = firebase.database();
const sheets = google.sheets('v4');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
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

function objectEquals(a: Object, b: Object) {
    if ((a === null) != (b === null)) {
        return false;
    }
    for (let k in a) {
        if (!(k in b)) {
            return false;
        }
    }
    for (let k in b) {
        if (!(k in a)) {
            return false;
        }
    }
    for (let k in b) {
        if (k in a) {
            if (b[k] !== a[k]) {
                return false;
            }
        }
    }
    return true;
}

interface ImportFromSheetOptions {
    documentName: string,
    sheetName: string,
    mode: string,
    startRowRef?: string,
    uniqueKey?: string,
    mapping?: { [key: string]: string },
    transform?: { [key: string]: Function },
    required?: string[],
    destinationRef: string,
    destinationKey?: string,
    hook: string
};

export async function importFromSheet(options: ImportFromSheetOptions) {
    log.info(`enter importFromSheet ${options.documentName}`);

    if (options.mode != 'push' && options.mode != 'update') {
        throw new Error(`invalid import mode ${options.mode}`);
    }

    let documentKey = config.GOOGLE_SHEET_KEYS[options.documentName];

    let jwtClient = new google.auth.JWT(CREDS.client_email, null, CREDS.private_key, SCOPES, null);

    log.info(`before authorize ${options.documentName}`);
    await promisify(jwtClient.authorize, jwtClient)();
    log.info(`after authorize ${options.documentName}`);

    let documentMeta;
    try {
        log.info(`before get meta ${options.documentName}`);
        documentMeta = await promisify(sheets.spreadsheets.get)({
            auth: jwtClient,
            spreadsheetId: documentKey
        });
        log.info(`after get meta ${options.documentName}`);
    } catch (err) {
        err.message =
            `Sheet ${documentKey} is inaccessible. ` +
            `${err.message} ` +
            `Data import of ${options.sheetName} skipped.`;
        throw err;
    }

    let importedAt = moment().toISOString();
    let importedFromSheet = `${documentMeta.properties.title}/${options.sheetName}`;

    let sheetMeta = null;
    for (let meta of documentMeta.sheets) {
        if (meta.properties.title === options.sheetName) {
            sheetMeta = meta;
        }
    }
    if (!sheetMeta) {
        throw new Error(
            `${importedFromSheet} sheet is missing. ` +
            `Data import canceled, please fix this manually.`);
    }

    let startRow = 2;
    if (options.mode == 'push') {
        log.info(`before get start row ${options.documentName}`);
        startRow = (await db.ref(options.startRowRef).once('value')).val() || startRow;
        log.info(`after get start row ${options.documentName}`);
        if (startRow > 1 + sheetMeta.properties.gridProperties.rowCount) {
            throw new Error(
                `${importedFromSheet} sheet is intended to only ever be added to, but it has fewer rows than the last time it was imported. ` +
                `Data import canceled, please fix this manually.`);
        }
        if (startRow == 1 + sheetMeta.properties.gridProperties.rowCount) {
            return;
        }
    }

    let endColLetter = columnToLetter(sheetMeta.properties.gridProperties.columnCount);

    log.info(`before head get ${options.documentName}`);
    let headResponse = await promisify(sheets.spreadsheets.values.get)({
        auth: jwtClient,
        spreadsheetId: documentKey,
        range: `${options.sheetName}!A1:${endColLetter}`
    });
    log.info(`after head get ${options.documentName}`);
    let head = headResponse.values[0];

    let mapping = options.mapping;
    if (mapping) {
        for (let m in mapping) {
            if (head.indexOf(m) == -1) {
                throw new Error(
                    `${importedFromSheet} sheet is missing column ${m}. ` +
                    `Data import canceled, please fix this manually.`);
            }
        }
        for (let h of head) {
            if (!(h in mapping)) {
                throw new Error(
                    `${importedFromSheet} sheet contains unexpected column ${h}. ` +
                    `Data import canceled, please fix this manually.`);
            }
        }
    } else {
        mapping = {};
        for (let h of head) {
            mapping[h] = h;
        }
    }

    let mappingValues = Object.keys(mapping).map(key => mapping[key]);
    if (options.destinationKey) {
        if (mappingValues.indexOf(options.destinationKey) == -1) {
            throw new Error(
                `${importedFromSheet} sheet is missing column ${options.destinationKey}. ` +
                `Data import stopped, please fix this manually.`);
        }
    }

    let transform = options.transform || {};
    for (let m of mappingValues) {
        if (!(m in transform)) {
            transform[m] = (v, context) => v;
        }
    }
    let transformContext = {
        sheetMeta: sheetMeta
    }

    let validKeys = {};

    log.info(`before values.get ${options.documentName}`);
    let dataResponse = await promisify(sheets.spreadsheets.values.get)({
        auth: jwtClient,
        spreadsheetId: documentKey,
        range: `${options.sheetName}!A${startRow}:${endColLetter}`
    });
    log.info(`after values.get ${options.documentName}`);

    if (!dataResponse.values && options.mode == 'update') {
        throw new Error(
            `${importedFromSheet} sheet is empty, which isn't expected. Aborting the import for safety. ` +
            `Data import stopped, please fix this manually.`);
    }

    if (dataResponse.values) {
        for (let row of dataResponse.values) {

            let info = {
                imported_at: importedAt,
                imported_from_sheet: importedFromSheet,
                imported_from_row: startRow
            };

            for (let c in head) {
                let v = String(row[c] || '').trim();
                let m = mapping[head[c]];

                if (!v && options.required) {
                    if (options.required.indexOf(m) != -1) {
                        throw new Error(
                            `${importedFromSheet} sheet row ${startRow} has no value for the required field ${m}. ` +
                            `Data import stopped, please fix this manually.`);
                    }
                }

                try {
                    if (m) {
                        let t = transform[m];
                        info[m] = t(v, transformContext);
                    }
                } catch (err) {
                    err.message =
                        `${importedFromSheet} sheet row ${startRow} column "${head[c]}": ` +
                        `${err.message} ` +
                        `Data import stopped, please fix this manually.`;
                    throw err;
                }
            }

            if (options.mode == 'push') {

                let ref;
                if (options.destinationKey) {
                    let key = info[options.destinationKey];
                    ref = db.ref(options.destinationRef).child(key);
                } else {
                    ref = db.ref(options.destinationRef);
                }

                let isDuplicate = false;

                if (options.uniqueKey) {
                    let uniqueValue = info[options.uniqueKey];

                    if (!uniqueValue) {
                        throw new Error(
                            `${importedFromSheet} sheet row ${startRow} is missing a value for ${options.uniqueKey}. ` +
                            `Data import stopped, please fix this manually.`);
                    }

                    log.info(`before duplicate check ${options.documentName}`);
                    isDuplicate = (await ref
                        .orderByChild(options.uniqueKey)
                        .equalTo(uniqueValue).once('value')
                    ).val();
                    log.info(`after duplicate check ${options.documentName}`);

                    if (isDuplicate) {
                        throw new Error(
                            `${importedFromSheet} sheet row ${startRow} has duplicate ${options.uniqueKey} value ${uniqueValue}. ` +
                            `Data import stopped, please fix this manually.`);
                    }
                }

                log.info(`before hooks ${options.documentName}`);
                try {
                    await hooks.execute(options.hook, {
                        value: info
                    });
                } catch (err) {
                    err.message =
                        `${importedFromSheet} sheet row ${startRow} failed post-processing: ` +
                        `${err.message} ` +
                        `Data import stopped, please fix this manually.`;
                    throw err;
                }
                log.info(`after hooks ${options.documentName}`);

                log.info(`before push ${options.documentName}`);
                await ref.push(info);
                log.info(`after push ${options.documentName}`);

                startRow += 1;
                log.info(`before startrow ${options.documentName}`);
                await db.ref(options.startRowRef).set(startRow);
                log.info(`after startrow ${options.documentName}`);

            } else {

                if (!options.destinationKey) {
                    throw new Error('destination key is required');
                }

                let key = info[options.destinationKey];
                let ref = db.ref(options.destinationRef).child(key);

                validKeys[key] = true;

                log.info(`before old ${options.documentName}`);
                let old = (await ref.once('value')).val();
                log.info(`after old ${options.documentName}`);

                if (!objectEquals(old, info)) {
                    try {
                        if (old) {
                            log.info(`before hooks ${options.documentName}`);
                            await hooks.execute(options.hook, {
                                old: old,
                                new: info,
                                ref: options.destinationRef,
                                key: key
                            });
                            log.info(`after hooks ${options.documentName}`);
                        }
                    } catch (err) {
                        err.message =
                            `${importedFromSheet} sheet row ${startRow} failed post-processing: ` +
                            `${err.message} ` +
                            `Data import stopped, please fix this manually.`;
                        throw err;
                    }

                    log.info(`before set ${options.documentName}`);
                    await ref.set(info);
                    log.info(`after set ${options.documentName}`);
                }

                startRow += 1;

            }
        }
    }

    if (options.mode == 'update') {
        log.info(`before existing data check ${options.documentName}`);

        let existingData = (await db.ref(options.destinationRef).once('value')).val();
        for (let key in existingData) {
            if (!(key in validKeys)) {
                console.log(
                    `Deleting ${options.destinationRef}/${key} because it is no longer present in the imported sheet ` +
                    `${importedFromSheet}.`
                );
                await db.ref(options.destinationRef).child(key).remove();
            }
        }

        log.info(`after existing data check ${options.documentName}`);
    }

    log.info(`leave importFromSheet ${options.documentName}`);
}

export function transformDate(value: string, context: any) {
    let format = "YYYY-M-D H:m:s";
    let timeZone = context.sheetMeta.properties.timeZone;
    let timestamp = moment.tz(value, format, timeZone);
    if (!timestamp.isValid()) {
        throw new Error(`Invalid timestamp "${value}."`);
    }
    if (timestamp.diff(moment.now()) > 0) {
        throw new Error(`Invalid timestamp "${value}, when parsed as ${format} in ${timeZone} it appears to be in the future."`);
    }
    return timestamp.toISOString();
}

export function transformNumber(value: string, context: any) {
    let n = Number.parseFloat(value);
    if (Number.isNaN(n)) {
        throw new Error(`Invalid number "${value}."`);
    }
    return n;
}
