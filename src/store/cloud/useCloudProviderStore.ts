import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CloudProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'groq' | 'openrouter';

export interface CloudModel {
  id: string;
  name: string;
  providerId: CloudProviderId;
  providerName: string;
  contextWindow: string;
  description: string;
  badge?: string;
  category: 'general' | 'reasoning' | 'fast' | 'coding';
}

export interface CloudProviderInfo {
  id: CloudProviderId;
  name: string;
  company: string;
  docsUrl: string;
  apiKeyHelp: string;
  defaultBaseUrl?: string;
}

export const CLOUD_PROVIDERS: Record<CloudProviderId, CloudProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    company: 'Anthropic PBC',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyHelp: 'Enter your Anthropic API key (starts with sk-ant-...)',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI LLC',
    docsUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelp: 'Enter your OpenAI API key (starts with sk-...)',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    company: 'Google LLC',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    apiKeyHelp: 'Enter your Google AI Studio API key (starts with AIzaSy...)',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    company: 'DeepSeek AI',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    apiKeyHelp: 'Enter your DeepSeek API key (starts with sk-...)',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    company: 'Groq Inc.',
    docsUrl: 'https://console.groq.com/keys',
    apiKeyHelp: 'Enter your Groq Cloud API key (starts with gsk_...)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    company: 'OpenRouter',
    docsUrl: 'https://openrouter.ai/keys',
    apiKeyHelp: 'Enter your OpenRouter API key (starts with sk-or-...)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
};

export const CURATED_CLOUD_MODELS: CloudModel[] = [
  // Anthropic
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    contextWindow: '200K',
    description: 'Hybrid reasoning and high-speed autonomous agent intelligence.',
    badge: 'Flagship',
    category: 'reasoning',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    contextWindow: '200K',
    description: 'Industry-leading code generation and nuanced reasoning.',
    badge: 'Popular',
    category: 'coding',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    contextWindow: '200K',
    description: 'Ultra-low latency compact model for instant response cycles.',
    badge: 'Fast',
    category: 'fast',
  },

  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    providerName: 'OpenAI',
    contextWindow: '128K',
    description: 'High-throughput multimodal foundation model with rich world knowledge.',
    badge: 'Multimodal',
    category: 'general',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    contextWindow: '128K',
    description: 'Cost-efficient, fast conversational model for daily development.',
    badge: 'Efficient',
    category: 'fast',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    contextWindow: '200K',
    description: 'Specialized STEM, logic, and deep reasoning model.',
    badge: 'Reasoning',
    category: 'reasoning',
  },

  // Gemini
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    providerId: 'gemini',
    providerName: 'Google',
    contextWindow: '1M',
    description: 'Next-generation low latency speed with 1M context processing.',
    badge: '1M Context',
    category: 'fast',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    providerId: 'gemini',
    providerName: 'Google',
    contextWindow: '2M',
    description: 'Deep analytical intelligence with massive 2M context retention.',
    badge: '2M Context',
    category: 'reasoning',
  },

  // DeepSeek
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    contextWindow: '64K',
    description: '671B MoE architecture with exceptional general language understanding.',
    badge: 'MoE',
    category: 'general',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    contextWindow: '64K',
    description: 'Open chain-of-thought reasoning with step-by-step verification.',
    badge: 'CoT',
    category: 'reasoning',
  },

  // Groq
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    providerId: 'groq',
    providerName: 'Groq / Meta',
    contextWindow: '128K',
    description: 'Hardware-accelerated LPUs delivering near-instant inference.',
    badge: 'LPUs',
    category: 'fast',
  },
];

interface CloudProviderStoreState {
  apiKeys: Record<CloudProviderId, string>;
  customBaseUrls: Record<CloudProviderId, string>;
  selectedCloudModelId: string | null;

  // Actions
  setApiKey: (providerId: CloudProviderId, apiKey: string, baseUrl?: string) => void;
  removeApiKey: (providerId: CloudProviderId) => void;
  selectCloudModel: (modelId: string | null) => void;
  isConfigured: (providerId: CloudProviderId) => boolean;
  getConfiguredModels: () => CloudModel[];
}

export const useCloudProviderStore = create<CloudProviderStoreState>()(
  persist(
    (set, get) => ({
      apiKeys: {
        anthropic: '',
        openai: '',
        gemini: '',
        deepseek: '',
        groq: '',
        openrouter: '',
      },
      customBaseUrls: {
        anthropic: '',
        openai: '',
        gemini: '',
        deepseek: '',
        groq: '',
        openrouter: '',
      },
      selectedCloudModelId: null,

      setApiKey: (providerId, apiKey, baseUrl) => {
        set(state => ({
          apiKeys: { ...state.apiKeys, [providerId]: apiKey.trim() },
          customBaseUrls: baseUrl !== undefined
            ? { ...state.customBaseUrls, [providerId]: baseUrl.trim() }
            : state.customBaseUrls,
        }));
      },

      removeApiKey: (providerId) => {
        set(state => ({
          apiKeys: { ...state.apiKeys, [providerId]: '' },
        }));
      },

      selectCloudModel: (modelId) => {
        set({ selectedCloudModelId: modelId });
      },

      isConfigured: (providerId) => {
        const key = get().apiKeys[providerId];
        return Boolean(key && key.trim().length > 4);
      },

      getConfiguredModels: () => {
        const { isConfigured } = get();
        return CURATED_CLOUD_MODELS.filter(m => isConfigured(m.providerId));
      },
    }),
    {
      name: 'cluaiz_cloud_providers_v1',
    }
  )
);

