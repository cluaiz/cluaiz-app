import type { ArchitectureView } from './architectureGraph';

export interface Viewport { x: number; y: number; scale: number }
export interface GraphBox { x: number; y: number; width: number; height: number }
export const MIN_SCALE = 0.2, MAX_SCALE = 2.5;
export const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** Wheel units are normalized before scaling; zero movement never changes the viewport. */
export function wheelFactor(delta: number, mode: number, pageHeight: number): number {
    if (!Number.isFinite(delta) || delta === 0) return 1;
    const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
    return Math.exp(-Math.max(-160, Math.min(160, pixels)) * 0.002);
}
export function zoomViewport(view: Viewport, factor: number, x: number, y: number): Viewport {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return view;
    const scale = clampScale(view.scale * factor), ratio = scale / view.scale;
    return { scale, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio };
}
export function fitViewport(box: GraphBox, width: number, height: number, readable = false): Viewport {
    const fitted = Math.min((width - 72) / box.width, (height - 100) / box.height, 1);
    const scale = clampScale(readable ? Math.max(0.85, fitted) : fitted);
    return { scale, x: width / 2 - (box.x + box.width / 2) * scale,
        y: height / 2 - (box.y + box.height / 2) * scale };
}

/** Columns contain only the visible branch. Detail blocks have bounded scrolling, not tiny global-fit text. */
export function architectureLayout(view: ArchitectureView) {
    const columns = new Map<number, typeof view.items>();
    for (const item of view.items) columns.set(item.column, [...(columns.get(item.column) || []), item]);
    const positions = new Map<string, GraphBox>();
    const heights = new Map([...columns].map(([column, items]) => [column,
        items.reduce((sum, item) => sum + (item.kind === 'detail' ? 278 : 118) + 50, 0) - 50]));
    const height = Math.max(300, ...heights.values());
    for (const [column, items] of columns) {
        let y = (view.path.length ? 0 : (height - (heights.get(column) || 0)) / 2) + 36;
        for (const item of items) {
            const box = { x: column * 380 + 32, y, width: item.kind === 'detail' ? 340 : 280, height: item.kind === 'detail' ? 278 : 118 };
            positions.set(item.id, box); y += box.height + 50;
        }
    }
    const boxes = [...positions.values()];
    const bounds = { x: 0, y: 0, width: Math.max(320, ...boxes.map(box => box.x + box.width + 32)), height: height + 72 };
    const focus = positions.get(view.focusId || '');
    // Frame the newly opened children at readable size; the overview remains reachable through Back/Fit.
    const lastColumn = Math.max(0, ...columns.keys());
    const firstChild = view.items.find(item => item.column === lastColumn);
    const child = positions.get(firstChild?.id || '');
    const frame = focus && child ? { x: Math.min(focus.x, child.x), y: Math.min(focus.y, child.y),
        width: Math.max(focus.x + focus.width, child.x + child.width) - Math.min(focus.x, child.x),
        height: Math.max(focus.height, child.height) } : bounds;
    return { positions, bounds, frame };
}

export function architectureEdgePath(a: GraphBox, b: GraphBox): string {
    const right = b.x > a.x, same = a.x === b.x;
    const sx = same ? a.x + a.width / 2 : right ? a.x + a.width : a.x;
    const sy = same ? a.y + a.height : a.y + a.height / 2;
    const tx = same ? b.x + b.width / 2 : right ? b.x : b.x + b.width;
    const ty = same ? b.y : b.y + b.height / 2;
    return same ? `M${sx},${sy} C${sx + 48},${sy} ${tx + 48},${ty} ${tx},${ty}`
        : `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
}
