import { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { errorMessage } from '../../api/client/errors';
import { discoverTools, type ToolDiscovery } from '../../api/engine/tools/discover';

/** Type a message and see which installed tools the chat would offer for it. */
export function ToolMatchTester() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<ToolDiscovery | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const test = async () => {
        setBusy(true); setError('');
        try { setResult(await discoverTools(query)); } catch (reason) { setError(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    return <div className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-4">
        <p className="text-xs font-semibold text-[var(--text-primary)]">Which tools would a message use?</p>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void test(); }}>
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Type a message as you would in a chat" />
            <Button size="sm" type="submit" disabled={busy || !query.trim()}>Test</Button>
        </form>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {result && <div className="space-y-1 text-xs">
            <p className="text-[var(--text-secondary)]">{result.candidates.length ? `${result.candidates.length} of ${result.installed} installed tools match.` : `None of the ${result.installed} installed tools match.`}</p>
            {result.candidates.map(item => <div key={`${item.category}:${item.id}`} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.category}</Badge>
                <span className="font-mono text-[var(--text-primary)]">{item.id}</span>
                <span className="text-[var(--text-muted)]">score {item.score.toFixed(2)}</span>
                {item.matched?.length ? <span className="text-[var(--text-muted)]">matched: {item.matched.join(', ')}</span> : null}
            </div>)}
        </div>}
    </div>;
}
