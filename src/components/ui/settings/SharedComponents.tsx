import React from 'react';
import { ChevronRight } from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const SettingSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] ml-4">{title}</h3>
        <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] rounded-2xl overflow-hidden">
            {children}
        </div>
    </div>
);

export interface SelectOption {
    label: string;
    value: string;
}

interface SettingItemProps {
    label: string;
    description: string;
    dynamicDescription?: string;
    toggle?: boolean;
    action?: string;
    active?: boolean;
    onToggle?: () => void;
    icon?: React.ComponentType<any>;
    select?: string[] | SelectOption[];
    value?: string;
    onChange?: (v: string) => void;
}

export const SettingItem = ({ label, description, dynamicDescription, toggle = false, action, active = false, onToggle, icon: Icon, select, value, onChange }: SettingItemProps) => {
    const handleClick = (e: React.MouseEvent) => {
        if (toggle && onToggle) {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "flex items-center justify-between p-6 hover:bg-[var(--text-primary)]/5 transition-all group border-b border-[var(--border-color)] last:border-none cursor-default",
                toggle && "cursor-pointer"
            )}
        >
            <div className="flex items-center gap-4">
                {Icon && (
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", active ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "bg-[var(--bg-primary)]/40 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]")}>
                        <Icon size={20} />
                    </div>
                )}
                <div className="flex flex-col max-w-sm">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">{description}</span>
                    {dynamicDescription && (
                        <span className="text-[10px] text-[var(--accent-color)] mt-1.5 font-medium italic opacity-90 leading-tight">
                            ↳ {dynamicDescription}
                        </span>
                    )}
                </div>
            </div>
            {toggle ? (
                <button type="button" className={cn("w-10 h-5 rounded-full relative transition-all pointer-events-none", active ? "bg-[var(--accent-color)]" : "bg-[var(--border-color)]")}>
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", active ? "left-6" : "left-1")} />
                </button>
            ) : select ? (
                <select
                    value={value || ''}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                >
                    {select.map((opt) => {
                        const isObj = typeof opt === 'object';
                        const val = isObj ? (opt as SelectOption).value : opt as string;
                        const lbl = isObj ? (opt as SelectOption).label : opt as string;
                        return <option key={val} value={val}>{lbl}</option>;
                    })}
                </select>
            ) : action ? (
                <button type="button" className="text-[10px] font-black text-[var(--accent-color)] uppercase tracking-widest hover:opacity-80 transition-opacity">{action}</button>
            ) : (
                <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
            )}
        </div>
    );
};

export const ThemeCard = ({ label, emoji = "👾", active = false, onClick }: { label: string, emoji?: string, active?: boolean, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={cn(
            "flex-1 p-6 bg-[var(--bg-secondary)]/40 border rounded-3xl cursor-pointer transition-all flex flex-col items-center gap-4 group",
            active ? "border-[var(--accent-color)] bg-[var(--accent-color)]/5" : "border-[var(--border-color)] hover:border-[var(--accent-color)]/30"
        )}
    >
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-black/10 dark:bg-black/40", active ? "text-[var(--accent-color)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]")}>
            <span className="text-lg">{emoji}</span>
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-widest text-center", active ? "text-[var(--accent-color)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]")}>{label}</span>
    </div>
);

export const InputGroup = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col gap-2 p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-3xl focus-within:border-[var(--accent-color)]/30 transition-all">
        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{label}</label>
        <input
            type="text"
            defaultValue={value}
            className="bg-transparent border-none outline-none text-[var(--text-primary)] text-sm font-bold"
        />
    </div>
);
