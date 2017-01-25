import * as hooks from './hooks';
import * as logutil from './log-util';

module.exports = {
    id: 'cylinders-log',
    listen: function() {
        hooks.add('cylinder_info_changed', async function(options: hooks.InfoChangedOptions) {
            await logutil.logInfoChanges('cylinders/log', options);
        });
    }
};
