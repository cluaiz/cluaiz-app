import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { SettingSection } from './SharedComponents';
import { audioApi } from '../../api/engine/audio/audio.api';
import {
    getSpeakerLanguages,
    languageLabel,
    MAX_SPEAKER_LANGUAGES,
    saveSpeakerLanguages,
} from '../../services/audio/speakerLanguages';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/**
 * Settings → Voice & Languages: the languages the user speaks. The microphone identifies each
 * phrase among only these (switching languages between sentences works); none chosen means every
 * language the speech-to-text model knows.
 */
export function VoiceLanguageSettings() {
    const [chosen, setChosen] = useState<string[]>(getSpeakerLanguages);
    const [available, setAvailable] = useState<string[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        audioApi
            .languages()
            .then(setAvailable)
            .catch((err) => setLoadError(err?.message || 'Could not read the speech-to-text model'));
    }, []);

    const update = (next: string[]) => {
        setChosen(next);
        saveSpeakerLanguages(next);
    };
    const toggle = (code: string) => {
        if (chosen.includes(code)) update(chosen.filter((c) => c !== code));
        else if (chosen.length < MAX_SPEAKER_LANGUAGES) update([...chosen, code]);
    };

    const labels = useMemo(
        () => new Map((available || []).concat(chosen).map((code) => [code, languageLabel(code)])),
        [available, chosen]
    );
    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (available || [])
            .filter((code) => !q || code.includes(q) || (labels.get(code) || '').toLowerCase().includes(q))
            .sort((a, b) => (labels.get(a) || a).localeCompare(labels.get(b) || b));
    }, [available, labels, query]);

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Languages You Speak">
                <div className="p-5 space-y-4">
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        The microphone recognises each sentence among these languages, so you can switch
                        between them as you talk. With none chosen, every language is considered, and
                        a sentence may come out in a language you do not speak (Hindi in Urdu script, for example).
                        The list below is what the current speech-to-text model knows; a language it does not
                        know is skipped (struck through), and if it knows none of yours, every language is considered.
                    </p>

                    <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
                        {chosen.length === 0 ? (
                            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">All languages (automatic)</span>
                        ) : (
                            chosen.map((code) => {
                                // Chosen with another model: this one skips it (speech still works)
                                const unknown = !!available && !available.includes(code);
                                return (
                                <span
                                    key={code}
                                    title={unknown ? 'The current speech-to-text model does not know this language, so it is skipped' : undefined}
                                    className={cn(
                                        'flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-[11px] font-semibold border',
                                        unknown
                                            ? 'border-dashed border-[var(--border-color)] text-[var(--text-muted)] line-through'
                                            : 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/40 text-[var(--accent-color)]'
                                    )}
                                >
                                    {labels.get(code) || code}
                                    <button
                                        type="button"
                                        onClick={() => toggle(code)}
                                        className="p-0.5 rounded-full hover:bg-[var(--accent-color)]/20 cursor-pointer"
                                        title="Remove"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                                );
                            })
                        )}
                        {chosen.length > 0 && (
                            <button
                                type="button"
                                onClick={() => update([])}
                                className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer ml-1"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {loadError ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                            The language list comes from the speech-to-text model; start the engine and install one to choose. ({loadError})
                        </p>
                    ) : available === null ? (
                        <p className="text-[11px] text-[var(--text-muted)]">Reading the speech-to-text model…</p>
                    ) : available.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                            The current speech-to-text model understands a single language, so there is nothing to choose.
                        </p>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/20 border border-[var(--border-color)]">
                                <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={`Search ${available.length} languages`}
                                    className="flex-1 bg-transparent outline-none text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
                                {matches.map((code) => {
                                    const active = chosen.includes(code);
                                    const full = !active && chosen.length >= MAX_SPEAKER_LANGUAGES;
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            onClick={() => toggle(code)}
                                            disabled={full}
                                            className={cn(
                                                'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[11px] text-left border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                                                active
                                                    ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/50 text-[var(--accent-color)] font-semibold'
                                                    : 'bg-black/10 border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                            )}
                                        >
                                            <span className="truncate">{labels.get(code) || code}</span>
                                            {active && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                            {chosen.length >= MAX_SPEAKER_LANGUAGES && (
                                <p className="text-[10px] text-[var(--text-muted)]">At most {MAX_SPEAKER_LANGUAGES} languages.</p>
                            )}
                        </>
                    )}
                </div>
            </SettingSection>
        </div>
    );
}
