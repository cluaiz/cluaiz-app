import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { cleanFolder } from './flowFolders';

/** Pick or type a folder ("Clients/Acme" makes a subfolder); empty takes the workflows out of any folder */
export function MoveDialog({ count, folders, start, busy, onMove, onClose }: {
    count: number; folders: string[]; start: string; busy: boolean; onMove: (folder: string) => void; onClose: () => void;
}) {
    const [folder, setFolder] = useState(start);
    useEffect(() => setFolder(start), [start]);
    const clean = cleanFolder(folder);
    const matches = folders.filter(item => !clean || item.toLowerCase().includes(clean.toLowerCase())).slice(0, 8);

    return createPortal(<Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
        <DialogContent className="max-w-md p-6">
            <DialogHeader><DialogTitle>Move {count === 1 ? 'workflow' : `${count} workflows`} to a folder</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={event => { event.preventDefault(); onMove(clean); }}>
                <Input autoFocus value={folder} onChange={event => setFolder(event.target.value)} placeholder="Folder name, or Parent/Child for a subfolder" aria-label="Folder" />
                {matches.length > 0 && <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                    {matches.map(item => <li key={item}><button type="button" onClick={() => setFolder(item)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm cursor-pointer ${item === clean ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50'}`}>
                        <Folder className="h-4 w-4 shrink-0" />{item}</button></li>)}
                </ul>}
                <p className="text-xs text-[var(--text-muted)]">The folder is saved inside each workflow's file, so it stays with the file. Leave empty for no folder.</p>
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={busy}>{busy ? 'Moving…' : clean ? 'Move' : 'Remove from folder'}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>, document.body);
}
