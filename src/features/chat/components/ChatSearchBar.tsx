import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Code2, FileText, Film, Image as ImageIcon, SlidersHorizontal, Star, X } from 'lucide-react';
import { Icons } from '../../../components/animate-ui/icons';
import { ActionDropdown, ActionDropdownItem } from '../../../components/ui/dropdown/ActionDropdown';
import { CalendarDropdown, type DateRange } from '../../../components/ui/dropdown/CalendarDropdown';
import type { ChatMessage } from '../../../store/chat/types';
import { messageKinds, type MessageKind } from '../utils/chatExport';

const KINDS: { id: MessageKind; label: string; icon: typeof ImageIcon }[] = [
    { id: 'image', label: 'Images', icon: ImageIcon }, { id: 'document', label: 'Documents', icon: FileText },
    { id: 'code', label: 'Code', icon: Code2 }, { id: 'media', label: 'Audio & video', icon: Film },
];
const HIGHLIGHT = 'chat-search';

interface Filters { words: string; kinds: Set<MessageKind>; reactions: Set<string>; starred: boolean; range?: DateRange }

function matches(message: ChatMessage, f: Filters) {
    if (message.compaction) return false;
    if (f.words && !message.text.toLowerCase().includes(f.words.toLowerCase())) return false;
    if (f.starred && !message.isStarred) return false;
    if (f.reactions.size && !(message.reactions ?? []).some(reaction => f.reactions.has(reaction))) return false;
    if (f.kinds.size) { const has = messageKinds(message); if (![...f.kinds].some(kind => has.has(kind))) return false; }
    if (f.range?.from) {
        const day = new Date(message.date); day.setHours(0, 0, 0, 0);
        if (day < new Date(f.range.from.toDateString()) || day > new Date((f.range.to ?? f.range.from).toDateString())) return false;
    }
    return true;
}

/** Marks every match of `words` inside the shown messages with the CSS Highlight API (no change to how messages render) */
function markWords(words: string) {
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightClass = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!registry || !HighlightClass) return;
    registry.delete(HIGHLIGHT);
    if (!words) return;
    const ranges: Range[] = [], needle = words.toLowerCase();
    document.querySelectorAll('[data-message-index]').forEach(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.toLowerCase() ?? '';
            for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
                const range = new Range(); range.setStart(node, at); range.setEnd(node, at + needle.length); ranges.push(range);
            }
        }
    });
    registry.set(HIGHLIGHT, new HighlightClass(...ranges));
}

/**
 * Search inside the open chat, opened from the chat menu into the top bar: words are matched and marked as they are typed, and the filter
 * menu narrows by what a message holds, starred, reactions and date. Messages that do not match are hidden in
 * place (a style rule on `data-message-index`), so the chat itself is the result list.
 */
export function ChatSearchBar({ messages, onClose }: { messages: ChatMessage[]; onClose(): void }) {
    const [words, setWords] = useState('');
    const [kinds, setKinds] = useState<Set<MessageKind>>(new Set());
    const [reactions, setReactions] = useState<Set<string>>(new Set());
    const [starred, setStarred] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>();
    const [menu, setMenu] = useState(false), [calendar, setCalendar] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);

    const allReactions = useMemo(() => [...new Set(messages.flatMap(message => message.reactions ?? []))], [messages]);
    const toggle = <T,>(set: Set<T>, value: T) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };
    const query = words.trim();
    const filterCount = kinds.size + reactions.size + (starred ? 1 : 0) + (range?.from ? 1 : 0);
    const active = Boolean(query) || filterCount > 0;
    const shown = useMemo(() => active
        ? messages.flatMap((message, index) => matches(message, { words: query, kinds, reactions, starred, range }) ? [index] : []) : [],
    [messages, active, query, kinds, reactions, starred, range]);

    useEffect(() => {
        const timer = setTimeout(() => markWords(query), 30);
        return () => clearTimeout(timer);
    }, [query, shown]);
    useEffect(() => () => markWords(''), []);
    const clear = () => { setWords(''); setKinds(new Set()); setReactions(new Set()); setStarred(false); setRange(undefined); };

    const hide = active ? `[data-message-index]${shown.map(index => `:not([data-message-index="${index}"])`).join('')}{display:none!important}` : '';
    return <div className="relative flex min-w-0 items-center gap-1">
        <style>{`::highlight(${HIGHLIGHT}){background-color:color-mix(in srgb, var(--accent-color) 40%, transparent);color:inherit}${hide}`}</style>
        {/* The sidebar's "Search chats" field, with the filter button inside it */}
        <div className="relative flex w-48 items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-3 py-1.5 themed-border transition-all duration-200 focus-within:border-[var(--accent-color)] sm:w-72"
            style={{ borderStyle: 'var(--border-style)' }}>
            <Icons.Search className="w-4 h-4 shrink-0 text-[var(--text-muted)]" size={16} />
            <input autoFocus type="text" value={words} onChange={event => setWords(event.target.value)} placeholder="Search this chat..."
                onKeyDown={event => { if (event.key === 'Escape') { clear(); onClose(); } }}
                className="w-full min-w-0 border-0 bg-transparent text-xs font-medium text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]" />
            {active && <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{shown.length}</span>}
            <button ref={trigger} type="button" aria-label="Filters" aria-expanded={menu} onClick={() => setMenu(!menu)} title="Filters"
                className={`relative shrink-0 rounded p-0.5 transition-colors cursor-pointer ${filterCount ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                <SlidersHorizontal size={14} />
                {filterCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--accent-color)] px-1 text-[9px] font-bold text-white">{filterCount}</span>}
            </button>
            <button type="button" aria-label="Close search" title="Close search" onClick={() => { clear(); onClose(); }}
                className="shrink-0 p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] cursor-pointer"><Icons.X className="w-3.5 h-3.5" /></button>
        </div>
        <ActionDropdown isOpen={menu} onClose={() => setMenu(false)} floating triggerRef={trigger} className="w-56">
            <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Show messages with</div>
            {KINDS.map(kind => <ActionDropdownItem key={kind.id} active={kinds.has(kind.id)} icon={<kind.icon size={14} />}
                onClick={() => setKinds(toggle(kinds, kind.id))}>{kind.label}</ActionDropdownItem>)}
            <ActionDropdownItem active={starred} icon={<Star size={14} />} onClick={() => setStarred(!starred)}>Starred</ActionDropdownItem>
            <ActionDropdownItem active={Boolean(range?.from)} icon={<CalendarDays size={14} />} onClick={() => setCalendar(true)}>
                {range?.from ? `${range.from.toLocaleDateString()}${range.to ? ` – ${range.to.toLocaleDateString()}` : ''}` : 'Date'}
            </ActionDropdownItem>
            {allReactions.length > 0 && <>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Reactions</div>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                    {allReactions.map(reaction => <button key={reaction} type="button" aria-pressed={reactions.has(reaction)}
                        onClick={() => setReactions(toggle(reactions, reaction))}
                        className={`rounded-lg border px-1.5 py-0.5 text-sm cursor-pointer ${reactions.has(reaction) ? 'border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15' : 'border-transparent hover:bg-[var(--bg-tertiary)]'}`}>{reaction}</button>)}
                </div>
            </>}
            {filterCount > 0 && <><div className="my-1 h-px bg-[var(--border-color)]/60" />
                <ActionDropdownItem icon={<X size={14} />} onClick={() => { setKinds(new Set()); setReactions(new Set()); setStarred(false); setRange(undefined); }}>Clear filters</ActionDropdownItem></>}
        </ActionDropdown>
        <CalendarDropdown isOpen={calendar} onClose={() => setCalendar(false)} dateRange={range} onDateRangeChange={setRange}
            bookedDates={messages.map(message => new Date(message.date))} filteredChatsCount={shown.length} align="right" triggerRef={trigger} />
    </div>;
}

