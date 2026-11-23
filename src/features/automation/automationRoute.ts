import type { Section } from './home/AutomationHome';

const SECTIONS: Section[] = ['home', 'workflows', 'agents', 'runs', 'approvals'];

/** Where Automation is, as the address says: `/automation?s=workflows`, `?flow=user:name`, `?flow=new` */
export interface AutomationPlace { section: Section; flow: string | null }

export function readPlace(): AutomationPlace {
    const params = new URL(window.location.href).searchParams;
    const section = params.get('s') as Section | null;
    return { section: section && SECTIONS.includes(section) ? section : 'home', flow: params.get('flow') };
}

/** Puts the place in the address, so a refresh, a copied link and Back return to the same section or workflow */
export function writePlace(place: AutomationPlace, replace = false) {
    if (!window.location.pathname.startsWith('/automation')) return;
    const url = new URL(window.location.href);
    if (place.section === 'home') url.searchParams.delete('s'); else url.searchParams.set('s', place.section);
    if (place.flow) url.searchParams.set('flow', place.flow); else url.searchParams.delete('flow');
    const target = url.pathname + url.search + url.hash;
    if (target === window.location.pathname + window.location.search + window.location.hash) return;
    if (replace) window.history.replaceState(window.history.state, '', target);
    else window.history.pushState(window.history.state, '', target);
}
