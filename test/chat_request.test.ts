import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChatHistory, processingLabel, selectChatContext } from '../src/features/chat/utils/chatRequest.ts';
import type { ChatMessage } from '../src/store/chat/useChatStore.ts';

function message(sender: ChatMessage['sender'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
    return { id: crypto.randomUUID(), sender, text, time: '', date: Date.now(), ...extra };
}
const document = [{ type: 'file_url', file_url: { url: 'data:text/plain;base64,SGVsbG8=', name: 'receipt.txt' } }];

test('failed attachment stays visible but next hi is sent without the failed turn', () => {
    const messages = [message('user', 'earlier'), message('assistant', 'answer'),
        message('user', 'read this', { parts: document, finishReason: 'error' }),
        message('assistant', 'Request failed: extraction unavailable', { finishReason: 'error' }),
        message('user', 'hi'), message('assistant', '')];
    assert.equal(messages.length, 6);
    assert.deepEqual(buildChatHistory(messages).map(item => item.content), ['earlier', 'answer', 'hi']);
});

test('legacy blank attachment and system error do not poison an old chat', () => {
    const messages = [message('user', 'read this', { parts: document }),
        message('system', '[System Error]: Failed to fetch'), message('user', 'unanswered hi'),
        message('user', 'hi'), message('assistant', '')];
    assert.deepEqual(buildChatHistory(messages), [{ role: 'user', content: 'hi' }]);
});

test('current and successfully answered documents retain original parts and replies', () => {
    const user = message('user', 'read this', { parts: document });
    const messages = [user, message('assistant', 'Hello'), message('user', 'explain', { replyTo: { text: 'Hello' } })];
    assert.equal(buildChatHistory(messages)[0].content, document);
    assert.match(String(buildChatHistory(messages)[2].content), /In reply to: "Hello"/);
    assert.equal(buildChatHistory([user, message('assistant', '')])[0].content, document);
});

test('progress identifies the actual file and only reports counts supplied by the engine', () => {
    const messages = selectChatContext([message('user', 'old', { finishReason: 'error' }),
        message('user', 'read', { parts: [{ type: 'text', text: 'read' }, ...document], attachments: [{ name: 'receipt.txt' }] }),
        message('assistant', '')]);
    const event = { stage: 'encoding', state: 'running', elapsed_ms: 1900,
        attachment: { message_index: 0, part_index: 1 } } as const;
    assert.equal(processingLabel(event, messages), 'Encoding attachment · receipt.txt');
    assert.equal(processingLabel({ ...event, work: { completed: 2, total: 5, unit: 'frames' } }, messages),
        'Encoding attachment · receipt.txt (2/5 frames)');
    assert.ok(!processingLabel(event, messages).includes('%'));
});

test('code upload distinguishes historical PNG encoding from reading the current source file', () => {
    const oldImage = [{ type: 'image_url', image_url: { url: 'old.png' } }];
    const code = [{ type: 'file_url', file_url: { url: 'squares.py', name: 'squares.py' } }];
    const messages = selectChatContext([message('user', 'describe', {
        parts: oldImage, attachments: [{ name: 'architecture.png' }]
    }), message('assistant', 'Architecture diagram.'), message('user', '', { parts: code }), message('assistant', '')]);
    const event = { stage: 'encoding', state: 'running', elapsed_ms: 1500,
        attachment: { message_index: 0, part_index: 0 } } as const;
    assert.equal(processingLabel(event, messages), 'Encoding attachment · earlier attachment · architecture.png');
    assert.equal(processingLabel({ ...event, stage: 'reading', attachment: { message_index: 2, part_index: 0 } }, messages),
        'Reading attachment · squares.py');
    assert.equal(buildChatHistory(messages)[2].content, code);
});
