import React from 'react';
import { AlertCircle, ChevronUp, ChevronDown, X, CheckCircle2 } from 'lucide-react';

export interface ErrorMarker {
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber?: number;
    endColumn?: number;
    severity: number;
}

interface ErrorDiagnosticsPopoverProps {
    markers: ErrorMarker[];
    isOpen: boolean;
    onClose: () => void;
    onJumpToMarker: (marker: ErrorMarker) => void;
    onNextError: () => void;
    onPrevError: () => void;
}

export const ErrorDiagnosticsPopover: React.FC<ErrorDiagnosticsPopoverProps> = ({
    markers,
    isOpen,
    onClose,
    onJumpToMarker,
    onNextError,
    onPrevError
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="absolute left-0 mt-1.5 w-80 max-h-72 overflow-hidden rounded-lg shadow-2xl bg-[var(--bg-primary)] border border-red-500/30 z-50 flex flex-col font-mono text-xs">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400">
                    <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span>Diagnostics ({markers.length} {markers.length === 1 ? 'Problem' : 'Problems'})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onPrevError}
                            title="Previous Error (Shift+F8)"
                            className="p-1 rounded hover:bg-white/10 text-red-300 transition-colors cursor-pointer"
                        >
                            <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onNextError}
                            title="Next Error (F8)"
                            className="p-1 rounded hover:bg-white/10 text-red-300 transition-colors cursor-pointer"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
                            className="p-1 rounded hover:bg-white/10 text-red-300 transition-colors cursor-pointer ml-1"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Markers List */}
                <div className="overflow-y-auto max-h-56 custom-scrollbar p-1 divide-y divide-[var(--border-color)]">
                    {markers.length > 0 ? (
                        markers.map((marker, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    onJumpToMarker(marker);
                                    onClose();
                                }}
                                className="w-full text-left p-2 rounded hover:bg-red-500/[0.08] transition-colors cursor-pointer flex flex-col gap-1 group"
                            >
                                <div className="flex items-center justify-between text-[10px] text-red-400">
                                    <span className="font-semibold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                        Ln {marker.startLineNumber}, Col {marker.startColumn}
                                    </span>
                                    <span className="text-[var(--text-muted)] group-hover:text-red-300">Jump →</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-primary)] leading-relaxed break-words font-sans">
                                    {marker.message}
                                </p>
                            </button>
                        ))
                    ) : (
                        <div className="flex items-center justify-center gap-2 p-6 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[11px] font-sans">No problems detected. Code is valid!</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
