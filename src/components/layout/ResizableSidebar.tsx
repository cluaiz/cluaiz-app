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
            document.body.style.cursor = 'default';
        };

        if (isResizing && !sidebarCollapsed) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, sidebarPosition, sidebarCollapsed, setSidebarWidth]);

    if (!sidebarOpen && !sidebarPeeked) return null;

    const currentWidth = sidebarCollapsed ? 68 : sidebarWidth;

    const desktopClasses = sidebarPeeked
        ? `absolute inset-y-0 ${
              sidebarPosition === 'left' ? 'left-0 border-r shadow-[5px_0_25px_rgba(0,0,0,0.5)]' : 'right-0 border-l shadow-[-5px_0_25px_rgba(0,0,0,0.5)]'
          } z-50 bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col overflow-hidden ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`
        : `relative h-full flex-shrink-0 bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col overflow-hidden ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`;

    return (
        <div
            ref={sidebarRef}
            className={desktopClasses}
            style={{ 
                width: `${currentWidth}px`, 
                borderRightWidth: sidebarPosition === 'left' ? '1px' : '0px',
                borderLeftWidth: sidebarPosition === 'right' ? '1px' : '0px',
                borderStyle: 'var(--border-style)',
                borderColor: 'var(--border-color)'
            }}
        >
            <div className="flex-1 overflow-y-auto flex flex-col overflow-x-hidden">
                {children}
            </div>
            
            {/* Resizer Edge Bar */}
            {!sidebarCollapsed && (
                <div
                    className={`absolute top-0 w-1.5 h-full cursor-col-resize z-30 resizer-hover ${
                        sidebarPosition === 'left' ? 'right-0 -mr-1.25' : 'left-0 ml-0.75'
                    }`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                    }}
                />
            )}
        </div>
    );
}

