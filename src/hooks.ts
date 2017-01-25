let hooks = {
    crm_info_changed: [],
    cylinder_info_changed: [],
    meter_info_changed: [],
    crm_trx_added: [],
    cylinder_trx_added: [],
    meter_trx_added: [],
    meter_feed_added: [],
    payment_added: [],
};

export interface InfoChangedOptions {
    old: any;
    new: any;
    ref: string;
    key: string;
};

export function add(key: string, f: Function) {
    if (!(key in hooks)) {
        throw new Error(`tried to add unknown hook ${key}`);
    }

    hooks[key].push(f);
}

export async function execute(key: string, options: Object) {
    if (!(key in hooks)) {
        throw new Error(`tried to execute unknown hook ${key}`);
    }

    for (let h of hooks[key]) {
        await h(options);
    }
}
