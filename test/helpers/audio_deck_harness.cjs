// Execute the actual TSX component with deterministic hook/media boundaries.
// This exercises callbacks and effects; it is not a DOM or audible-playback test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../app/node_modules/typescript');
const root = path.resolve(__dirname, '../..');

function load(relative, imports, globals = {}) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const exports = {};
    vm.runInNewContext(js, { exports, require: name => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
    }, AbortController, Error, ...globals }, { filename: relative });
    return exports;
}

exports.createHarness = (speech = async () => new Blob(['audio']), options = {}) => {
    let active;
    const calls = [], audios = [], probes = [], revoked = [], errors = [], catalogs = [];
    let settings = { playbackSpeed: 1, ...options.settings };
    const listeners = new Set();
    const settingsModule = load('src/services/audio/ttsSettings.ts', {});
    const turns = load('src/services/audio/speechTurns.ts', {}).speechTurns;
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const slot = init => {
        const instance = active, index = instance.cursor++;
        if (!(index in instance.slots)) instance.slots[index] = init();
        return [instance.slots[index], v => { instance.slots[index] = v; }];
    };
    const hooks = {
        useState: init => slot(() => typeof init === 'function' ? init() : init),
        useRef: value => slot(() => ({ current: value }))[0],
        useCallback: (fn, deps) => {
            const [old, put] = slot(() => null);
            if (!old || !sameDeps(old.deps, deps)) { put({ fn, deps }); return fn; }
            return old.fn;
        },
        useEffect: (fn, deps) => {
            const [old, put] = slot(() => null);
            if (!old || !sameDeps(old.deps, deps)) active.effects.push(() => {
                old?.cleanup?.(); put({ deps, cleanup: fn() });
            });
        },
    };
    class AudioBoundary {
        constructor(url) {
            Object.assign(this, { src: url, duration: NaN, currentTime: 0, paused: true, playCalls: 0 });
            audios.push(this);
        }
        play() { this.paused = false; this.playCalls++; return Promise.resolve(); }
        pause() { this.paused = true; }
        set preload(value) {
            if (value === 'metadata') { audios.splice(audios.indexOf(this), 1); probes.push(this); }
        }
        metadata(duration = 4) { this.duration = duration; this.onloadedmetadata?.(); }
        end() { this.paused = true; this.onended?.(); }
    }
    const highlight = { clear() {}, setPlaying() {}, setActiveSentence() {}, updateWordProgress() {}, setAudioLevel() {} };
    const Deck = load('src/components/ui/PersistentAudioPlayer.tsx', {
        react: hooks,
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        'lucide-react': {}, 'framer-motion': { motion: { span: 'span' } },
        '@animateicons/react/lucide': {},
        '../../api/engine/audio/audio.api': { audioApi: { speech: (payload, signal) => {
            calls.push({ payload, signal }); return speech(payload, signal);
        }, voiceCatalog: (model, signal) => {
            catalogs.push({ model, signal });
            return options.catalog ? options.catalog(model, signal) : Promise.resolve({ model,
                capabilities: { coherent_input: false, voice_mode: 'preset', language_control: 'explicit', ...options.capabilities } });
        } } },
        '../../services/audio/speechTurns': { speechTurns: turns },
        '../../services/audio/ttsSettings': {
            speechPreferenceKey: settingsModule.speechPreferenceKey,
            subscribeTtsSettings: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        },
        '../../store/chat/useSpeechHighlightStore': { useSpeechHighlightStore: { getState: () => highlight } },
        './toast': { toast: { error: message => errors.push(message) } },
        './AudioControlSettingsModal': { getStoredTtsSettings: () => settings, saveStoredTtsSettings() {} },
    }, { Audio: AudioBoundary, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, URL: {
        createObjectURL: () => `blob:part-${calls.length}`, revokeObjectURL: url => revoked.push(url),
    } }).PersistentAudioDeck;
    const nodes = node => !node || typeof node !== 'object' ? [] :
        [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    const text = node => [node].flat(Infinity).map(v => v && typeof v === 'object' ? text(v.props?.children) : v ?? '').join('');
    return { calls, audios, probes, revoked, errors, turns, catalogs,
        settings(next) { settings = { ...settings, ...next }; listeners.forEach(listener => listener(settings)); },
        mount(props = {}) {
        const instance = { slots: [], cursor: 0, effects: [], tree: null, props: {
            messageId: 'message', text: 'First sentence. Second sentence.', onClose() {}, ...props,
        } };
        const deck = {
            render(update = {}) {
                Object.assign(instance.props, update); active = instance; instance.cursor = 0;
                instance.tree = Deck(instance.props);
                instance.effects.splice(0).forEach(effect => effect());
                return instance.tree;
            },
            click(title = 'Play') {
                deck.render();
                const button = nodes(instance.tree).find(n => n.type === 'button' && n.props.title === title);
                if (!button) throw new Error(`Button not found: ${title}`);
                button.props.onClick({ stopPropagation() {} });
            },
            async flush() { await new Promise(setImmediate); deck.render(); },
            get text() { return text(deck.render()); },
            get alert() { return text(nodes(deck.render()).find(n => n.props?.role === 'alert')); },
            unmount() { instance.slots.forEach(s => s?.cleanup?.()); },
        };
        deck.render(); return deck;
    } };
};
