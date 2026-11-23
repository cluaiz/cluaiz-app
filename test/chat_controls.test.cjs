const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const sampling = load('src/api/engine/chat/sampling.ts', {});
const request = load('src/features/chat/utils/chatRequest.ts', { '../../../store/chat/useChatControlsStore': sampling });

test('only the settings a chat set are sent, so the rest keep the Engine defaults', () => {
  const options = JSON.parse(JSON.stringify(request.chatControlOptions({ temperature: 0.3, max_tokens: 40, seed: 7, top_p: Number.NaN, systemPrompt: '  Be brief.  ' })));
  assert.deepEqual(options, { temperature: 0.3, max_tokens: 40, seed: 7, system_prompt: 'Be brief.' });
  assert.deepEqual(JSON.parse(JSON.stringify(request.chatControlOptions({ systemPrompt: '   ' }))), {});
});

test('the composer options carry the chat settings next to model and reasoning', () => {
  const options = request.chatComposerOptions('m', 'auto', 'low', [], { temperature: 0 });
  assert.equal(options.model, 'm');
  assert.equal(options.temperature, 0, 'zero is a real value, not "default"');
});
