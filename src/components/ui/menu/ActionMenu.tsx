import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import {
    Activity,  LayoutDashboard, Zap, Database, Terminal, Server,
    Shield, Palette, Bell, Keyboard, Home, Info, HelpCircle, Mail, MessageSquare, X, Settings
} from 'lucide-react';
import { Item } from "./Item";
import { AiFillGithub, AiFillSound } from 'react-icons/ai';

// Real Apps list ported 100% from old codebase
const appsList = [
    { id: 'home', icon: Home, bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', label: 'Home' },
    { id: 'app_chat', icon: MessageSquare, bg: 'linear-gradient(135deg, #10b981, #34d399)', label: 'New Chat' },
    { id: 'dashboard', icon: LayoutDashboard, bg: 'linear-gradient(135deg, #6366f1, #818cf8)', label: 'Dashboard' },
    { id: 'github', icon: AiFillGithub, bg: 'linear-gradient(135deg, #4b5563, #6b7280)', label: 'GitHub' },
    { id: 'skill', icon: Zap, bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', label: 'Skills' },
    { id: 'database', icon: Database, bg: 'linear-gradient(135deg, #06b6d4, #22d3ee)', label: 'Database' },
    { id: 'system_monitor', icon: Activity, bg: 'linear-gradient(135deg, #ef4444, #f87171)', label: 'System Monitor' },
    { id: 'cpu_logs', icon: Terminal, bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', label: 'CPU Logs' },
    { id: 'cluaize_control', icon: Server, bg: 'linear-gradient(135deg, #14b8a6, #2dd4bf)', label: 'cluaize Control' },
    { id: 'cluaizd_daemon', icon: Server, bg: 'linear-gradient(135deg, #f97316, #fb923c)', label: 'cluaizd Daemon' },
    { id: 'settings_theme', icon: Palette, bg: 'linear-gradient(135deg, #ec4899, #f472b6)', label: 'Theme Settings' },
    { id: 'settings_shortcuts', icon: Keyboard, bg: 'linear-gradient(135deg, #8b5cf6, #c084fc)', label: 'Shortcuts Settings' },
    { id: 'settings_notifications', icon: Bell, bg: 'linear-gradient(135deg, #eab308, #facc15)', label: 'Notifications' },
    { id: 'settings_security', icon: Shield, bg: 'linear-gradient(135deg, #10b981, #34d399)', label: 'Security Settings' },
    { id: 'app_settings', icon: Settings, bg: 'linear-gradient(135deg, #475569, #94a3b8)', label: 'All Settings' },
    { id: 'live_voice', icon: AiFillSound, bg: 'linear-gradient(135deg, #8b5cf6, #c084fc)', label: 'Voice Settings' },
    { id: 'exit_menu', icon: X, bg: 'linear-gradient(135deg, #f43f5e, #fb7185)', label: 'Close' },
];

const ROWS = 6;
const COLS = 6;
const gridData = new Array(ROWS).fill(0).map(() => new Array(COLS).fill(0).map((_, i) => i));

interface ActionMenuProps {
    onClose: () => void;
    onOpenSettings?: (tab?: string) => void;
}

export function ActionMenu({ onClose, onOpenSettings }: ActionMenuProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 368, height: 448 });

    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setDimensions({
                    width: clientWidth || 368,
                    height: clientHeight || 448
                });
            }
        };

        const observer = new ResizeObserver(updateSize);
        observer.observe(containerRef.current);
        updateSize();

        return () => observer.disconnect();
    }, []);

    const dynamicSettings = useMemo(() => {
        const { width, height } = dimensions;

        // Responsive icon sizing based on screen width breakpoints
        let divisor = 8; // lg
        if (width < 768) {
            divisor = 3.5; // sm
        } else if (width < 1024) {
            divisor = 5; // md
        }
        
        const iconSize = width / divisor;
        const margin = iconSize * 0.35;
        const scaleFactor = width / 368;

        const gridWidth = COLS * (iconSize + margin);
        const gridHeight = ROWS * iconSize;

        // Centering math: middle offset for 6x6 grid
        const initialX = (width / 2) - (2.5 * (iconSize + margin)) - (iconSize / 2);
        const initialY = (height / 2) - (2.5 * iconSize) - (iconSize / 2);

        return {
            icon: { margin, size: iconSize },
            device: { width, height },
            initialX,
            initialY,
            scaleFactor,
            constraints: {
                left: width - gridWidth - 5,
                right: 5,
                top: height - gridHeight - 5,
                bottom: 5
            }
        };
    }, [dimensions]);

    const x = useMotionValue(dynamicSettings.initialX);
    const y = useMotionValue(dynamicSettings.initialY);

    useEffect(() => {
        x.set(dynamicSettings.initialX);
        y.set(dynamicSettings.initialY);
    }, [dynamicSettings.initialX, dynamicSettings.initialY, x, y]);

    const handleSelectApp = (id: string | null) => {
        onClose();
        if (!id) return;

        if (id === 'github') {
            window.open('https://github.com/cluaiz/cluaize-app', '_blank');
        } else if (id === 'app_chat') {
            document.dispatchEvent(new CustomEvent('start-new-chat'));
        } else if (id === 'dashboard') {
            document.dispatchEvent(new CustomEvent('open-dashboard'));
        } else if (id.startsWith('settings_')) {
            const tab = id.replace('settings_', '');
            onOpenSettings?.(tab);
        } else if (id === 'app_settings') {
            onOpenSettings?.('general');
        } else {
            console.log(`Action dispatched for: ${id}`);
        }
    };

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 overflow-hidden pointer-events-auto flex items-center justify-center bg-transparent"
        >
            <div className="relative overflow-visible" style={dynamicSettings.device}>
                <motion.div
                    drag
                    dragConstraints={dynamicSettings.constraints}
                    style={{
                        width: COLS * (dynamicSettings.icon.size + dynamicSettings.icon.margin),
                        height: ROWS * dynamicSettings.icon.size,
                        x,
                        y,
                        background: "transparent",
                        cursor: "grab",
                        position: "absolute"
                    }}
                    whileTap={{ cursor: "grabbing" }}
                >
                    {gridData.map((rowArr, rowIndex) =>
                        rowArr.map((_, colIndex) => {
                            const index = rowIndex * COLS + colIndex;
                            const app = appsList[index % appsList.length];

                            return (
                                <Item
                                    key={`${rowIndex}-${colIndex}`}
                                    row={rowIndex}
                                    col={colIndex}
                                    planeX={x}
                                    planeY={y}
                                    app={app}
                                    setActiveSkill={handleSelectApp}
                                    settings={dynamicSettings}
                                />
                            );
                        })
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
