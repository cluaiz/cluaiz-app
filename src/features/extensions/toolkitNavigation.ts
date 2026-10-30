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
