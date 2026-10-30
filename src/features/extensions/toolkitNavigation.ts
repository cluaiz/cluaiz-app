export const TOOLKIT_SECTIONS = [
    { id: 'landing', label: 'Hub Overview' },
    { id: 'models', label: 'AI Models' },
    { id: 'tools', label: 'Tools & Capabilities' },
    { id: 'extensions', label: 'Extensions' },
    { id: 'components', label: 'UI Components & SDK' },
] as const;

export type ToolkitSectionId = typeof TOOLKIT_SECTIONS[number]['id'];

export function toolkitSection(search: string): ToolkitSectionId {
    const value = new URLSearchParams(search).get('section');
    return TOOLKIT_SECTIONS.find(item => item.id === value)?.id ?? 'landing';
}

export function toolkitSectionUrl(section: ToolkitSectionId, baseHref: string = 'http://localhost/toolkit'): string {
    const url = new URL(baseHref);
    url.pathname = '/toolkit';
    url.hash = '';
    if (section === 'landing') {
        url.searchParams.delete('section');
    } else {
        url.searchParams.set('section', section);
    }
    return url.pathname + (url.search ? url.search : '');
}
