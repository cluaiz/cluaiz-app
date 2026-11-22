import { FileBox } from 'lucide-react';
import { binaryFileKind } from '../../utils/binaryFiles';

/** In place of a text view: a file of bytes (a .wasm plugin, a library, model data) is named and explained, not printed */
export function BinaryFileNotice({ name }: { name: string }) {
    return <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <FileBox size={22} className="text-[var(--accent-color)]" />
        </div>
        <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">{binaryFileKind(name)}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Binary file: it holds bytes, not text, so it is not shown here.</p>
        </div>
    </div>;
}
