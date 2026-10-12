import { useState, useEffect } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { systemApi } from '../../api';
import { toast } from '../../components/ui/toast';

// Only settings the engine stores and uses (permission.json). The embedding model's GPU layers and
// batch size are the shared GGUF settings on the Inference page; ONNX settings are on the Inference page too.
interface VectorConfigState {
    vectorizeUserInput: boolean;
    vectorizeAiResponse: boolean;
}

export function VectorSettings() {
    const [config, setConfig] = useState<VectorConfigState>({ vectorizeUserInput: true, vectorizeAiResponse: true });
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    // Initial load from Engine Permissions
    useEffect(() => {
        let isMounted = true;
        systemApi.getPermission()
            .then(res => {
                if (!isMounted || !res?.permission) return;
                const p = res.permission;
                setConfig(prev => ({
                    vectorizeUserInput: p.vectorize_user_input !== undefined ? p.vectorize_user_input : prev.vectorizeUserInput,
                    vectorizeAiResponse: p.vectorize_ai_response !== undefined ? p.vectorize_ai_response : prev.vectorizeAiResponse,
                }));
            })
            .catch(() => {});

        return () => { isMounted = false; };
    }, []);

    // Update Input/AI vectorization preferences in Engine Permissions
    const updatePermissionOption = async (key: 'vectorizeUserInput' | 'vectorizeAiResponse', val: boolean) => {
        setPendingKey(key);
        const apiKey = key === 'vectorizeUserInput' ? 'vectorize_user_input' : 'vectorize_ai_response';
        const label = key === 'vectorizeUserInput' ? 'User input vectorization' : 'AI response vectorization';

        try {
            await toast.promise(
                systemApi.updatePermission({ [apiKey]: val }),
                {
                    loading: `Updating ${label.toLowerCase()}...`,
                    success: `${label} updated`,
                    error: `Failed to update ${label.toLowerCase()}`
                }
            );
            // Only update state after backend returns success
            setConfig(prev => ({ ...prev, [key]: val }));
        } finally {
            setPendingKey(null);
        }
    };

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Vector Processing">
                <SettingItem
                    label="Vectorize User Input"
                    description="Automatically generates vector embeddings for user prompts to enable contextual semantic search."
                    toggle
                    active={config.vectorizeUserInput}
                    onToggle={() => updatePermissionOption('vectorizeUserInput', !config.vectorizeUserInput)}
                    loading={pendingKey === 'vectorizeUserInput'}
                    disabled={pendingKey === 'vectorizeUserInput'}
                />
                <SettingItem
                    label="Vectorize AI Responses"
                    description="Embeds AI assistant responses for memory recall and semantic knowledge indexing."
                    toggle
                    active={config.vectorizeAiResponse}
                    onToggle={() => updatePermissionOption('vectorizeAiResponse', !config.vectorizeAiResponse)}
                    loading={pendingKey === 'vectorizeAiResponse'}
                    disabled={pendingKey === 'vectorizeAiResponse'}
                />
            </SettingSection>
        </div>
    );
}
