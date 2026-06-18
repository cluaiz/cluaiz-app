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
    const [isMobile, setIsMobile] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Track width on resize to trigger mobile presentation
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Drag constraints: Min 200px, Max 30% of page width
    const minWidth = 200;

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || isMobile || sidebarCollapsed) return;
            
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

        if (isResizing && !isMobile && !sidebarCollapsed) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, isMobile, sidebarPosition, sidebarCollapsed, setSidebarWidth]);

    if (!sidebarOpen && !sidebarPeeked) return null;

    if (isMobile) {
        return (
            <>
                {/* Overlay backdrop */}
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 animate-fade-in"
                    onClick={toggleSidebar}
                />
                {/* Mobile Slide Drawer */}
                <div
                    ref={sidebarRef}
                    className={`fixed inset-y-0 ${
                        sidebarPosition === 'left' ? 'left-0 border-r' : 'right-0 border-l'
                    } w-[80vw] max-w-[320px] z-50 bg-[var(--bg-secondary)] border-[var(--border-color)] flex flex-col shadow-2xl transition-transform duration-300 ease-out`}
                    style={{ borderStyle: 'var(--border-style)' }}
                >
                    <div className="flex-1 overflow-y-auto relative h-full flex flex-col">
                        {children}
                    </div>
                </div>
            </>
        );
    }

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

