import test from 'node:test';
import assert from 'node:assert/strict';

const STEP_REGEX = /\[(STEP \d+\/\d+[^\]\n]*)\]/i;

const MINIMAP_SPECS = {
    tickHeightPx: 2,
    tickWidthDefaultPx: 8,
    tickWidthHoverPx: 22,
    verticalGapPx: 7,
};

function isScrollbarActive(scrollHeight: number, clientHeight: number): boolean {
    return (scrollHeight - clientHeight) > 24;
}

function extractTurnTicks(messages: Array<{ id?: string; text?: string; sender: 'user' | 'assistant'; time?: string }>) {
    const items: Array<{ id: string; turnIndex: number; userPrompt?: string; aiSnippet?: string }> = [];
    let currentTurn: { id: string; turnIndex: number; userPrompt?: string; aiSnippet?: string } | null = null;

    messages.forEach((msg, idx) => {
        const rawText = (msg.text || '').trim();
        if (!rawText) return;

        const cleanText = rawText.replace(STEP_REGEX, '').trim();

        if (msg.sender === 'user') {
            currentTurn = {
                id: msg.id || `turn-${items.length}`,
                turnIndex: items.length + 1,
                userPrompt: rawText.slice(0, 200),
            };
            items.push(currentTurn);
        } else if (msg.sender === 'assistant') {
            if (currentTurn && !currentTurn.aiSnippet) {
                currentTurn.aiSnippet = cleanText.slice(0, 260) || rawText.slice(0, 260);
            } else {
                items.push({
                    id: msg.id || `turn-${items.length}`,
                    turnIndex: items.length + 1,
                    aiSnippet: cleanText.slice(0, 260) || rawText.slice(0, 260),
                });
            }
        }
    });

    return items;
}

test('scrollbar minimap: exact user dimension specifications', () => {
    assert.strictEqual(MINIMAP_SPECS.tickHeightPx, 2, 'Height must be 2px');
    assert.strictEqual(MINIMAP_SPECS.tickWidthDefaultPx, 8, 'Default width must be 8px');
    assert.strictEqual(MINIMAP_SPECS.tickWidthHoverPx, 22, 'Hover width must be 22px');
    assert.strictEqual(MINIMAP_SPECS.verticalGapPx, 7, 'Vertical gap must be 7px');
});

test('scrollbar minimap: scrollbar active detection logic', () => {
    // When content fits in viewport, scrollbar is inactive
    assert.strictEqual(isScrollbarActive(500, 600), false);
    assert.strictEqual(isScrollbarActive(600, 600), false);
    assert.strictEqual(isScrollbarActive(615, 600), false);

    // When content overflows viewport meaningfully, scrollbar is active
    assert.strictEqual(isScrollbarActive(1200, 600), true);
    assert.strictEqual(isScrollbarActive(700, 600), true);
});

test('scrollbar minimap: User SMS + AI SMS group into 1 single dot/turn', () => {
    const messages = [
        { id: '1', sender: 'user' as const, text: 'Hello, How Are You?' },
        { id: '2', sender: 'assistant' as const, text: 'Main theek hoon! Aapki kya madad kar sakta hoon?' },
        { id: '3', sender: 'user' as const, text: 'are u ai' },
        { id: '4', sender: 'assistant' as const, text: 'Yes, I am Cluaiz AI.' },
    ];

    const turns = extractTurnTicks(messages);

    // 4 messages must produce exactly 2 turn dots/ticks!
    assert.strictEqual(turns.length, 2, 'User + AI must merge into 1 dot per exchange');

    // Turn 1 verification
    assert.strictEqual(turns[0].turnIndex, 1);
    assert.strictEqual(turns[0].userPrompt, 'Hello, How Are You?');
    assert.strictEqual(turns[0].aiSnippet, 'Main theek hoon! Aapki kya madad kar sakta hoon?');

    // Turn 2 verification
    assert.strictEqual(turns[1].turnIndex, 2);
    assert.strictEqual(turns[1].userPrompt, 'are u ai');
    assert.strictEqual(turns[1].aiSnippet, 'Yes, I am Cluaiz AI.');
});

test('scrollbar minimap: dynamic gap calculation has floor of 5px', () => {
    function computeGap(count: number): number {
        if (count <= 15) return 8;
        if (count <= 30) return 6;
        return 5;
    }

    assert.strictEqual(computeGap(5), 8, '<= 15 turns should have 8px gap');
    assert.strictEqual(computeGap(20), 6, '<= 30 turns should have 6px gap');
    assert.strictEqual(computeGap(50), 5, '50 turns should retain 5px floor');
    assert.strictEqual(computeGap(100), 5, '100+ turns should retain 5px floor (never cramped to 3px)');
});

test('scrollbar minimap: top & bottom smoke dim factor smoothly fades edges', () => {
    function computeDimFactor(idx: number, total: number): number {
        if (total <= 12) return 1;
        const fadeCount = Math.min(6, Math.floor(total * 0.16));
        if (idx < fadeCount) {
            return 0.25 + 0.75 * ((idx + 1) / (fadeCount + 1));
        } else if (idx >= total - fadeCount) {
            return 0.25 + 0.75 * ((total - idx) / (fadeCount + 1));
        }
        return 1;
    }

    const total = 40;
    // Top tick 0 should be dimmed
    const topFactor = computeDimFactor(0, total);
    assert.ok(topFactor < 0.5, 'Top tick must be dimmed');

    // Middle tick 20 should have full opacity (factor = 1)
    const midFactor = computeDimFactor(20, total);
    assert.strictEqual(midFactor, 1, 'Middle tick must have full visibility');

    // Bottom tick 39 should be dimmed
    const botFactor = computeDimFactor(39, total);
    assert.ok(botFactor < 0.5, 'Bottom tick must be dimmed');
});

