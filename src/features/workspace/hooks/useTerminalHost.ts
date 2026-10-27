import { useEffect, useState } from 'react';
import { systemApi } from '../../../api/engine/system/system.api';
import { fsApi } from '../../../api/engine/fs/fs.api';
import { errorMessage } from '../../../api/client/errors';
import { isTerminalPath } from './terminalPaths';

/** The Engine host, which can differ from the browser's OS and stored local paths. */
export function useTerminalHost(open: boolean, connection: string, rootPath?: string) {
    const scope = JSON.stringify([open, connection, rootPath]);
    const [state, setState] = useState({ scope: '', ready: false, windows: false, workspace: '', error: '' });
    useEffect(() => {
        let ignore = false;
        if (!open) return;
        Promise.all([systemApi.getSystemInfo(), rootPath ? Promise.resolve(rootPath) : fsApi.getWorkspace().then(result => result.workspace)])
            .then(([info, workspace]) => {
                if (ignore) return;
                const os = info.hardware.os_name;
                if (typeof os !== 'string' || !os || !isTerminalPath(workspace)) throw Error('Engine OS/workspace metadata is unavailable');
                setState({ scope, ready: true, windows: /windows/i.test(os), workspace, error: '' });
            }).catch(error => { if (!ignore) setState({ scope, ready: false, windows: false, workspace: '', error: errorMessage(error) }); });
        return () => { ignore = true; };
    }, [scope]);
    return state.scope === scope ? state : { scope, ready: false, windows: false, workspace: '', error: '' };
}
