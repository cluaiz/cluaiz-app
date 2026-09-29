import React, { useState } from 'react';
import { Terminal, Check, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { formatDuration } from '../hooks/useChatTelemetry';

export interface ToolCallData {
    id: string;
    name: string;
    category?: string;
    arguments?: string;
    result?: string;
    logs?: string[];
    latencyMs?: number;
    status: 'running' | 'completed' | 'failed';
    iconSvg?: string;
}

interface ToolCallAccordionProps {
    toolCall: ToolCallData;
}

export const ToolCallAccordion: React.FC<ToolCallAccordionProps> = ({ toolCall }) => {
    const isRunning = toolCall.status === 'running';
    const [isOpen, setIsOpen] = useState(isRunning);

    // Lifecycle: auto-open while executing; auto-close when completed!
    React.useEffect(() => {
        if (toolCall.status === 'running') {
            setIsOpen(true);
        } else if (toolCall.status === 'completed') {
            setIsOpen(false);
        }
    }, [toolCall.status]);

    const renderIcon = () => {
        if (toolCall.iconSvg) {
            return (
                <div 
                    className="w-4 h-4 flex-shrink-0 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 text-blue-400"
                    dangerouslySetInnerHTML={{ __html: toolCall.iconSvg }} 
                />
            );
        }
        return <Terminal className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    };

    return (
        <details 
            className="my-2 rounded-xl border border-[var(--border-color)] bg-black/20 overflow-hidden font-mono text-xs transition-all"
            open={isOpen}
            onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
        >
            <summary className="p-2.5 px-3 cursor-pointer select-none flex items-center gap-2 font-medium hover:bg-white/[0.02] transition-colors">
                {renderIcon()}
                <span className="font-semibold text-blue-400">{toolCall.name}</span>
                {toolCall.category && (
                    <span className="bg-white/10 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                        {toolCall.category}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {toolCall.status === 'running' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Running...</span>
                        </span>
                    ) : toolCall.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            <span>{formatDuration(toolCall.latencyMs)}</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            Failed
                        </span>
                    )}
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
                </div>
            </summary>

            {/* Live running execution indicator */}
            {toolCall.status === 'running' && (
                <div className="px-3 py-2 text-[11px] font-mono text-blue-400/90 flex items-center gap-2 bg-blue-500/5 border-t border-[var(--border-color)]/30 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>Executing {toolCall.name}...</span>
                </div>
            )}

            <div className="p-3 border-t border-[var(--border-color)]/40 flex flex-col gap-2 bg-black/10">
                {/* Request Arguments */}
                {toolCall.arguments && (
                    <div>
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Request Arguments
                        </div>
                        <pre className="bg-black/40 p-2 rounded border border-white/5 text-[11px] text-zinc-300 max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                            {toolCall.arguments}
                        </pre>
                    </div>
                )}

                {/* Execution Trace Logs */}
                {toolCall.logs && toolCall.logs.length > 0 && (
                    <div>
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Execution Trace
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-white/5 text-[11px] text-zinc-400 font-mono flex flex-col gap-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                            {toolCall.logs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Output Result */}
                {toolCall.result && (
                    <div>
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Output Result
                        </div>
                        <pre className="bg-black/40 p-2 rounded border border-white/5 text-[11px] text-emerald-300 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                            {toolCall.result}
                        </pre>
                    </div>
                )}
            </div>
        </details>
    );
};
