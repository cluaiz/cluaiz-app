import { useState } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';

export function VectorSettings() {
    // Vector GGUF State
    const [vectorGpuLayers, setVectorGpuLayers] = useState('-1');
    const [vectorBatchSize, setVectorBatchSize] = useState('512');

    // Vector ONNX State
    const [vectorOnnxProvider, setVectorOnnxProvider] = useState('auto');

    // Vector Processing State
    const [normalizeVectors, setNormalizeVectors] = useState(true);
    const [poolingStrategy, setPoolingStrategy] = useState('mean');
    const [chunkSize, setChunkSize] = useState('512');
    const [chunkOverlap, setChunkOverlap] = useState('64');

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
                    value={vectorGpuLayers}
                    onChange={setVectorGpuLayers}
                />
                <SettingItem
                    label="Batch Size"
                    description="Tokens processed simultaneously during embedding generation."
                    select={[
                        { value: '256', label: '256 Tokens' },
                        { value: '512', label: '512 Tokens (Default)' },
                        { value: '1024', label: '1,024 Tokens' }
                    ]}
                    value={vectorBatchSize}
                    onChange={setVectorBatchSize}
                />
            </SettingSection>

            {/* ONNX Hardware Execution */}
            <SettingSection title="Hardware & Execution (ONNX)">
                <SettingItem
                    label="Hardware Offload"
                    description="Choose where to run ONNX embedding graphs. Auto selects best driver (CUDA/DirectML)."
                    select={[
                        { value: 'auto', label: 'Auto (Best GPU / Accelerator)' },
                        { value: 'cpu', label: 'Host CPU' },
                        { value: 'directml', label: 'DirectML / Windows Graphics' },
                        { value: 'cuda', label: 'NVIDIA CUDA' }
                    ]}
                    value={vectorOnnxProvider}
                    onChange={setVectorOnnxProvider}
                />
            </SettingSection>

            {/* Vector Processing Options */}
            <SettingSection title="Vector Processing (General)">
                <SettingItem
                    label="Normalize Vectors"
                    description="Apply L2 normalization to generated embeddings. Required for cosine similarity."
                    toggle
                    active={normalizeVectors}
                    onToggle={() => setNormalizeVectors(!normalizeVectors)}
                />
                <SettingItem
                    label="Pooling Strategy"
                    description="Method used to aggregate token embeddings into a single sentence vector."
                    select={[
                        { value: 'mean', label: 'Mean Pooling (Standard / Default)' },
                        { value: 'cls', label: 'CLS Token' },
                        { value: 'last', label: 'Last Token' }
                    ]}
                    value={poolingStrategy}
                    onChange={setPoolingStrategy}
                />
                <SettingItem
                    label="RAG Chunk Size"
                    description="Default token chunk length when chunking documents into vector database."
                    select={[
                        { value: '256', label: '256 Tokens (Fine-grained)' },
                        { value: '512', label: '512 Tokens (Balanced)' },
                        { value: '1024', label: '1,024 Tokens (Broad Context)' }
                    ]}
                    value={chunkSize}
                    onChange={setChunkSize}
                />
                <SettingItem
                    label="Chunk Overlap"
                    description="Number of overlapping boundary tokens retained between consecutive chunks."
                    select={[
                        { value: '32', label: '32 Tokens' },
                        { value: '64', label: '64 Tokens (Recommended)' },
                        { value: '128', label: '128 Tokens' }
                    ]}
                    value={chunkOverlap}
                    onChange={setChunkOverlap}
                />
            </SettingSection>
        </div>
    );
}
