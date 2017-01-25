import * as request from 'request-promise-native';
import * as config from './config';

export interface AlertOptions {
    message: string;
}

export async function alert(options: AlertOptions) {
    var payload = {
        "reason": options.message,
        "level": 0,
        "paygo_id": '',
        "name": ''
    };

    await request(
        config.ZAPIER_HOOK_URL,
        {
            method: 'post',
            body: JSON.stringify(payload)
        });

    console.log(`ALERT: ${options.message}`);
}
