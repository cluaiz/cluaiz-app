import type { ActiveEngineLoad } from '../../../store/engine/useSystemEventsStore';

export function chatLoadLabel(fallback: string, model: string | undefined, load: ActiveEngineLoad | null): string {
    if (!model || load?.model !== model || load.status !== 'loading') return fallback;
    const percent = load.percent === undefined ? '' : `${load.percent}%`;
    return percent && !load.message.includes(percent) ? `${load.message} · ${percent}` : load.message;
}
