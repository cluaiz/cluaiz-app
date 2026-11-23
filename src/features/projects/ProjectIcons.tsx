import React from 'react';
import {
    Folder,
    FolderCode,
    FolderGit2,
    Code2,
    Terminal,
    Cpu,
    Database,
    BookOpen,
    Briefcase,
    Globe,
    Layers,
    Sparkles,
    Wrench,
    FileText,
    Shield,
    Rocket,
    Brain,
    Compass,
    Boxes,
    Zap,
    Server,
    LineChart,
    Microscope,
    PenTool,
} from 'lucide-react';

export const CHAT_PROJECT_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
    Folder,
    FolderCode,
    FolderGit2,
    Code2,
    Terminal,
    Cpu,
    Database,
    BookOpen,
    Briefcase,
    Globe,
    Layers,
    Sparkles,
    Wrench,
    FileText,
    Shield,
    Rocket,
    Brain,
    Compass,
    Boxes,
    Zap,
    Server,
    LineChart,
    Microscope,
    PenTool,
};

export const CHAT_PROJECT_ICON_KEYS = Object.keys(CHAT_PROJECT_ICONS);

export function ProjectIcon({
    name,
    className = 'w-4 h-4',
    size,
}: {
    name?: string;
    className?: string;
    size?: number;
}) {
    const Comp = (name && CHAT_PROJECT_ICONS[name]) || Folder;
    return <Comp className={className} size={size} />;
}

export function ProjectIconPicker({
    value,
    onChange,
    columns = 8,
}: {
    value: string;
    onChange: (iconName: string) => void;
    columns?: 6 | 8 | 12;
}) {
    const gridClass =
        columns === 6
            ? 'grid-cols-6'
            : columns === 12
                ? 'grid-cols-6 sm:grid-cols-12'
                : 'grid-cols-6 sm:grid-cols-8';

    return (
        <div className={`grid ${gridClass} gap-1.5 p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]`}>
            {CHAT_PROJECT_ICON_KEYS.map((key) => {
                const selected = value === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        title={key}
                        className={`h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                            selected
                                ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border-[var(--accent-color)] shadow-xs'
                                : 'bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <ProjectIcon name={key} className="w-4 h-4" />
                    </button>
                );
            })}
        </div>
    );
}
