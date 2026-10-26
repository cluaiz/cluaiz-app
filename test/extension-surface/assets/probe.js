async function probe() {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const view = document.body.dataset.view;
    let allowed = false;
    let rejected = '';
    try { allowed = await invoke('prototype_main_only') === 'host-only-test-value'; }
    catch (error) { rejected = String(error); }
    await invoke('prototype_report', { report: { view, allowed, rejected,
        width: window.innerWidth, height: window.innerHeight,
        globalTauri: typeof window.__TAURI__, localStorageAvailable: typeof localStorage === 'object' } });
}
void probe().catch(error => console.error('Prototype failed:', error));
