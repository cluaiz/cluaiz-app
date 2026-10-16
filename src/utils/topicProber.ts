/**
 * Topic & Emoji Prober
 * Analyzes conversational prompts and initial exchanges to dynamically select a contextual emoji and generate a clean, smart title.
 */

export interface TopicInference {
    emoji: string;
    title: string;
    category: string;
}

const DIVERSE_FALLBACK_EMOJIS = ['💡', '✨', '🚀', '🎯', '💭', '💬', '🔥', '🧠'];

const TOPIC_RULES: Array<{
    category: string;
    emoji: string;
    keywords: RegExp;
}> = [
    {
        category: 'code',
        emoji: '💻',
        keywords: /\b(code|coding|function|fn|rust|ts|typescript|js|javascript|python|bug|fix|api|error|compile|compiler|class|git|interface|component|endpoint|backend|frontend|react|node|wasm|memory|heap|stack|segfault|html|css|dev)\b/i
    },
    {
        category: 'ai',
        emoji: '🤖',
        keywords: /\b(ai|llm|gpt|model|claude|gemini|assistant|neural|prompt|intelligence|bot|deepseek|llama)\b/i
    },
    {
        category: 'tech',
        emoji: '🚀',
        keywords: /\b(tech|technology|hardware|gpu|cpu|server|cloud|cuda|cluster|silicon|network|infra|system|linux|windows|cli|terminal)\b/i
    },
    {
        category: 'data',
        emoji: '📊',
        keywords: /\b(data|sql|query|database|db|bigquery|table|schema|benchmark|tps|latency|metrics|stats|analytics|dataset|postgres|sqlite)\b/i
    },
    {
        category: 'design',
        emoji: '🎨',
        keywords: /\b(ui|ux|color|style|design|theme|tailwind|button|layout|mockup|animation|font|sidebar|modal|svg|icon)\b/i
    },
    {
        category: 'research',
        emoji: '🔍',
        keywords: /\b(search|find|explain|why|how|what is|difference|compare|history|research|documentation|paper|reference|kya|kaise|batao|samjhao|tell me|detail)\b/i
    },
    {
        category: 'ideas',
        emoji: '💡',
        keywords: /\b(idea|concept|plan|architecture|strategy|roadmap|brainstorm|proposal|vision|feature|socho)\b/i
    },
    {
        category: 'writing',
        emoji: '📝',
        keywords: /\b(write|draft|email|essay|translate|summary|summarize|document|readme|blog|rewrite|letter|kavita|story|kahani)\b/i
    },
    {
        category: 'security',
        emoji: '🔒',
        keywords: /\b(security|auth|token|jwt|password|permission|access|decrypt|encrypt|vuln|vulnerability|firewall)\b/i
    },
    {
        category: 'media',
        emoji: '🎵',
        keywords: /\b(sound|voice|music|audio|speech|video|stream|podcast|mp3|wav|mic|speaker)\b/i
    },
    {
        category: 'performance',
        emoji: '⚡',
        keywords: /\b(speed|fast|perf|performance|optimize|optimization|throughput|cache|kv-cache|accelerat)\b/i
    },
    {
        category: 'finance',
        emoji: '📈',
        keywords: /\b(money|finance|budget|price|cost|market|stock|crypto|bitcoin|trade|paisa|rupee|dollar)\b/i
    },
    {
        category: 'greeting',
        emoji: '👋',
        keywords: /^(hi|hello|hey|namaste|ji sir|sir|good morning|good evening|pranam)\b/i
    },
    {
        category: 'personal',
        emoji: '✨',
        keywords: /\b(love|heart|feeling|friend|dost|yaad|sukriya|thanks|thank you|❤️|super|awesome|nice)\b/i
    },
    {
        category: 'question',
        emoji: '🎯',
        keywords: /(\?|\b(kaun|kab|kahan|kyun|who|when|where|which|can you|help|madad)\b)/i
    }
];

const LEADING_FILLER_REGEX = /^(can you help me with|can you write|can you create|can you explain|can you tell me|please help me with|please explain|please write|could you please|how do i|how to|how can i|i want to|tell me about|what is|i need to|help me with|write a|create a|give me a|give me|batao|kya hai|kaise karein)\s+/i;

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Infers an appropriate emoji and clean title from user prompt and optional assistant response.
 */
export function inferChatTopicAndEmoji(rawPrompt: string, assistantReply?: string): TopicInference {
    const trimmed = (rawPrompt || '').trim();
    if (!trimmed) {
        return {
            emoji: '💬',
            title: 'New Chat',
            category: 'general'
        };
    }

    // 1. Detect category and emoji from user prompt first
    let detectedEmoji = '';
    let detectedCategory = 'general';

    for (const rule of TOPIC_RULES) {
        if (rule.keywords.test(trimmed)) {
            detectedEmoji = rule.emoji;
            detectedCategory = rule.category;
            break;
        }
    }

    // If still general or greeting, check assistantReply keywords for richer categorization
    if ((detectedCategory === 'general' || detectedCategory === 'greeting') && assistantReply) {
        for (const rule of TOPIC_RULES) {
            if (rule.category !== 'greeting' && rule.keywords.test(assistantReply)) {
                detectedEmoji = rule.emoji;
                detectedCategory = rule.category;
                break;
            }
        }
    }

    // Diverse fallback if no rule matched
    if (!detectedEmoji) {
        const idx = hashString(trimmed) % DIVERSE_FALLBACK_EMOJIS.length;
        detectedEmoji = DIVERSE_FALLBACK_EMOJIS[idx];
    }

    // 2. Clean conversational filler to form concise title
    let cleaned = trimmed.replace(LEADING_FILLER_REGEX, '').trim();
    if (!cleaned) {
        cleaned = trimmed;
    }

    // Remove markdown code fences or quotes if any
    cleaned = cleaned.replace(/^[`'"]+|[`'"]+$/g, '').trim();

    // Capitalize first letter of words (title case first 4-5 words)
    const words = cleaned.split(/\s+/).filter(Boolean);
    const titleWords = words.slice(0, 6).map(w => {
        // Keep acronyms uppercase (e.g. API, SQL, UI, CSS, IPC, FFI)
        if (w.length <= 4 && w.toUpperCase() === w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
    });

    let generatedTitle = titleWords.join(' ');
    if (generatedTitle.length > 36) {
        generatedTitle = generatedTitle.slice(0, 33).trim() + '...';
    }

    if (!generatedTitle) {
        generatedTitle = 'New Chat';
    }

    return {
        emoji: detectedEmoji,
        title: generatedTitle,
        category: detectedCategory
    };
}
