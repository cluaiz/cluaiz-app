import { useSyncExternalStore } from 'react';
import { onToolkitHistory } from './toolkitNavigation';

/** Re-renders on every Toolkit URL change (the URL holds the view state) and returns its query. */
export const useToolkitUrl = () => useSyncExternalStore(onToolkitHistory, () => window.location.search, () => '');
