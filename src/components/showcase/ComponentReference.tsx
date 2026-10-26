import { Button } from '../ui/Button';
import type { ComponentId } from './types';
import { componentAvailability, SDK_REFERENCES } from './reference';

interface Props {
    id: ComponentId;
    copiedText: string | null;
    onCopy(text: string): void;
}
export function ComponentReference({ id, copiedText, onCopy }: Props) {
    const availability = componentAvailability(id);
    const reference = SDK_REFERENCES[id];
    return <section aria-label="Component reference" className="p-5 border-b border-[var(--border-color)] space-y-3">
        <h2 className="font-semibold">Usage reference · {availability.label}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{availability.description}</p>
        {reference && <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs">@cluaiz/extension-sdk/ui</code>
                <Button variant="outline" size="sm" onClick={() => onCopy(reference.example)}>
                    {copiedText === reference.example ? 'Copied example' : 'Copy example'}
                </Button>
            </div>
            <pre className="text-xs p-3 rounded-lg bg-[var(--bg-secondary)] overflow-x-auto"><code>{reference.example}</code></pre>
            <table className="w-full text-sm text-left"><thead><tr><th className="py-2">Prop</th><th>Usage / default</th></tr></thead>
                <tbody>{reference.props.map(([name, description]) => <tr key={name} className="border-t border-[var(--border-color)]">
                    <td className="py-2 pr-4 font-mono">{name}</td><td>{description}</td>
                </tr>)}</tbody></table>
        </>}
    </section>;
}
