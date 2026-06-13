
export interface ChatRibbonProps {
    tags?: string[] | string;
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
    urgent:   { bg: '#ef4444', text: '#fff' },
    warning:  { bg: '#f59e0b', text: '#000' },
    success:  { bg: '#10b981', text: '#fff' },
    info:     { bg: '#3b82f6', text: '#fff' },
    priority: { bg: '#8b5cf6', text: '#fff' },
    pending:  { bg: '#06b6d4', text: '#fff' },
    hot:      { bg: '#ec4899', text: '#fff' },
    lead:     { bg: '#6366f1', text: '#fff' },
    // Legacy
    red:      { bg: '#ef4444', text: '#fff' },
    yellow:   { bg: '#f59e0b', text: '#000' },
    green:    { bg: '#10b981', text: '#fff' },
    blue:     { bg: '#3b82f6', text: '#fff' },
    purple:   { bg: '#8b5cf6', text: '#fff' },
};

export function ChatRibbon({ tags }: ChatRibbonProps) {
    const activeTag = Array.isArray(tags) ? tags[0] : tags;
    if (!activeTag) return null;

    const [name, colorName] = activeTag.includes(':') ? activeTag.split(':') : [activeTag, 'success'];
    const colors = TAG_COLORS[colorName.toLowerCase()] || TAG_COLORS.success;

    return (
        <div className="absolute left-0 top-0 z-10 pointer-events-none">
            <div
                style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    clipPath: 'polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)',
                    paddingRight: '8px',
                }}
                className="h-[12px] pl-1 flex items-center"
            >
                <span className="text-[7px] font-black uppercase tracking-[0.08em] whitespace-nowrap leading-none">
                    {name}
                </span>
            </div>
        </div>
    );
}
