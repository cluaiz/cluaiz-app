import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../dropdown/CustomDropdown';
import { ElasticSlider } from '../cursor/ElasticSlider';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const SettingSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] ml-4">{title}</h3>
        <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] rounded-2xl">
            {children}
        </div>
    </div>
);

export type SelectOption = DropdownOption;

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
    children?: React.ReactNode;
    onClick?: () => void;
}

export interface ToggleSwitchProps {
    active: boolean;
    onToggle?: () => void;
    size?: 'sm' | 'md';
    className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    active,
    onToggle,
    size = 'md',
    className
}) => {
    const isSm = size === 'sm';
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
            }}
            className={cn(
                isSm 
                    ? "w-[34px] h-[19px] p-[2px]" 
                    : "w-[44px] h-[24px] p-[3px]",
                "rounded-full flex items-center transition-all duration-200 shrink-0 cursor-pointer select-none",
                active
                    ? "bg-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-[0_0_12px_var(--accent-color)]/20"
                    : "bg-white/10 border border-white/10 hover:bg-white/15",
                className
            )}
        >
            <div
                className={cn(
                    isSm ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]",
                    "rounded-full shadow-md transition-transform duration-200",
                    active 
                        ? (isSm ? "translate-x-[15px] bg-[var(--bg-primary)]" : "translate-x-[20px] bg-[var(--bg-primary)]") 
                        : "translate-x-0 bg-zinc-400"
                )}
            />
        </div>
    );
};

export const SettingItem = ({ label, description, dynamicDescription, toggle = false, action, active = false, onToggle, onClick, icon: Icon, select, value, onChange, children }: SettingItemProps) => {
    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            e.preventDefault();
            onClick();
        } else if (toggle && onToggle) {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "flex items-center justify-between p-6 hover:bg-[var(--text-primary)]/5 transition-all group border-b border-[var(--border-color)] last:border-none cursor-default relative",
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
                <ToggleSwitch active={active} onToggle={onToggle} />
            ) : children ? (
                <div className="w-[250px] shrink-0 flex justify-end">
                    {children}
                </div>
            ) : select ? (
                <div className="w-[250px] shrink-0 flex justify-end">
                    <CustomDropdown
                        options={select}
                        value={value}
                        onChange={onChange}
                        className="w-full"
                    />
                </div>
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

export interface SettingSliderProps {
    label: string;
    description?: string;
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (v: number) => void;
    formatValue?: (v: number) => string;
}

export const SettingSlider = ({
    label,
    description,
    min,
    max,
    step = 1,
    value,
    onChange,
    formatValue
}: SettingSliderProps) => (
    <div className="p-6 border-b border-[var(--border-color)] last:border-none group">
        <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col max-w-sm">
                <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>
                {description && (
                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">{description}</span>
                )}
            </div>
            <span className="text-xs font-mono text-[var(--accent-color)] font-bold px-2 py-0.5 rounded bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20">
                {formatValue ? formatValue(value) : value}
            </span>
        </div>
        <ElasticSlider
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
        />
    </div>
);

