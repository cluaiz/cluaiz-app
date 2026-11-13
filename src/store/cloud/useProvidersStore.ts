import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { providersApi, type ModelProvider } from '../../api/engine/providers';
import { errorMessage } from '../../api/client/errors';
import { onToolkitHistory, setToolkitParams, toolkitParam } from '../../features/extensions/toolkitNavigation';

interface ProvidersState {
    providers: ModelProvider[];
    loading: boolean;
    error: string | null;
    /** The provider open in the Toolkit's content pane; `NEW_PROVIDER` opens the add form */
    selected: string | null;
    /**
     * A provider's chat model chosen for chats (`<provider>/<model>`), sent as the request's model.
     * The Engine's saved chat slot holds installed models only, so this choice is kept by the App.
     */
    chatModel: string | null;
    refresh: () => Promise<void>;
    /** Opens a provider (and one of its models) in the content pane, recorded in the URL */
    select: (name: string | null, model?: string) => void;
    setChatModel: (model: string | null) => void;
}

export const NEW_PROVIDER = '\u0000new';
let reads = 0;
/** The open provider lives in the URL: provider=<name>, or provider=new for the custom form */
const selectedFromUrl = () => { const value = toolkitParam('provider'); return value === 'new' ? NEW_PROVIDER : value || null; };

/** The Engine's model providers; the Engine's providers.json is the only source of providers and keys. */
export const useProvidersStore = create<ProvidersState>()(persist((set) => ({
    providers: [],
    loading: false,
    error: null,
    selected: selectedFromUrl(),
    chatModel: null,
    refresh: async () => {
        const read = ++reads;
        set({ loading: true, error: null });
        try {
            const providers = await providersApi.list();
            if (read === reads) set({ providers, loading: false });
        } catch (failure) {
            if (read === reads) set({ error: errorMessage(failure), loading: false });
        }
    },
    select: (selected, model) => {
        setToolkitParams({ provider: selected === NEW_PROVIDER ? 'new' : selected, model: model ?? null });
        set({ selected });
    },
    setChatModel: (chatModel) => set({ chatModel }),
}), { name: 'cluaiz-provider-chat-model', partialize: state => ({ chatModel: state.chatModel }) }));

/** A chat model name that belongs to a saved provider (`<provider>/<model>`). */
export const isProviderModel = (id: string | null | undefined, providers: ModelProvider[]) =>
    Boolean(id && providers.some(item => id.startsWith(`${item.name}/`)));

/** Chat models of every provider, for model pickers. A model listed without a kind is a chat model. */
export const providerChatModels = (providers: ModelProvider[]) =>
    providers.flatMap(item => item.models.filter(model => !model.kind || model.kind === 'chat')
        .map(model => ({ ...model, provider: item.name })));

/** The model a chat request runs on: the chosen provider model while it is still listed, else the Engine's chat model. */
export function chatRequestModel(engineModel: string | null | undefined): string | undefined {
    const { chatModel, providers } = useProvidersStore.getState();
    const listed = chatModel && providerChatModels(providers).some(model => model.model === chatModel);
    return (listed ? chatModel : engineModel) || undefined;
}

onToolkitHistory(() => useProvidersStore.setState({ selected: selectedFromUrl() }));
