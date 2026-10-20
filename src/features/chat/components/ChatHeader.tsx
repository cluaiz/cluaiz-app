import React, { useRef } from 'react';

interface ChatHeaderProps {
    activeChatData: any;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    isFilterOpen: boolean;
    setIsFilterOpen: (open: boolean) => void;
    activeFilter: string;
    setActiveFilter: (filter: string) => void;
    pinnedMessages?: any[];
    onUnpin?: (index: number) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    activeChatData,
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    activeFilter,
    setActiveFilter,
    pinnedMessages = [],
    onUnpin
}) => {
    return (
        <>
            {activeChatData ? (
                <div
                    className="h-16 border-b border-[var(--border-color)] px-4 md:px-6 flex items-center justify-between bg-[var(--bg-primary)] flex-shrink-0 relative z-10"
                    style={{ borderStyle: 'var(--border-style)' }}
                >
                    {/* Bottom Fade-Out Shadow Effect */}
                    <div className="absolute left-0 right-0 h-8 -bottom-8 bg-gradient-to-b from-[var(--bg-primary)] to-transparent pointer-events-none z-10" />

                    <div className="flex items-center gap-3">
                        <span className="font-bold text-[var(--text-primary)] text-sm tracking-wide truncate max-w-lg">{activeChatData.name}</span>
                    </div>
                </div>
            ) : (
                <div

                >

                </div>
            )}

            {/* Pinned Messages Bar */}
            {pinnedMessages && pinnedMessages.length > 0 && (
                <div className="bg-[var(--bg-primary)]/50  px-4 py-1.5 flex flex-row items-center gap-3 shadow-[0_4px_10px_rgba(0,0,0,0.05)] relative z-0">
                    {/* Removed internal shadow to prevent clipping */}

                    <div className="text-[var(--accent-color)] flex-shrink-0" title="Pinned Messages">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                        {pinnedMessages.map((msg, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 rounded-md shrink-0 max-w-[200px] group relative hover:border-[var(--text-muted)] transition-colors overflow-hidden">
                                <span className="text-[11px] text-[var(--text-primary)] truncate font-medium leading-tight">{msg.text}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUnpin?.(msg.originalIndex);
                                    }}
                                    className="absolute top-0 right-0 h-full px-1.5 bg-gradient-to-l from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center"
                                    title="Unpin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};
