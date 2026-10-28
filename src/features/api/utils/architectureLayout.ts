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

/** Keyboard access exposes an off-screen box with minimal translation, never a zoom reset. */
export function revealViewport(view: Viewport, box: GraphBox, width: number, height: number, top = 72): Viewport {
    const left = box.x * view.scale + view.x, right = left + box.width * view.scale;
    const y = box.y * view.scale + view.y, bottom = y + box.height * view.scale;
    const dx = left < 24 ? 24 - left : right > width - 24 ? width - 24 - right : 0;
    const dy = y < top ? top - y : bottom > height - 24 ? height - 24 - bottom : 0;
    return dx || dy ? { ...view, x: view.x + dx, y: view.y + dy } : view;
}

/** Root anchors are fixed; revealed children append in canonical reveal order without moving older boxes. */
export function architectureLayout(view: ArchitectureView, processHeights: Record<string, number> = {}) {
    const reserved = view.placementItems || view.items;
    const roots = reserved.filter(item => !item.parentId);
    const columns = new Map<number, typeof view.items>();
    for (const item of roots) columns.set(item.column, [...(columns.get(item.column) || []), item]);
    const nodeHeight = (item: typeof view.items[number]) => item.kind === 'detail' ? processHeights[item.id] || 520 : 118;
    const nodeWidth = (item: typeof view.items[number]) => item.kind === 'detail' ? 560 : 280;
    const pitch = Math.max(280, ...roots.map(nodeWidth)) + 100;
    const heights = new Map([...columns].map(([column, items]) => [column,
        items.reduce((sum, item) => sum + nodeHeight(item) + 50, 0) - 50]));
    const height = Math.max(300, ...heights.values());
    const positions = new Map<string, GraphBox>();
    for (const [column, items] of columns) {
        let y = (height - (heights.get(column) || 0)) / 2 + 36;
        for (const item of items) {
            const box = { x: column * pitch + 32, y, width: nodeWidth(item), height: nodeHeight(item) };
            positions.set(item.id, box); y += box.height + 50;
        }
    }
    // Navigation anchors never depend on a diagram's asynchronously rendered height.
    const ordered = [...reserved.filter(item => item.kind !== 'detail'), ...reserved.filter(item => item.kind === 'detail')];
    for (const item of ordered) {
        if (!item.parentId) continue;
        const parent = positions.get(item.parentId);
        if (!parent) continue; // Invalid external catalog relationships do not invent an anchor.
        const navigationRight = item.kind === 'detail' ? Math.max(...reserved.filter(node => node.kind !== 'detail').map(node => {
            const placed = positions.get(node.id); return placed ? placed.x + placed.width : 0;
        })) : parent.x + parent.width;
        const box = { x: navigationRight + 100, y: parent.y,
            width: nodeWidth(item), height: nodeHeight(item) };
        const occupied = [...positions.values()];
        // Every collision moves downward past an existing box; at most one pass per occupied box.
        for (let attempt = 0; attempt <= occupied.length; attempt++) {
            const collision = occupied.find(other => box.x < other.x + other.width + 32 && box.x + box.width + 32 > other.x
                && box.y < other.y + other.height + 50 && box.y + box.height + 50 > other.y);
            if (!collision) break;
            box.y = collision.y + collision.height + 50;
        }
        positions.set(item.id, box);
    }
    const boxes = view.items.map(item => positions.get(item.id)).filter((box): box is GraphBox => Boolean(box));
    const bounds = { x: 0, y: 0, width: Math.max(320, ...boxes.map(box => box.x + box.width + 32)),
        height: Math.max(height + 72, ...boxes.map(box => box.y + box.height + 36)) };
    const selected = positions.get(view.focusId || '');
    const children = view.items.filter(item => item.parentId === view.focusId).map(item => positions.get(item.id)).filter((box): box is GraphBox => Boolean(box));
    const first = children[0];
    const frame = selected && first ? { x: Math.min(selected.x, first.x), y: Math.min(selected.y, first.y),
        width: Math.max(selected.x + selected.width, first.x + first.width) - Math.min(selected.x, first.x),
        height: Math.max(selected.y + selected.height, first.y + first.height) - Math.min(selected.y, first.y) } : selected || bounds;
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
