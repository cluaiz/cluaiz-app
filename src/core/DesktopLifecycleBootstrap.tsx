import { useEffect } from 'react';
import { desktopLifecycle } from './desktopLifecycle';
import { toast } from '../components/ui/toast';

/** Native stays close-normally until this existing preference synchronizes. */
export function DesktopLifecycleBootstrap() {
    useEffect(() => {
        void desktopLifecycle.initialize().catch(error => { toast.error('Background mode was not applied: ' + String(error)); });
    }, []);
    return null;
}
