import React, { useEffect, useRef, useState } from 'react';
import { useLayoutStore } from '../../store/ui/useLayoutStore';

interface ResizableSidebarProps {
    children: React.ReactNode;
}

export function ResizableSidebar({ children }: ResizableSidebarProps) {
    const { 
        sidebarOpen, 
        sidebarWidth, 
        sidebarPosition, 
        sidebarCollapsed, 
        sidebarPeeked, 
        setSidebarWidth, 
        toggleSidebar 
    } = useLayoutStore();
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Drag constraints: Min 200px, Max 30% of page width
    const minWidth = 200;

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || sidebarCollapsed) return;
            
            let newWidth = 200;
            if (sidebarPosition === 'left') {
                newWidth = e.clientX;
            } else {
                newWidth = window.innerWidth - e.clientX;
            }

            const currentMaxWidth = Math.max(window.innerWidth * 0.3, minWidth);
            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > currentMaxWidth) newWidth = currentMaxWidth;
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (isResizing && !sidebarCollapsed) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarPosition, sidebarCollapsed, setSidebarWidth]);

    if (!sidebarOpen && !sidebarPeeked) return null;

    const currentWidth = sidebarCollapsed ? 68 : sidebarWidth;

    const desktopClasses = sidebarPeeked
        ? `absolute inset-y-0 ${
              sidebarPosition === 'left' ? 'left-0 border-r shadow-[5px_0_25px_rgba(0,0,0,0.5)]' : 'right-0 border-l shadow-[-5px_0_25px_rgba(0,0,0,0.5)]'
          } z-50 bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col overflow-visible ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`
        : `relative h-full flex-shrink-0 bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col overflow-visible ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`;

    return (
        <div
            ref={sidebarRef}
            className={desktopClasses}
            style={{ 
                width: `${currentWidth}px`, 
                borderRight: sidebarPosition === 'left' ? '1px solid var(--border-color)' : 'none',
                borderLeft: sidebarPosition === 'right' ? '1px solid var(--border-color)' : 'none'
            }}
        >
            <div className="flex-1 overflow-y-auto flex flex-col overflow-x-hidden">
                {children}
            </div>

            {/* Centered Border Resizer Overlay - 1 single line, 0 black gap, glowing hover */}
            {!sidebarCollapsed && (
                <div
                    className={`absolute top-0 h-full w-2 cursor-col-resize z-30 group ${
                        sidebarPosition === 'left' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'
                    }`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                    }}
                    title="Drag to resize sidebar"
                >
                    {/* Glowing Accent Line Indicator directly on the single 1px border */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] opacity-0 group-hover:opacity-100 group-hover:bg-[var(--accent-color)] group-hover:shadow-[0_0_8px_var(--accent-color)] transition-all duration-150 pointer-events-none" />
                </div>
            )}
        </div>
    );
}

