import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../src/core/ThemeProvider';
import { useThemeStore } from '../../src/store/ui/useThemeStore';
import { THEMES } from '../../src/config/themes';
import { COMPONENT_GROUPS } from '../../src/components/showcase/catalog';
import { componentAvailability, SDK_REFERENCES } from '../../src/components/showcase/reference';
import '../../src/styles/index.css';

const report = new URL(location.href).searchParams.get('report');
if (!report || !/^http:\/\/127\.0\.0\.1:\d+$/.test(report)) throw Error('Owned report URL required.');
const actualFetch = window.fetch.bind(window);
const blocked: string[] = [];
window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (![location.origin, report].includes(url.origin)) { blocked.push(url.pathname); return Promise.reject(Error('No Engine or external network in the gallery test.')); }
    return actualFetch(input, init);
};
const root = createRoot(document.getElementById('root')!);
const checks: string[] = [];
const pause = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); checks.push(message); }
async function wait(read: () => unknown) {
    const deadline = Date.now() + 15000;
    while (!read()) { if (Date.now() > deadline) throw Error('UI condition timed out.'); await pause(); }
}
function button(text: string, scope: ParentNode = document) {
    const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(value => value.textContent?.trim() === text);
    if (!found) throw Error('Button unavailable: ' + text); return found;
}
async function run() {
    const { ComponentShowcase } = await import('../../src/components/ComponentShowcase');
    root.render(<ThemeProvider><ComponentShowcase /></ThemeProvider>);
    await wait(() => document.querySelector('h1'));
    for (const item of COMPONENT_GROUPS.flatMap(group => group.items)) {
        const target = [...document.querySelectorAll<HTMLButtonElement>('aside button')].find(value => value.textContent?.replace(/\s+/g, ' ').trim().startsWith(item.label));
        if (!target) throw Error('Gallery entry missing: ' + item.id);
        target.click(); await pause();
        assert(document.querySelector('h1')?.textContent?.trim() === item.label, 'gallery selection ' + item.id);
        assert(document.querySelector('[aria-label="Component reference"]')?.textContent?.includes(componentAvailability(item.id).label), 'availability ' + item.id);
    }
    const select = async (label: string) => {
        const target = [...document.querySelectorAll<HTMLButtonElement>('aside button')].find(value => value.textContent?.includes(label));
        if (!target) throw Error('Missing entry ' + label); target.click(); await pause();
    };
    await select('CustomDropdown');
    button('Rust Native Engine').click(); await pause();
    button('Cross-Vendor Vulkan').click(); await pause();
    assert(Boolean([...document.querySelectorAll('button')].find(value => value.textContent?.trim() === 'Cross-Vendor Vulkan')), 'shared dropdown changes its value');
    await select('Button');
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    try {
        let copied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
        button('Copy example').click(); await pause();
        assert(copied === SDK_REFERENCES.button?.example, 'copy action receives the displayed SDK example');
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied test boundary'); } } });
        button('Copied example').click(); await pause();
        assert(document.querySelector('[role="alert"]')?.textContent?.includes('Clipboard access is unavailable'), 'denied clipboard shows manual-copy guidance');
    } finally { if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard'); }
    const { ExtensionPreview } = await import('../../packages/extension-devkit/src/preview');
    root.render(<ExtensionPreview><p>Independent preview</p></ExtensionPreview>); await pause();
    const current = useThemeStore.getState().theme;
    const alternate = Object.entries(THEMES).find(([id]) => id !== current)!;
    button(THEMES[current].name).click(); await pause(); button(alternate[1].name).click(); await pause();
    assert(useThemeStore.getState().theme === alternate[0] && !document.querySelector('select'), 'preview uses shared dropdown and existing theme store');
    const { ToolkitWorkspace } = await import('../../src/features/extensions/ToolkitWorkspace');
    history.replaceState(null, '', '/toolkit?section=extensions');
    root.render(<ThemeProvider><ToolkitWorkspace /></ThemeProvider>); await pause();
    assert(document.querySelector('h1')?.textContent === 'Toolkit' && document.body.textContent?.includes('Notebook'), 'Toolkit displays actual bundled registry');
    button('UI components & SDK').click(); await pause();
    assert(location.search.includes('section=components') && Boolean(document.querySelector('[aria-label="Component reference"]')), 'Toolkit reuses the same gallery and retains its section URL');
    root.render(<main><h1>Toolkit / component reference: passed</h1><p>30 gallery entries, SDK references, dropdown, preview theme, copy failure and Toolkit checked.</p></main>);
    await actualFetch(report + '/result', { method: 'POST', body: JSON.stringify({ passed: true, checks, blockedExternalRequests: blocked,
        scope: 'Actual browser UI; clipboard provider controlled; no inference, downloaded installer or native OS acceptance claimed.' }) });
}
void run().catch(async error => {
    root.render(<p role="alert">{String(error)}</p>);
    await actualFetch(report + '/result', { method: 'POST', body: JSON.stringify({ passed: false, checks, error: String(error) }) });
});
