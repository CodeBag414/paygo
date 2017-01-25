import * as hooks from './hooks';
import * as logutil from './log-util';

module.exports = {
    id: 'crm-log',
    listen: function() {
        hooks.add('crm_info_changed', async function(options: hooks.InfoChangedOptions) {
            await logutil.logInfoChanges('crm/log', options);
        });
    }
};
