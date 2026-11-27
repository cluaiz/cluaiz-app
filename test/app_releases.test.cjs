const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const { selectAppRelease } = load('src/features/settings/appReleases.ts', {});

test('chooses the highest newer published App version, including GitHub prereleases', () => {
    const selected = selectAppRelease('0.1.0', [
        { tag_name: 'app-v0.1.1', draft: false },
        { tag_name: 'app-v0.1.10', draft: false, prerelease: true, body: 'Release notes', html_url: 'https://outside.invalid' },
        { tag_name: 'app-v0.1.2', draft: false },
        { tag_name: 'app-v9.0.0', draft: true },
        { tag_name: 'v9.0.0', draft: false },
    ]);
    assert.equal(selected.version, '0.1.10');
    assert.equal(selected.notes, 'Release notes');
    assert.equal(selected.url, 'https://github.com/cluaiz/cluaiz-app/releases/tag/app-v0.1.10');
});

test('ignores malformed tags, current and older releases', () => {
    assert.equal(selectAppRelease('0.1.1', [
        null,
        { tag_name: 'app-v1.0.0/other', draft: false },
        { tag_name: 'app-v0.1.1', draft: false },
        { tag_name: 'app-v0.1.0', draft: false },
    ]), undefined);
});
