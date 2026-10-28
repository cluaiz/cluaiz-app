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
    const dx = left < 24 || box.width * view.scale > width - 48 ? 24 - left : right > width - 24 ? width - 24 - right : 0;
    const dy = y < top || box.height * view.scale > height - top - 24 ? top - y : bottom > height - 24 ? height - 24 - bottom : 0;
    return dx || dy ? { ...view, x: view.x + dx, y: view.y + dy } : view;
}

/** Search obstacle boundaries near the parent; never push a branch in only one direction. */
export function nearestFreeBox(parent: GraphBox, size: { width: number; height: number }, occupied: GraphBox[]): GraphBox {
    const gap = 40, seen = new Set<string>(), queue: GraphBox[] = [];
    const enqueue = (x: number, y: number) => {
        const key = x + ':' + y;
        if (!seen.has(key)) { seen.add(key); queue.push({ x, y, ...size }); }
    };
    const score = (box: GraphBox) => {
        const dx = Math.max(parent.x - box.x - box.width, box.x - parent.x - parent.width, 0);
        const dy = Math.max(parent.y - box.y - box.height, box.y - parent.y - parent.height, 0);
        return dx * dx + dy * dy + 0.01 * (Math.pow(box.x + box.width / 2 - parent.x - parent.width / 2, 2)
            + Math.pow(box.y + box.height / 2 - parent.y - parent.height / 2, 2));
    };
    enqueue(parent.x + parent.width + gap, parent.y + (parent.height - size.height) / 2);
    enqueue(parent.x - size.width - gap, parent.y + (parent.height - size.height) / 2);
    enqueue(parent.x + (parent.width - size.width) / 2, parent.y - size.height - gap);
    enqueue(parent.x + (parent.width - size.width) / 2, parent.y + parent.height + gap);
    while (queue.length) {
        queue.sort((a, b) => score(a) - score(b));
        const box = queue.shift()!;
        const collision = occupied.find(other => box.x < other.x + other.width + gap && box.x + box.width + gap > other.x
            && box.y < other.y + other.height + gap && box.y + box.height + gap > other.y);
        if (!collision) return box;
        enqueue(collision.x + collision.width + gap, box.y);
        enqueue(collision.x - size.width - gap, box.y);
        enqueue(box.x, collision.y + collision.height + gap);
        enqueue(box.x, collision.y - size.height - gap);
    }
    throw new Error('No graph placement found');
}

/** Root anchors and reveal order are stable; only the active process occupies layout space. */
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
    const ordered = [...reserved.filter(item => item.kind !== 'detail'), ...view.items.filter(item => item.kind === 'detail')];
    for (const item of ordered) {
        if (!item.parentId) continue;
        const parent = positions.get(item.parentId);
        if (!parent) continue; // Invalid external catalog relationships do not invent an anchor.
        const box = nearestFreeBox(parent, { width: nodeWidth(item), height: nodeHeight(item) }, [...positions.values()]);
        positions.set(item.id, box);
    }
    const boxes = view.items.map(item => positions.get(item.id)).filter((box): box is GraphBox => Boolean(box));
    const x = Math.min(0, ...boxes.map(box => box.x - 32)), y = Math.min(0, ...boxes.map(box => box.y - 36));
    const bounds = { x, y, width: Math.max(320, ...boxes.map(box => box.x + box.width + 32)) - x,
        height: Math.max(height + 72, ...boxes.map(box => box.y + box.height + 36)) - y };
    const selected = positions.get(view.focusId || '');
    const children = view.items.filter(item => item.parentId === view.focusId).map(item => positions.get(item.id)).filter((box): box is GraphBox => Boolean(box));
    const first = children[0];
    const frame = selected && first ? { x: Math.min(selected.x, first.x), y: Math.min(selected.y, first.y),
        width: Math.max(selected.x + selected.width, first.x + first.width) - Math.min(selected.x, first.x),
        height: Math.max(selected.y + selected.height, first.y + first.height) - Math.min(selected.y, first.y) } : selected || bounds;
    return { positions, bounds, frame };
}
export function architectureEdgePath(a: GraphBox, b: GraphBox): string {
    const vertical = b.x < a.x + a.width && b.x + b.width > a.x, right = b.x > a.x, down = b.y > a.y;
    const sx = vertical ? a.x + a.width / 2 : right ? a.x + a.width : a.x;
    const sy = vertical ? down ? a.y + a.height : a.y : a.y + a.height / 2;
    const tx = vertical ? b.x + b.width / 2 : right ? b.x : b.x + b.width;
    const ty = vertical ? down ? b.y : b.y + b.height : b.y + b.height / 2;
    return vertical ? `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`
        : `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
}
