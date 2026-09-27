import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, RefreshCw, Copy, Check, Search, Zap, FileCode, MessageSquare, Dna, FileText } from 'lucide-react';
import { InstalledModelDetail } from '../../store/engine/useEngineStore';
import { useConnectionStore } from '../../store/engine/useConnectionStore';

interface ModelInspectorModalProps {
    isOpen: boolean;
    model: InstalledModelDetail | null;
    onClose: () => void;
}

const LINE_HEIGHT = 22;
const BUFFER = 30;

function VirtualCodeViewer({ code, searchQuery }: { code: string; searchQuery: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);

    const lines = useMemo(() => code.split('\n'), [code]);
    const totalLines = lines.length;
    const totalHeight = totalLines * LINE_HEIGHT;

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setViewportHeight(entry.contentRect.height);
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - BUFFER);
    const endIndex = Math.min(totalLines, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + BUFFER);
    const visibleLines = lines.slice(startIndex, endIndex);

    const topSpacer = startIndex * LINE_HEIGHT;
    const lowerSearch = searchQuery.trim().toLowerCase();

    return (
        <div
            ref={containerRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            className="flex-1 overflow-auto bg-[var(--bg-primary)] font-mono text-xs leading-relaxed select-text relative custom-scrollbar"
        >
            <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
                <div style={{ transform: `translateY(${topSpacer}px)`, width: '100%' }}>
                    {visibleLines.map((line, offset) => {
                        const lineIdx = startIndex + offset;
                        const isMatch = lowerSearch && line.toLowerCase().includes(lowerSearch);
                        return (
                            <div
                                key={lineIdx}
                                style={{ height: `${LINE_HEIGHT}px` }}
                                className={`flex items-center px-4 hover:bg-[var(--bg-secondary)]/50 transition-colors ${
                                    isMatch ? 'bg-[var(--accent-color)]/20 border-l-2 border-[var(--accent-color)] font-semibold' : ''
                                }`}
                            >
                                <span className="select-none pr-4 text-right text-[var(--text-muted)] text-[11px] w-12 shrink-0 font-mono">
                                    {lineIdx + 1}
                                </span>
                                <span className="whitespace-pre text-[var(--text-primary)] font-mono truncate">
                                    {line}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function ModelInspectorModal({ isOpen, model, onClose }: ModelInspectorModalProps) {
    const [activeTab, setActiveTab] = useState<string>('probe');
    const [rawHeaderData, setRawHeaderData] = useState<string | null>(null);
    const [manifestData, setManifestData] = useState<string | null>(null);
    const [dnaData, setDnaData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const { getBaseUrl } = useConnectionStore();

    useEffect(() => {
        if (isOpen && model) {
            setActiveTab('probe');
            setRawHeaderData(null);
            setManifestData(null);
            setDnaData(null);
            setSearchQuery('');
        }
    }, [isOpen, model]);

    if (!isOpen || !model) return null;

    const primaryFile = model.files?.find((f) => f.is_primary)?.name || model.files?.[0]?.name || model.id;
    const hasChatTemplate = Boolean(model.metadata?.chat_template && model.metadata.chat_template.trim() !== '');

    // 1. Probed Header Data JSON
    const probedData = {
        model_id: model.id,
        architecture: model.metadata?.architecture || 'unknown',
        supported_tasks: model.supported_tasks || [],
        format: (model.format_type || 'gguf').toUpperCase(),
        quantization: model.metadata?.quantization || 'N/A',
        bit_precision: model.metadata?.bit_depth || 'N/A',
        parameters: model.metadata?.parameters || 'Unknown',
        context_window: model.metadata?.context_window || 'N/A',
        chat_template_available: hasChatTemplate,
        storage_path: model.local_dir || '',
        files: model.files || [],
        probed_timestamp: new Date().toISOString()
    };

    // Fetch Inspect Raw Header
    const fetchRawHeader = async () => {
        setIsLoading(true);
        try {
            const baseUrl = getBaseUrl();
            const res = await fetch(`${baseUrl}/v1/models/${encodeURIComponent(model.id)}/inspect_raw_header`);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            setRawHeaderData(JSON.stringify(data, null, 2));
        } catch (e: any) {
            setRawHeaderData(`// Error fetching raw binary header: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch Extra Component File (manifest / dna)
    const fetchExtraFile = async (filename: string, setter: (val: string) => void) => {
        setIsLoading(true);
        try {
            const baseUrl = getBaseUrl();
            const res = await fetch(
                `${baseUrl}/api/components/file?component_type=model&component_id=${encodeURIComponent(model.id)}&file_path=${encodeURIComponent(filename)}`
            );
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            if (data.status === 'success' && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    setter(JSON.stringify(parsed, null, 2));
                } catch {
                    setter(data.content);
                }
            } else {
                setter(data.message || '// File not found or empty.');
            }
        } catch (e: any) {
            setter(`// Error fetching ${filename}: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabSwitch = (tab: string) => {
        setActiveTab(tab);
        if (tab === 'raw_header' && !rawHeaderData) {
            fetchRawHeader();
        } else if (tab === 'manifest' && !manifestData) {
            fetchExtraFile('model_manifest.json', setManifestData);
        } else if (tab === 'dna' && !dnaData) {
            fetchExtraFile('structural_dna.json', setDnaData);
        }
    };

    // Current Code String based on active tab
    const getCurrentCode = () => {
        switch (activeTab) {
            case 'probe':
                return JSON.stringify(probedData, null, 2);
            case 'raw_header':
                return rawHeaderData || '// Click Reload to fetch raw binary header...';
            case 'template':
                return model.metadata?.chat_template || '// No chat template specified for this model.';
            case 'manifest':
                return manifestData || '// Loading model_manifest.json...';
            case 'dna':
                return dnaData || '// Loading structural_dna.json...';
            default:
                return '';
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getCurrentCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExport = () => {
        const code = getCurrentCode();
        const blob = new Blob([code], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${model.id}_${activeTab}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filter code lines if search query is provided
    const rawCode = getCurrentCode();
    const codeLines = rawCode.split('\n');

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden shadow-2xl z-10"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                                {primaryFile}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)]">
                                {model.format_type?.toUpperCase()}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Top Tab Bar */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30 gap-4 flex-nowrap min-w-0">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap shrink min-w-0">
                            <button
                                type="button"
                                onClick={() => handleTabSwitch('probe')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeTab === 'probe'
                                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <Zap size={13} />
                                <span>Binary Header Probe</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTabSwitch('raw_header')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeTab === 'raw_header'
                                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <FileCode size={13} />
                                <span>Inspect Raw Header</span>
                            </button>

                            {hasChatTemplate && (
                                <button
                                    type="button"
                                    onClick={() => handleTabSwitch('template')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                        activeTab === 'template'
                                            ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    <MessageSquare size={13} />
                                    <span>Chat Template</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleTabSwitch('manifest')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeTab === 'manifest'
                                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <FileText size={13} />
                                <span>Model Manifest</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTabSwitch('dna')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeTab === 'dna'
                                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <Dna size={13} />
                                <span>Structural DNA</span>
                            </button>
                        </div>

                        {/* Right Actions: Reload, Copy, Export */}
                        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                            {activeTab === 'raw_header' && (
                                <button
                                    type="button"
                                    onClick={fetchRawHeader}
                                    disabled={isLoading}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] text-xs font-medium hover:bg-[var(--border-color)] cursor-pointer whitespace-nowrap"
                                    title="Reload Header"
                                >
                                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                                    <span>Reload</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] hover:bg-[var(--border-color)] cursor-pointer whitespace-nowrap"
                                title="Copy JSON"
                            >
                                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExport}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-xs font-semibold hover:bg-[var(--accent-color)]/25 cursor-pointer whitespace-nowrap"
                            >
                                <Download size={12} />
                                <span>Export</span>
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="px-6 py-2 border-b border-[var(--border-color)]/60 bg-[var(--bg-primary)]/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
                            <span>
                                {activeTab === 'probe' && 'Hardware Probe & Binary Structure Details'}
                                {activeTab === 'raw_header' && (
                                    <>
                                        Zero-load Binary Parse — Raw{' '}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)]">
                                            {model.format_type?.toUpperCase()}
                                        </span>{' '}
                                        header read directly from local storage
                                    </>
                                )}
                                {activeTab === 'template' && 'Jinja2 Prompt Formatter template extracted from binary'}
                                {activeTab === 'manifest' && 'Local Manifest: model_manifest.json'}
                                {activeTab === 'dna' && 'Structural DNA: structural_dna.json'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 w-64">
                            <Search size={12} className="text-[var(--text-muted)]" />
                            <input
                                type="text"
                                placeholder="Search in view..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-xs text-[var(--text-primary)] font-mono w-full"
                            />
                            {searchQuery && (
                                <button type="button" onClick={() => setSearchQuery('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Code Display Area with Zero-Hang Virtualization */}
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--accent-color)] bg-[var(--bg-primary)]">
                            <div className="w-7 h-7 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-[var(--text-muted)] font-mono">Reading binary from disk...</span>
                        </div>
                    ) : (
                        <VirtualCodeViewer code={rawCode} searchQuery={searchQuery} />
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
