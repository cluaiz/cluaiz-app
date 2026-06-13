import { useMemo, useState } from "react";
import { motion, useMotionValue, MotionValue } from "framer-motion";
import { useIconTransform } from "./use-icon-transform";

interface ItemProps {
    app: {
        id: string;
        icon: React.ComponentType<any>;
        bg: string;
        label: string;
    };
    row: number;
    col: number;
    planeX: MotionValue<number>;
    planeY: MotionValue<number>;
    setActiveSkill: (skill: string | null) => void;
    settings: {
        icon: { size: number; margin: number };
        device: { width: number; height: number };
    };
}

export function Item({ row, col, planeX, planeY, app, setActiveSkill, settings }: ItemProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const scale = useMotionValue(0);
    const [isHovered, setIsHovered] = useState(false);

    const { icon } = settings;

    if (!app || !app.id) return null;

    const xOffset = useMemo(() =>
        col * (icon.size + icon.margin) +
        (row % 2) * ((icon.size + icon.margin) / 2)
        , [col, row, icon.size, icon.margin]);
    const yOffset = useMemo(() => row * icon.size, [row, icon.size]);

    useIconTransform({ x, y, scale, planeX, planeY, xOffset, yOffset, settings });

    const IconComponent = app.icon;

    return (
        <div
            className="absolute"
            style={{
                left: xOffset,
                top: yOffset,
                width: icon.size,
                height: icon.size,
                zIndex: isHovered ? 200 : 100
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                style={{
                    x,
                    y,
                    scale,
                    width: icon.size,
                    height: icon.size,
                    borderRadius: "50%",
                    background: app.bg || 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.4)"
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (app.id) setActiveSkill(app.id);
                }}
                whileTap={{ scale: 0.85 }}
            >
                {IconComponent ? (
                    <IconComponent size={icon.size * 0.55} color="white" strokeWidth={2.5} />
                ) : (
                    <div className="w-1/2 h-1/2 rounded-full bg-white/20" />
                )}

                {/* Custom Interactive Tooltip (Fitted beautifully over center) */}
                {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[300] bg-black/90 border border-white/10 px-2.5 py-1 text-[10px] font-black text-white rounded shadow-md whitespace-nowrap pointer-events-none uppercase tracking-wider animate-fade-in">
                        {app.label}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
