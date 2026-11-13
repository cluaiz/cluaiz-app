export const TOOLKIT_SECTIONS = [
    { id: 'models', label: 'AI Models' },
    { id: 'mcp', label: 'MCP Servers' },
    { id: 'skills', label: 'Agent Skills' },
    { id: 'plugins', label: 'Plugins & Tools' },
    { id: 'extensions', label: 'App Extensions' },
    { id: 'components', label: 'UI SDK & Showroom' },
] as const;

export type ToolkitSectionId = typeof TOOLKIT_SECTIONS[number]['id'];

export function toolkitSection(search: string): ToolkitSectionId {
    const value = new URLSearchParams(search).get('section');
    return TOOLKIT_SECTIONS.find(item => item.id === value)?.id ?? 'models';
}

export function toolkitSectionUrl(section: ToolkitSectionId, baseHref: string = 'http://localhost/toolkit'): string {
    const url = new URL(baseHref);
    url.pathname = '/toolkit';
    url.hash = '';
    url.searchParams.set('section', section);
    return url.pathname + (url.search ? url.search : '');
}

/** One Toolkit query parameter, or '' (the URL is the source of the Toolkit's view state) */
export function toolkitParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name) ?? '';
}

/** Changes Toolkit query parameters as one history entry; an empty value removes the parameter. */
export function setToolkitParams(params: Record<string, string | null | undefined>) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(params)) {
        if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
    }
    if (url.href === window.location.href) return;
    window.history.pushState(window.history.state, '', url);
    window.dispatchEvent(new Event(TOOLKIT_URL_EVENT));
}

const TOOLKIT_URL_EVENT = 'cluaiz:toolkit-url';

/** Runs `sync` whenever the Toolkit URL changes: back, forward, or a change made by `setToolkitParams`. Returns the unsubscribe. */
export function onToolkitHistory(sync: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('popstate', sync);
    window.addEventListener(TOOLKIT_URL_EVENT, sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(TOOLKIT_URL_EVENT, sync); };
}
