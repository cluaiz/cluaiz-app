import React, { useState } from 'react';
import { Terminal, Check, Loader2, ChevronDown } from 'lucide-react';
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
    const userInteractedRef = React.useRef(false);

    // Lifecycle: auto-open while executing; auto-close when completed unless user interacted!
    React.useEffect(() => {
        if (toolCall.status === 'running') {
            setIsOpen(true);
            userInteractedRef.current = false;
        } else if (toolCall.status === 'completed') {
            if (!userInteractedRef.current) {
                setIsOpen(false);
            }
        }
    }, [toolCall.status]);

    const categoryColor = toolCall.category === 'plugin'
        ? 'text-amber-400'
        : toolCall.category === 'mcp_tools' || toolCall.category === 'mcp'
            ? 'text-cyan-400'
            : 'text-emerald-400';

    const renderIcon = () => {
        if (toolCall.iconSvg) {
            return (
                <img 
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(toolCall.iconSvg)}`}
                    alt={toolCall.name}
                    className={`w-4 h-4 flex-shrink-0 object-contain ${categoryColor}`}
                />
            );
        }
        return <Terminal className={`w-4 h-4 ${categoryColor} flex-shrink-0`} />;
    };

    return (
        <div className="w-full my-1 select-none font-mono text-left" style={{ fontSize: 'calc(var(--chat-bubble-font-size, 14.5px) * 0.88)' }}>
            <button
                type="button"
                onClick={() => {
                    userInteractedRef.current = true;
                    setIsOpen(prev => !prev);
                }}
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer group/tool"
                style={{ fontSize: 'inherit' }}
            >
                {renderIcon()}
                <span className="font-semibold text-zinc-300 group-hover/tool:text-white">{toolCall.name}</span>
                {toolCall.category && toolCall.category !== 'function' && (
                    <span className="text-zinc-500 opacity-80" style={{ fontSize: '0.85em' }}>
                        ({toolCall.category})
                    </span>
                )}
                {toolCall.status === 'running' ? (
                    <span className="inline-flex items-center gap-1 text-blue-400 animate-pulse ml-1" style={{ fontSize: '0.85em' }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Running...</span>
                    </span>
                ) : toolCall.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-zinc-500 ml-1" style={{ fontSize: '0.85em' }}>
                        <Check className="w-3 h-3 text-emerald-400" />
                        {toolCall.latencyMs ? <span>{formatDuration(toolCall.latencyMs)}</span> : null}
                    </span>
                ) : (
                    <span className="text-rose-400 ml-1" style={{ fontSize: '0.85em' }}>Failed</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 group-hover/tool:text-zinc-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Live running execution indicator */}
            {toolCall.status === 'running' && (
                <div className="border-l-2 border-blue-500/40 pl-3.5 my-1.5 py-1 font-mono text-blue-400/90 flex items-center gap-2 animate-pulse" style={{ fontSize: '0.9em' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>Executing {toolCall.name}...</span>
                </div>
            )}

            {isOpen && (
                <div className="border-l-2 border-zinc-700/60 pl-3.5 my-2 flex flex-col gap-2 font-mono select-text" style={{ fontSize: 'inherit' }}>
                    {/* Request Arguments */}
                    {toolCall.arguments && (
                        <div>
                            <div className="font-semibold text-zinc-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.8em' }}>
                                Arguments
                            </div>
                            <pre className="bg-black/30 p-2 rounded border border-white/5 text-zinc-300 max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ fontSize: '0.9em' }}>
                                {toolCall.arguments}
                            </pre>
                        </div>
                    )}

                    {/* Execution Trace Logs */}
                    {toolCall.logs && toolCall.logs.length > 0 && (
                        <div>
                            <div className="font-semibold text-zinc-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.8em' }}>
                                Trace
                            </div>
                            <div className="bg-black/20 p-2 rounded border border-white/5 text-zinc-400 font-mono flex flex-col gap-0.5 max-h-32 overflow-y-auto" style={{ fontSize: '0.9em' }}>
                                {toolCall.logs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Output Result */}
                    {toolCall.result && (
                        <div>
                            <div className="font-semibold text-zinc-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.8em' }}>
                                Result
                            </div>
                            <pre className="bg-black/30 p-2 rounded border border-white/5 text-emerald-400/90 max-h-48 overflow-y-auto whitespace-pre-wrap" style={{ fontSize: '0.9em' }}>
                                {toolCall.result}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
