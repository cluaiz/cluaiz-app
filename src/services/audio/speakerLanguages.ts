/**
 * The languages the user speaks (Settings → Voice & Languages). Speech-to-text identifies each
 * phrase among only these, so switching between, say, Hindi and English sentences works and a
 * phrase is never written in an unrelated language. Empty: every language the model knows.
 */
const KEY = 'cluaiz_speaker_languages';

/** A person rarely speaks more; the engine accepts at most this many */
export const MAX_SPEAKER_LANGUAGES = 10;

export const getSpeakerLanguages = (): string[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(saved) ? saved.filter((code) => typeof code === 'string').slice(0, MAX_SPEAKER_LANGUAGES) : [];
    } catch {
        return [];
    }
};

export const saveSpeakerLanguages = (codes: string[]): void => {
    try {
        localStorage.setItem(KEY, JSON.stringify(codes.slice(0, MAX_SPEAKER_LANGUAGES)));
    } catch {
        // Storage blocked: the choice lasts for this page only
    }
};

/** "hi" → "Hindi · हिन्दी" (English name, then the language's own name when it differs) */
export const languageLabel = (code: string): string => {
    try {
        const english = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
        const native = new Intl.DisplayNames([code], { type: 'language' }).of(code);
        return native && native.toLowerCase() !== english.toLowerCase() ? `${english} · ${native}` : english;
    } catch {
        return code;
    }
};
