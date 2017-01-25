import * as hooks from './hooks';
import * as logutil from './log-util';

module.exports = {
    id: 'meters-log',
    listen: function() {
        hooks.add('meter_info_changed', async function(options: hooks.InfoChangedOptions) {
            await logutil.logInfoChanges('meters/log', options);
        });
    }
};
