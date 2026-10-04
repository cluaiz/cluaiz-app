import { useState, useEffect } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { systemApi } from '../../api';
import { useInferenceStore } from '../../api/engine/inference';
import { toast } from '../../components/ui/toast';

interface VectorConfigState {
    vectorGpuLayers: string;
    vectorBatchSize: string;
    vectorOnnxProvider: string;
    vectorizeUserInput: boolean;
    vectorizeAiResponse: boolean;
    poolingStrategy: string;
    chunkSize: string;
    chunkOverlap: string;
}

const getInitialVectorConfig = (): VectorConfigState => {
    return {
        vectorGpuLayers: '-1',
        vectorBatchSize: '512',
        vectorOnnxProvider: 'auto',
        vectorizeUserInput: true,
        vectorizeAiResponse: true,
        poolingStrategy: 'mean',
        chunkSize: '512',
        chunkOverlap: '64',
    };
};

export function VectorSettings() {
    const [config, setConfig] = useState<VectorConfigState>(getInitialVectorConfig);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const { gguf, load: loadInference, updateGgufHardware } = useInferenceStore();

    // 1. Initial load from Inference Store & Engine Permissions
    useEffect(() => {
        let isMounted = true;
        loadInference();

        systemApi.getPermission()
            .then(res => {
                if (!isMounted || !res?.permission) return;
                const p = res.permission;
                setConfig(prev => ({
                    ...prev,
                    vectorizeUserInput: p.vectorize_user_input !== undefined ? p.vectorize_user_input : prev.vectorizeUserInput,
                    vectorizeAiResponse: p.vectorize_ai_response !== undefined ? p.vectorize_ai_response : prev.vectorizeAiResponse,
                    poolingStrategy: p.vector_pooling || prev.poolingStrategy,
                    chunkSize: p.rag_chunk_size ? String(p.rag_chunk_size) : prev.chunkSize,
                    chunkOverlap: p.rag_chunk_overlap ? String(p.rag_chunk_overlap) : prev.chunkOverlap,
                }));
            })
            .catch(() => {});

        return () => { isMounted = false; };
    }, [loadInference]);

    // 2. Reactively synchronize GGUF hardware parameters from store
    useEffect(() => {
        if (gguf?.hardware_and_execution) {
            setConfig(prev => ({
                ...prev,
                vectorGpuLayers: String(gguf.hardware_and_execution.n_gpu_layers),
                vectorBatchSize: String(gguf.hardware_and_execution.batch_size),
            }));
        }
    }, [gguf]);

    // Update GGUF layers & batch size using authoritative schema and store persistence
    const updateGguf = (key: 'vectorGpuLayers' | 'vectorBatchSize', val: string) => {
        setPendingKey(key);
        const numVal = parseInt(val, 10);
        try {
            if (key === 'vectorGpuLayers') {
                updateGgufHardware('n_gpu_layers', numVal);
            } else {
                updateGgufHardware('batch_size', numVal);
            }
            setConfig(prev => ({ ...prev, [key]: val }));
        } finally {
            setPendingKey(null);
        }
    };

    // Update ONNX Execution Provider
    const updateOnnx = (provider: string) => {
        setConfig(prev => ({ ...prev, vectorOnnxProvider: provider }));
        toast.success('ONNX execution provider saved');
    };

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

    // Update RAG parameters in Engine Permissions (permission.json)
    const updateRagOption = async (key: 'poolingStrategy' | 'chunkSize' | 'chunkOverlap', val: string) => {
        setPendingKey(key);
        const permKey = key === 'poolingStrategy' ? 'vector_pooling' : key === 'chunkSize' ? 'rag_chunk_size' : 'rag_chunk_overlap';
        const labelMap: Record<string, string> = {
            poolingStrategy: 'Pooling strategy',
            chunkSize: 'RAG chunk size',
            chunkOverlap: 'RAG chunk overlap'
        };
        const label = labelMap[key] || 'RAG parameter';

        try {
            await toast.promise(
                systemApi.updatePermission({ [permKey]: key === 'poolingStrategy' ? val : parseInt(val, 10) }),
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
            {/* GGUF Hardware Execution */}
            <SettingSection title="Hardware & Execution (GGUF)">
                <SettingItem
                    label="GPU Layers (n_gpu_layers)"
                    description="Layers offloaded to GPU for embedding model. -1 offloads all layers."
                    select={[
                        { value: '-1', label: 'All Layers (-1 / Full Offload)' },
                        { value: '0', label: 'CPU Only (0 Layers)' },
                        { value: '16', label: '16 Layers' },
                        { value: '33', label: '33 Layers' }
                    ]}
                    value={config.vectorGpuLayers}
                    onChange={(val) => updateGguf('vectorGpuLayers', val)}
                    loading={pendingKey === 'vectorGpuLayers'}
                    disabled={pendingKey === 'vectorGpuLayers'}
                />
                <SettingItem
                    label="Batch Size"
                    description="Tokens processed simultaneously during embedding generation."
                    select={[
                        { value: '256', label: '256 Tokens' },
                        { value: '512', label: '512 Tokens (Default)' },
                        { value: '1024', label: '1,024 Tokens' }
                    ]}
                    value={config.vectorBatchSize}
                    onChange={(val) => updateGguf('vectorBatchSize', val)}
                    loading={pendingKey === 'vectorBatchSize'}
                    disabled={pendingKey === 'vectorBatchSize'}
                />
            </SettingSection>

            {/* ONNX Hardware Execution */}
            <SettingSection title="Hardware & Execution (ONNX)">
                <SettingItem
                    label="Hardware Offload"
                    description="Choose where to run ONNX embedding graphs. Auto selects best accelerator."
                    select={[
                        { value: 'auto', label: 'Auto (Best GPU / Accelerator)' },
                        { value: 'cpu', label: 'Host CPU' },
                        { value: 'directml', label: 'DirectML / Windows Graphics' },
                        { value: 'cuda', label: 'NVIDIA CUDA' }
                    ]}
                    value={config.vectorOnnxProvider}
                    onChange={(val) => updateOnnx(val)}
                    loading={pendingKey === 'vectorOnnxProvider'}
                    disabled={pendingKey === 'vectorOnnxProvider'}
                />
            </SettingSection>

            {/* Vector Processing Options */}
            <SettingSection title="Vector Processing (General)">
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
                <SettingItem
                    label="Pooling Strategy"
                    description="Method used to aggregate token embeddings into a single sentence vector."
                    select={[
                        { value: 'mean', label: 'Mean Pooling (Standard / Default)' },
                        { value: 'cls', label: 'CLS Token' },
                        { value: 'last', label: 'Last Token' }
                    ]}
                    value={config.poolingStrategy}
                    onChange={(val) => updateRagOption('poolingStrategy', val)}
                    loading={pendingKey === 'poolingStrategy'}
                    disabled={pendingKey === 'poolingStrategy'}
                />
                <SettingItem
                    label="RAG Chunk Size"
                    description="Default token chunk length when chunking documents into vector database."
                    select={[
                        { value: '256', label: '256 Tokens (Fine-grained)' },
                        { value: '512', label: '512 Tokens (Balanced)' },
                        { value: '1024', label: '1,024 Tokens (Broad Context)' }
                    ]}
                    value={config.chunkSize}
                    onChange={(val) => updateRagOption('chunkSize', val)}
                    loading={pendingKey === 'chunkSize'}
                    disabled={pendingKey === 'chunkSize'}
                />
                <SettingItem
                    label="Chunk Overlap"
                    description="Number of overlapping boundary tokens retained between consecutive chunks."
                    select={[
                        { value: '32', label: '32 Tokens' },
                        { value: '64', label: '64 Tokens (Recommended)' },
                        { value: '128', label: '128 Tokens' }
                    ]}
                    value={config.chunkOverlap}
                    onChange={(val) => updateRagOption('chunkOverlap', val)}
                    loading={pendingKey === 'chunkOverlap'}
                    disabled={pendingKey === 'chunkOverlap'}
                />
            </SettingSection>

        </div>
    );
}
