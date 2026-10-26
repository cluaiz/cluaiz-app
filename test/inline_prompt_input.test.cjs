const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../app/node_modules/typescript');

// Execute the actual component; only hooks/DOM are deterministic boundaries.
// Browser acceptance separately checks real React warnings and UI behavior.
function mount() {
    const writes = [], ref = { current: null };
    const hooks = {
        forwardRef: fn => fn,
        useRef: value => ({ current: value }),
        useState: value => [value, next => writes.push(next)],
        useCallback: fn => fn,
        useEffect: () => {},
        useImperativeHandle: (target, factory) => { target.current = factory(); },
    };
    const imports = {
        react: hooks,
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        'react-dom': { createPortal: () => { throw Error('No chip portals expected'); } },
        './ContextChip': { ContextChip: () => null },
        '../../utils/filePath': { extractBaseName: () => { throw Error('No paths expected'); } },
    };
    const relative = 'src/components/ui/InlinePromptInput.tsx';
    const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: name => {
        assert.ok(name in imports, `Unexpected import: ${name}`);
        return imports[name];
    }, window: { getSelection: () => null } }, { filename: relative });
    const tree = exports.InlinePromptInput({}, ref);
    const editor = tree.props.children.find(node => node?.props?.role === 'textbox');
    assert.ok(editor);
    const dom = { innerText: '', querySelectorAll: () => [], childNodes: [],
        set innerHTML(value) { this.innerText = value; } };
    return { writes, handle: ref.current, editor, dom,
        attach: () => { editor.props.ref.current = dom; } };
}

test('isEmpty before the editor mounts returns true without updating React state', () => {
    const h = mount();
    assert.equal(h.handle.isEmpty(), true);
    assert.deepEqual(h.writes, []);
});

test('isEmpty reads current text and whitespace without any state writes', () => {
    const h = mount(); h.attach();
    for (const text of ['', ' \n\t', 'Question', '  Question  ']) {
        h.dom.innerText = text;
        assert.equal(h.handle.isEmpty(), text.trim() === '');
    }
    assert.deepEqual(h.writes, []);
});

test('a context chip counts as content even when its editor text is empty', () => {
    const h = mount(); h.attach();
    h.dom.querySelectorAll = selector => {
        assert.equal(selector, '[data-context-chip-host]'); return [{}];
    };
    assert.equal(h.handle.isEmpty(), false);
    assert.deepEqual(h.writes, []);
});

test('typing and clear still update placeholder state while the read remains pure', () => {
    const h = mount(); h.attach();
    h.dom.innerText = 'Question'; h.editor.props.onInput();
    assert.equal(h.writes.at(-1), false);
    const count = h.writes.length;
    assert.equal(h.handle.isEmpty(), false);
    assert.equal(h.writes.length, count);
    h.handle.clear();
    assert.equal(h.writes.at(-1), true);
    const cleared = h.writes.length;
    assert.equal(h.handle.isEmpty(), true);
    assert.equal(h.writes.length, cleared);
});
