const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

test('chat projects store creates, updates, attaches resources, and builds prompt context cleanly', () => {
    const { useChatProjectsStore, buildProjectContextParts } = load('src/store/chat/useChatProjectsStore.ts', {
        zustand: require('zustand'),
        'zustand/middleware': require('zustand/middleware'),
    });

    const store = useChatProjectsStore.getState();

    // 1. Start create mode -> no popup, transitions cleanly to active project on create
    store.startCreatingProject();
    assert.equal(useChatProjectsStore.getState().isCreatingProject, true);
    assert.equal(useChatProjectsStore.getState().activeProjectId, null);

    const created = store.createProject({
        name: 'Rust Engine Research',
        iconName: 'Cpu',
        instructions: 'Cite file paths and benchmark numbers.',
        attachments: [
            {
                id: 'att_1',
                name: 'notes.md',
                size: 32,
                type: 'text/markdown',
                addedAt: 1000,
                textContent: '# Benchmark\n120 TPS on Q4_K_M',
            },
            {
                id: 'att_2',
                name: 'arch.png',
                size: 128,
                type: 'image/png',
                addedAt: 1001,
                dataUri: 'data:image/png;base64,AAAA',
            },
        ],
    });

    const afterCreate = useChatProjectsStore.getState();
    assert.equal(afterCreate.isCreatingProject, false);
    assert.equal(afterCreate.activeProjectId, created.id);
    assert.equal(afterCreate.projectPaneOpen, true);
    assert.equal(created.iconName, 'Cpu');
    assert.equal(created.attachments.length, 2);

    // 2. Context builder exposes instructions + text files + multimodal parts
    const ctx = buildProjectContextParts(afterCreate.projects[created.id]);
    assert.ok(ctx.systemPrefix.includes('[Project Instructions — "Rust Engine Research"]'));
    assert.ok(ctx.systemPrefix.includes('[Project File: notes.md]'));
    assert.equal(ctx.attachmentParts.length, 1);
    assert.equal(ctx.attachmentParts[0].type, 'image_url');

    // 3. Remove attachment and delete project cleanly
    afterCreate.removeAttachment(created.id, 'att_1');
    assert.equal(useChatProjectsStore.getState().projects[created.id].attachments.length, 1);

    afterCreate.deleteProject(created.id);
    assert.equal(useChatProjectsStore.getState().projects[created.id], undefined);
    assert.equal(useChatProjectsStore.getState().activeProjectId, null);
});
