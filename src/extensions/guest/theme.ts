import { ExtensionError } from './contract';

export interface GuestTheme {
    readonly variables: Readonly<Record<string, string>>;
    readonly classes: readonly string[];
}
export interface GuestThemeSource {
    current(): GuestTheme;
    subscribe(listener: () => void): () => void;
}
const MAX_THEME_VARIABLES = 128;
const MAX_THEME_CLASSES = 16;
const MAX_THEME_VALUE = 2048;
const variableName = /^--[a-z][a-z0-9-]{0,79}$/;
const themeClass = /^theme-[a-z][a-z0-9-]{0,79}$/;

export function validateGuestTheme(value: unknown): GuestTheme {
    const input = value as GuestTheme | null;
    if (!input || typeof input !== 'object' || !input.variables || typeof input.variables !== 'object'
        || Array.isArray(input.variables) || !Array.isArray(input.classes)
        || input.classes.length > MAX_THEME_CLASSES || new Set(input.classes).size !== input.classes.length
        || input.classes.some(name => typeof name !== 'string' || !themeClass.test(name))) throw new ExtensionError('PROTOCOL');
    const entries = Object.entries(input.variables);
    if (entries.length > MAX_THEME_VARIABLES || entries.some(([key, item]) =>
        !variableName.test(key) || typeof item !== 'string' || item.length > MAX_THEME_VALUE)) throw new ExtensionError('PROTOCOL');
    return Object.freeze({ variables: Object.freeze(Object.fromEntries(entries)), classes: Object.freeze([...input.classes]) });
}

/** Read existing ThemeProvider inline variables; never copy or recalculate its palettes. */
export function documentThemeSource(root: HTMLElement): GuestThemeSource {
    const view = root.ownerDocument.defaultView;
    if (!view) throw new Error('Theme document has no view.');
    return Object.freeze({
        current() {
            const computed = view.getComputedStyle(root);
            const variables = Object.fromEntries(Array.from(root.style).filter(key => variableName.test(key))
                .map(key => [key, computed.getPropertyValue(key).trim()]));
            return validateGuestTheme({ variables, classes: Array.from(root.classList).filter(name => themeClass.test(name)) });
        },
        subscribe(listener: () => void) {
            const observer = new view.MutationObserver(listener);
            observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
            return () => observer.disconnect();
        },
    });
}

/** Apply host-owned semantic properties to this document only; restore prior values on cleanup. */
export function bindExtensionTheme(source: { current(): GuestTheme | null; subscribe(listener: (value: GuestTheme) => void): () => void },
    root: HTMLElement): () => void {
    const prior = new Map<string, { value: string; priority: string }>();
    const originalClasses = Array.from(root.classList).filter(name => themeClass.test(name));
    let applied = new Set<string>();
    let closed = false;
    const restore = (name: string) => {
        const previous = prior.get(name)!;
        if (previous.value) root.style.setProperty(name, previous.value, previous.priority);
        else root.style.removeProperty(name);
    };
    function update(raw: GuestTheme) {
        if (closed) return;
        const theme = validateGuestTheme(raw);
        for (const name of applied) if (!(name in theme.variables)) restore(name);
        applied = new Set(Object.keys(theme.variables));
        for (const [name, value] of Object.entries(theme.variables)) {
            if (!prior.has(name)) prior.set(name, { value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name) });
            root.style.setProperty(name, value);
        }
        for (const name of Array.from(root.classList)) if (themeClass.test(name)) root.classList.remove(name);
        root.classList.add(...theme.classes);
    }
    const unsubscribe = source.subscribe(update);
    const initial = source.current();
    try { if (initial) update(initial); } catch (error) { unsubscribe(); throw error; }
    return () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        for (const name of applied) restore(name);
        for (const name of Array.from(root.classList)) if (themeClass.test(name)) root.classList.remove(name);
        root.classList.add(...originalClasses);
    };
}
