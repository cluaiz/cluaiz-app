import React, { useEffect, useState, useRef } from 'react';
import { useApiStore } from '../../store/api/useApiStore';
import { RequestHeader } from './components/RequestHeader';
import { RequestTabs } from './components/RequestTabs';
import { ResponsePanel } from './components/ResponsePanel';
import { ApiArchitectureLanding } from './components/ApiArchitectureLanding';
import { GripHorizontal, GripVertical } from 'lucide-react';

export const ApiWorkspace: React.FC = () => {
    const { loadApiData, apiData, activeEndpoint, selectEndpoint, layoutOrientation, activeTab } = useApiStore();
    const [splitRatio, setSplitRatio] = useState<number>(() => {
        if (typeof localStorage === 'undefined') return 55;
        const saved = localStorage.getItem('cluaiz_api_split_ratio');
        if (saved) {
            const val = parseFloat(saved);
            if (!isNaN(val) && val >= 20 && val <= 80) return val;
        }
        return 55;
    });
    const isDraggingRef = useRef<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial data loading
    useEffect(() => {
        loadApiData();
    }, [loadApiData]);

    // Handle deep linking from URL params & browser back/forward (popstate)
    useEffect(() => {
        const syncFromUrl = () => {
            if (apiData.length === 0) return;
            const params = new URLSearchParams(window.location.search);
            const targetPath = params.get('endpoint');
            const targetMethod = params.get('method');
            const targetTab = params.get('tab');

            if (targetPath) {
                for (const group of apiData) {
                    const found = group.endpoints.find(
                        (e) =>
                            e.path === targetPath &&
                            (!targetMethod || e.method.toUpperCase() === targetMethod.toUpperCase())
                    );
                    if (found) {
                        selectEndpoint(found);
                        if (targetTab && ['params', 'headers', 'docs', 'snippets'].includes(targetTab)) {
                            useApiStore.getState().setActiveTab(targetTab as any);
                        }
                        break;
                    }
                }
            } else {
                selectEndpoint(null);
            }
        };

        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);
        return () => window.removeEventListener('popstate', syncFromUrl);
    }, [apiData, selectEndpoint]);

    // Split pane dragging (supports both Vertical Y-axis and Horizontal X-axis)
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            
            let newPercentage: number;
            if (layoutOrientation === 'right') {
                const relativeX = moveEvent.clientX - rect.left;
                newPercentage = Math.min(Math.max((relativeX / rect.width) * 100, 20), 80);
            } else {
                const relativeY = moveEvent.clientY - rect.top;
                newPercentage = Math.min(Math.max((relativeY / rect.height) * 100, 20), 80);
            }
            setSplitRatio(newPercentage);
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem('cluaiz_api_split_ratio', String(newPercentage));
                } catch (_) { }
            }
        };

        const onMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const isRightLayout = layoutOrientation === 'right';
    const showResponsePanel = activeTab === 'params' || activeTab === 'headers';

    // If no endpoint is selected, present the interactive System Architecture Landing Page
    if (!activeEndpoint) {
        return (
            <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[var(--bg-primary)]">
                <ApiArchitectureLanding />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[var(--bg-primary)]">
            {/* Request Header (Controls, URL, Method, Send) */}
            <RequestHeader />

            {/* Split Panels Container */}
            <div 
                ref={containerRef} 
                className={`flex-1 flex min-h-0 min-w-0 overflow-hidden relative ${
                    isRightLayout ? 'flex-row' : 'flex-col'
                }`}
            >
                {/* Panel 1: Request Tabs (Body, Headers, Docs, Snippets) */}
                <div
                    style={
                        !showResponsePanel
                            ? { width: '100%', height: '100%' }
                            : isRightLayout
                            ? { width: `${splitRatio}%` }
                            : { height: `${splitRatio}%` }
                    }
                    className={`overflow-hidden ${
                        !showResponsePanel
                            ? 'w-full h-full'
                            : isRightLayout
                            ? 'h-full min-w-[280px]'
                            : 'w-full min-h-[120px]'
                    }`}
                >
                    <RequestTabs />
                </div>

                {/* Resizer & Response Panel only shown when on Body Payload or Headers */}
                {showResponsePanel && (
                    <>
                        {/* Draggable Resizer Bar */}
                        <div
                            onMouseDown={handleMouseDown}
                            className={`bg-[var(--bg-secondary)] hover:bg-[var(--accent-color)]/30 flex items-center justify-center select-none transition-colors group z-10 ${
                                isRightLayout
                                    ? 'w-2 h-full cursor-col-resize border-x border-[var(--border-color)]'
                                    : 'w-full h-2 cursor-row-resize border-y border-[var(--border-color)]'
                            }`}
                            title={isRightLayout ? 'Drag to resize width' : 'Drag to resize height'}
                        >
                            {isRightLayout ? (
                                <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)]" />
                            ) : (
                                <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)]" />
                            )}
                        </div>

                        {/* Panel 2: Response Viewer / Live Preview */}
                        <div
                            style={isRightLayout ? { width: `${100 - splitRatio}%` } : { height: `${100 - splitRatio}%` }}
                            className={`overflow-hidden ${
                                isRightLayout ? 'h-full min-w-[280px]' : 'w-full min-h-[120px]'
                            }`}
                        >
                            <ResponsePanel />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ApiWorkspace;
