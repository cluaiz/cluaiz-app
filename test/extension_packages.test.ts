import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readPackageTar, readPackageArchive, PACKAGE_EXPANDED_LIMIT, PACKAGE_COMPRESSED_LIMIT } from '../src/extensions/packages/archive';
import { tarFixture } from './fixtures/extensions/package-fixture';
import { createNativePackageStorage } from '../src/extensions/packages/native';
import type { invoke } from '@tauri-apps/api/core';
const bytes = new TextEncoder().encode('owned archive fixture');
const valid = () => tarFixture([{ name: 'package/dist/index.html', bytes }]);
test('USTAR file bytes are retained without extracting paths', () => {
    assert.deepEqual(readPackageTar(valid()).get('dist/index.html'), bytes);
});
test('traversal, absolute, Windows and ambiguous archive paths are rejected', () => {
    for (const name of ['../escape', '/absolute', 'package/../escape', 'package/C:/escape', 'package/dist\\bad', 'package/dist//bad']) {
        assert.throws(() => readPackageTar(tarFixture([{ name, bytes }])));
    }
});
test('links, special records and duplicate entries are rejected', () => {
    for (const type of [49, 50, 51, 52, 54, 55, 120]) assert.throws(() => readPackageTar(tarFixture([{ name: 'package/link', bytes, type }])));
    assert.throws(() => readPackageTar(tarFixture([{ name: 'package/a', bytes }, { name: 'package/a', bytes }])));
});
test('checksum, truncation, terminator and count bounds are enforced', () => {
    const corrupt = valid(); corrupt[10] ^= 1;
    assert.throws(() => readPackageTar(corrupt), /checksum/);
    assert.throws(() => readPackageTar(valid().slice(0, -1024)), /terminator/);
    assert.throws(() => readPackageTar(valid().slice(0, -1)));
    assert.throws(() => readPackageTar(tarFixture(Array.from({ length: 129 }, (_, i) => ({ name: 'package/' + i, bytes })))), /excessive/);
});
test('gzip streams pass actual valid archive and refuse corrupt/oversized compressed input', async () => {
    const result = await readPackageArchive(new Blob([gzipSync(valid())]));
    assert.deepEqual(result.get('dist/index.html'), bytes);
    await assert.rejects(readPackageArchive(new Blob(['not gzip'])));
    await assert.rejects(readPackageArchive(new Blob([new Uint8Array(PACKAGE_COMPRESSED_LIMIT + 1)])), /20 MiB/);
});
test('small compressed expansion bomb stops at the expanded bound', async () => {
    await assert.rejects(readPackageArchive(new Blob([gzipSync(new Uint8Array(PACKAGE_EXPANDED_LIMIT + 512))])), /32 MiB/);
});
test('native list/read/mutation calls serialize and a rejected operation does not poison later calls', async () => {
    let active = 0; let maximum = 0;
    const calls: string[] = [];
    const driver = createNativePackageStorage((async (command: string) => {
        maximum = Math.max(maximum, ++active); calls.push(command);
        try {
            await new Promise(resolve => setTimeout(resolve, 5));
            if (command === 'extension_package_commit') throw Error('Controlled write denial');
            return command === 'extension_packages_list' ? [] : null;
        } finally { active--; }
    }) as typeof invoke);
    const results = await Promise.allSettled([driver.commit('fixture.test', null, null), driver.read('fixture.test'), driver.list()]);
    assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled'); assert.equal(results[2].status, 'fulfilled');
    assert.equal(maximum, 1);
    assert.deepEqual(calls, ['extension_package_commit', 'extension_package_read', 'extension_packages_list']);
});
