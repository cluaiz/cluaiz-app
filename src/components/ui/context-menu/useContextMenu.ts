import { useState, useCallback } from 'react';

export interface ContextMenuState {
    x: number;
    y: number;
    isOpen: boolean;
    data?: any;
}

export function useContextMenu() {
    const [state, setState] = useState<ContextMenuState>({
        x: 0,
        y: 0,
        isOpen: false,
        data: undefined
    });

    const openMenu = useCallback((e: React.MouseEvent | MouseEvent, data?: any) => {
        e.preventDefault();
        e.stopPropagation();
        setState({
            x: e.clientX,
            y: e.clientY,
            isOpen: true,
            data
        });
    }, []);

    const closeMenu = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        x: state.x,
        y: state.y,
        isOpen: state.isOpen,
        data: state.data,
        openMenu,
        closeMenu
    };
}
