import { useState } from 'react';
import { ChevronRight, Folder, FolderOpen, Inbox, Layers } from 'lucide-react';
import type { FolderNode } from './flowFolders';

/** `null` shows every workflow; '' shows those without a folder; a path shows that folder and its subfolders */
export type FolderPick = string | null;

const rowClass = (active: boolean) => `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors cursor-pointer ${active
    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)]'}`;

function Node({ node, depth, value, onPick }: { node: FolderNode; depth: number; value: FolderPick; onPick: (pick: FolderPick) => void }) {
    const inside = typeof value === 'string' && (value === node.path || value.startsWith(`${node.path}/`));
    const [open, setOpen] = useState(inside);
    const active = value === node.path;
    return <li>
        <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
            <button type="button" aria-label={open ? `Close ${node.name}` : `Open ${node.name}`} onClick={() => setOpen(!open)}
                className={`flex h-6 w-5 shrink-0 items-center justify-center text-[var(--text-muted)] cursor-pointer ${node.children.length ? '' : 'invisible'}`}>
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            <button type="button" onClick={() => onPick(node.path)} className={rowClass(active)}>
                {active || open ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                <span className="text-xs tabular-nums text-[var(--text-muted)]">{node.count}</span>
            </button>
        </div>
        {open && node.children.length > 0 && <ul>{node.children.map(child => <Node key={child.path} node={child} depth={depth + 1} value={value} onPick={onPick} />)}</ul>}
    </li>;
}

/** The folders of the workflows, as a tree, with "All" and "No folder" on top */
export function FolderTree({ tree, total, unfiled, value, reading, onPick }: {
    tree: FolderNode[]; total: number; unfiled: number; value: FolderPick; reading: number; onPick: (pick: FolderPick) => void;
}) {
    return <nav aria-label="Folders" className="space-y-1">
        <button type="button" onClick={() => onPick(null)} className={rowClass(value === null)}>
            <Layers className="h-4 w-4 shrink-0" /><span className="flex-1">All workflows</span><span className="text-xs tabular-nums text-[var(--text-muted)]">{total}</span>
        </button>
        <button type="button" onClick={() => onPick('')} className={rowClass(value === '')}>
            <Inbox className="h-4 w-4 shrink-0" /><span className="flex-1">No folder</span><span className="text-xs tabular-nums text-[var(--text-muted)]">{unfiled}</span>
        </button>
        <div className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Folders</div>
        {tree.length === 0
            ? <p className="px-2 text-xs text-[var(--text-muted)]">{reading ? 'Reading folders…' : 'No folders yet. Select workflows and choose Move to folder.'}</p>
            : <ul>{tree.map(node => <Node key={node.path} node={node} depth={0} value={value} onPick={onPick} />)}</ul>}
        {reading > 0 && tree.length > 0 && <p className="px-2 pt-1 text-[11px] text-[var(--text-muted)]">Reading {reading} more…</p>}
    </nav>;
}
