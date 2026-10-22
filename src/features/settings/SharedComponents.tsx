import { ChevronRight, Loader2 } from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';
import { ElasticSlider } from '../../components/ui/cursor/ElasticSlider';
import { ToggleSwitch, ToggleSwitchProps } from '../../components/ui/ToggleSwitch';

export { ToggleSwitch, CustomDropdown };
export type { ToggleSwitchProps, DropdownOption };

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

export type SelectOption = DropdownOption;

interface SettingItemProps {
    label: string;
    description: string;
    dynamicDescription?: string;
    toggle?: boolean;
    action?: string;
    active?: boolean;
    loading?: boolean;
    disabled?: boolean;
    onToggle?: () => void;
    icon?: React.ComponentType<any>;
    select?: string[] | SelectOption[];
    value?: string;
    onChange?: (v: string) => void;
    children?: React.ReactNode;
    onClick?: () => void;
    allowCustomInput?: boolean;
    customInputPlaceholder?: string;
    previewFont?: boolean;
}

export const SettingItem = ({
    label,
    description,
    dynamicDescription,
    toggle = false,
    action,
    active = false,
    loading = false,
    disabled = false,
    onToggle,
    onClick,
    icon: Icon,
    select,
    value,
    onChange,
    children,
    allowCustomInput,
    customInputPlaceholder,
    previewFont = false
}: SettingItemProps) => {
    const isBlocked = disabled || loading;
    const handleClick = (e: React.MouseEvent) => {
        if (isBlocked) return;
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
                "flex items-center justify-between p-6 hover:bg-[var(--text-primary)]/5 transition-all group border-b border-[var(--border-color)] last:border-none relative first:rounded-t-2xl last:rounded-b-2xl",
                (toggle || onClick || action) && !isBlocked ? "cursor-pointer" : "cursor-default",
                isBlocked && "opacity-75 cursor-not-allowed"
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

            <div className="flex items-center gap-3">
                {loading && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--accent-color)] animate-pulse">
                        <Loader2 size={12} className="animate-spin" />
                        Saving...
                    </span>
                )}
                {toggle ? (
                    <ToggleSwitch active={active} onToggle={onToggle} loading={loading} disabled={disabled} />
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
                            allowCustomInput={allowCustomInput}
                            customInputPlaceholder={customInputPlaceholder}
                            className="w-full"
                            loading={loading}
                            disabled={disabled}
                            floating={true}
                            previewFont={previewFont}
                        />
                    </div>
                ) : action ? (
                    <button
                        type="button"
                        disabled={isBlocked}
                        className="text-[10px] font-black text-[var(--accent-color)] uppercase tracking-widest hover:opacity-80 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {action}
                    </button>
                ) : (
                    <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                )}
            </div>
        </div>
    );
};

export const ThemeCard = ({
    label,
    icon,
    emoji,
    active = false,
    onClick
}: {
    label: string;
    icon?: React.ReactNode;
    emoji?: string;
    active?: boolean;
    onClick?: () => void;
}) => (
    <div 
        onClick={onClick}
        className={cn(
            "flex-1 p-5 bg-[var(--bg-secondary)]/50 border rounded-xl cursor-pointer transition-all flex flex-col items-center gap-3 group relative overflow-hidden select-none",
            active
                ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 shadow-sm"
                : "border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:bg-[var(--bg-secondary)]/70"
        )}
    >
        <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            active
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
        )}>
            {icon ? icon : <span className="text-base">{emoji || "🎨"}</span>}
        </div>
        <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider text-center transition-colors truncate w-full",
            active
                ? "text-[var(--accent-color)]"
                : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
        )}>
            {label}
        </span>
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

