import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';

interface WorkspaceHeaderProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    actions?: React.ReactNode;
}

/** Top bar of a full-page workspace: back to chat, its name, and its own actions. */
export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ icon: Icon, title, description, actions }) => {
    const backToChat = () => {
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
    };

    return (
        <header className="h-14 border-b border-[var(--border-color)]/80 bg-[var(--bg-secondary)]/60 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-10">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={backToChat}
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="Back to Chat"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-[var(--border-color)]" />
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)]">
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 uppercase tracking-wider">
                                Workspace
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{description}</p>
                    </div>
                </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
    );
};
