import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useChatSend } from '../src/features/chat/hooks/useChatSend';
import { useChatStore } from '../src/store/chat/useChatStore';
import { useConnectionStore } from '../src/store/engine/useConnectionStore';
import { useEngineStore } from '../src/store/engine/useEngineStore';
import { chatStorageManager } from '../src/services/storage/ChatStorageManager';

test('real chat hook shows SSE failure and the same chat recovers on the next hi', async t => {
    // Storage and network are boundaries; run the actual hook, adapter, SSE reader and store.
    for (const name of ['saveSessionsIndex', 'saveSessionMetadata', 'appendMessage', 'saveAllMessages'] as const) {
        t.mock.method(chatStorageManager, name, async () => {});
    }
    t.mock.method(console, 'log', () => {});
    useConnectionStore.setState({ protocol: 'http', host: '127.0.0.1', port: 8011 });
    useChatStore.setState({ sessions: {}, activeSessionId: null });
    useEngineStore.setState({ permissions: null });
    const payloads: any[] = [];
    let otherSession = '';
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(new URL(String(url)).origin, 'http://127.0.0.1:8011');
        payloads.push(JSON.parse(String(options?.body)));
        if (payloads.length === 1) otherSession = useChatStore.getState().createNewSession('Other chat');
        const body = payloads.length === 1
            ? 'data: {"processing":{"stage":"decoding","state":"running","elapsed_ms":1}}\n\n' +
              'data: {"error":{"message":"PDF extraction unavailable","type":"invalid_request_error"}}\n\n'
            : 'data: {"choices":[{"delta":{"tool_result":{"id":"call_math","name":"math","status":"denied","result":"User denied permission"}}}]}\n\n' +
              'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
        return new Response(body + 'data: [DONE]\n\n');
    });
    let tokenCount = 0;
    const toolStatuses: string[] = [];
    let send: ReturnType<typeof useChatSend>['handleSendMessage'];
    function Harness() {
        send = useChatSend({ inputValue: '', setInputValue: () => {}, replyingTo: null,
            setReplyingTo: () => {}, isIncognito: false, messages: [], telemetry: {
                startStreaming: () => {}, endStreaming: () => null, recordToken: () => tokenCount++,
                recordToolExecution: (_tool: string, _latency: number | undefined, status: string) => toolStatuses.push(status),
                setBreakdown: () => {}, syncSessionTokens: () => {}
            } as any }).handleSendMessage;
        return null;
    }
    renderToString(React.createElement(Harness));
    await send!('read this', { parts: [{ type: 'file_url', file_url: { url: 'data:text/plain;base64,SGVsbG8=' } }] });
    const id = payloads[0].session_id;
    assert.equal(useChatStore.getState().activeSessionId, otherSession);
    assert.equal(useChatStore.getState().sessions[otherSession].messages.length, 0);
    let messages = useChatStore.getState().sessions[id].messages;
    assert.equal(messages[0].finishReason, 'error');
    assert.equal(messages[1].finishReason, 'error');
    assert.match(messages[1].text, /PDF extraction unavailable/);
    assert.equal(tokenCount, 0, 'progress/error must not create a false first token');
    assert.equal(payloads[0].return_progress, true);
    useChatStore.setState({ activeSessionId: id });
    await send!('hi');
    // Flush the chat store's debounced save while both boundaries are still mocked.
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.deepEqual(payloads[1].messages, [{ role: 'user', content: 'hi' }]);
    messages = useChatStore.getState().sessions[id].messages;
    assert.equal(messages[messages.length - 1].text, 'Hello');
    assert.equal(messages[messages.length - 1].toolCalls?.[0]?.status, 'failed');
    assert.deepEqual(toolStatuses, ['failed']);
    assert.equal(tokenCount, 1);
});
