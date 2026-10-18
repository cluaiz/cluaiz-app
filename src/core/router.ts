/**
 * Cluaiz App Client-Side Router & URL Synchronization
 * 
 * Synchronizes app views and settings tabs with browser URL, providing:
 * 1. Deep linking to specific settings tabs (e.g. /settings?tab=notifications)
 * 2. State restoration on browser refresh (F5)
 * 3. History navigation (browser back & forward buttons)
 */
import { useLayoutStore } from '../store/ui/useLayoutStore';

export type SettingsTabId =
    | 'general'
    | 'chats'
    | 'engine'
    | 'inference'
    | 'vector'
    | 'security'
    | 'theme'
    | 'notifications'
    | 'shortcuts'
    | 'help';

export const VALID_SETTINGS_TABS: SettingsTabId[] = [
    'general',
    'chats',
    'engine',
    'inference',
    'vector',
    'security',
    'theme',
    'notifications',
    'shortcuts',
    'help'
];

export type MainViewId = 'chat' | 'notebook' | 'settings' | 'dashboard' | 'tools' | 'apis' | 'toolkit';

export interface RouteState {
    view: MainViewId;
    isSettingsOpen: boolean;
    settingsTab: SettingsTabId;
    activeChatId?: string | null;
}

function extractTabFromPath(pathname: string): string | null {
    const parts = pathname.split('/').filter(Boolean);
    if ((parts[0] === 'settings' || parts[0] === 'setting') && parts[1]) {
        return parts[1];
    }
    return null;
}

function extractTabFromHash(hash: string): string | null {
    if (!hash.startsWith('#')) return null;
    const cleanHash = hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = cleanHash.split('?');
    if (queryPart) {
        const params = new URLSearchParams(queryPart);
        if (params.has('tab')) return params.get('tab');
    }
    const parts = pathPart.split('/').filter(Boolean);
    if ((parts[0] === 'settings' || parts[0] === 'setting') && parts[1]) {
        return parts[1];
    }
    return null;
}

/**
 * Parses the current browser URL (path, query, and hash) into RouteState.
 */
export function parseCurrentRoute(): RouteState {
    const pathname = window.location.pathname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();

    // Check if URL represents Settings
    const isSettingsPath =
        pathname === '/settings' ||
        pathname === '/setting' ||
        pathname.startsWith('/settings/') ||
        pathname.startsWith('/setting/') ||
        hash.startsWith('#/settings') ||
        hash.startsWith('#/setting') ||
        searchParams.has('tab');

    const rawTab = searchParams.get('tab') || extractTabFromPath(pathname) || extractTabFromHash(hash);

    // Redirect legacy settings tools tab to standalone /tools page
    if (rawTab === 'tools' || pathname === '/settings/tools') {
        return {
            view: 'tools',
            isSettingsOpen: false,
            settingsTab: 'general',
        };
    }

    let settingsTab: SettingsTabId = 'general';
    if (rawTab && VALID_SETTINGS_TABS.includes(rawTab as SettingsTabId)) {
        settingsTab = rawTab as SettingsTabId;
    }

    // Determine base active view
    let view: MainViewId = 'chat';
    if (pathname.includes('/notebook') || hash.includes('/notebook')) {
        view = 'notebook';
    } else if (pathname.includes('/dashboard') || hash.includes('/dashboard')) {
        view = 'dashboard';
    } else if (pathname.includes('/tools')) {
        view = 'tools';
    } else if (pathname.includes('/apis')) {
        view = 'apis';
    } else if (pathname.includes('/toolkit')) {
        view = 'toolkit';
    }

    const activeChatId = searchParams.get('c') || null;

    return {
        view,
        isSettingsOpen: isSettingsPath,
        settingsTab,
        activeChatId,
    };
}

/**
 * Updates URL to reflect active chat ID (?c=chat_YYYYMMDD_...) without reloading.
 */
export function pushChatRoute(chatId: string | null, replace: boolean = false): void {
    if (typeof window === 'undefined') return;
    try {
        const url = new URL(window.location.href);
        if (chatId) {
            url.searchParams.set('c', chatId);
        } else {
            url.searchParams.delete('c');
        }
        const targetUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        if (targetUrl === currentUrl) return;

        if (replace) {
            window.history.replaceState({ activeChatId: chatId }, '', targetUrl);
        } else {
            window.history.pushState({ activeChatId: chatId }, '', targetUrl);
        }
    } catch {}
}

/**
 * Updates URL to reflect active settings tab without reloading.
 */
export function pushSettingsRoute(tab: SettingsTabId, replace: boolean = false): void {
    const targetUrl = `/settings?tab=${tab}`;
    const currentTab = new URLSearchParams(window.location.search).get('tab');
    const isCurrentSettings = window.location.pathname === '/settings' || window.location.pathname === '/setting';

    if (isCurrentSettings && currentTab === tab) {
        return;
    }

    if (replace) {
        window.history.replaceState({ isSettings: true, tab }, '', targetUrl);
    } else {
        window.history.pushState({ isSettings: true, tab }, '', targetUrl);
    }
}

/**
 * Reverts URL to the underlying active view when Settings is closed.
 */
export function pushViewRoute(view: MainViewId, replace: boolean = false): void {
    const targetUrl = view === 'chat' ? '/' : `/${view}`;
    const currentPath = window.location.pathname;

    if (currentPath === targetUrl && !window.location.search) {
        return;
    }

    if (replace) {
        window.history.replaceState({ isSettings: false, view }, '', targetUrl);
    } else {
        window.history.pushState({ isSettings: false, view }, '', targetUrl);
    }
}

/**
 * Programmatically triggers navigation to settings tab or app view.
 */
export function navigateTo(target: { view?: MainViewId; isSettingsOpen?: boolean; settingsTab?: SettingsTabId }): void {
    if (target.view) {
        useLayoutStore.getState().setActiveView(target.view);
        pushViewRoute(target.view);
    }
    if (target.isSettingsOpen) {
        document.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: target.settingsTab || 'general' } }));
    }
}

/**
 * Updates URL for /apis with active endpoint, method, and tab.
 */
export function pushApiRoute(
    endpointPath: string,
    method?: string,
    tab?: string,
    replace: boolean = false
): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (endpointPath) {
        params.set('endpoint', endpointPath);
    }
    if (method) {
        params.set('method', method.toUpperCase());
    }
    if (tab && tab !== 'params') {
        params.set('tab', tab);
    }

    const queryString = params.toString();
    const targetUrl = queryString ? `/apis?${queryString}` : '/apis';
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl === targetUrl) {
        return;
    }

    if (replace) {
        window.history.replaceState({ isApi: true, endpoint: endpointPath, method, tab }, '', targetUrl);
    } else {
        window.history.pushState({ isApi: true, endpoint: endpointPath, method, tab }, '', targetUrl);
    }
}

