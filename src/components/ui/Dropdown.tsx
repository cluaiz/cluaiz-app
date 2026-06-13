import React, { useEffect, useRef } from 'react';

interface DropdownProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}

export function Dropdown({ isOpen, onClose, children, align = 'right', className = '' }: DropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className={`absolute mt-1.5 z-40 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-xl p-1 animate-fade-in ${
                align === 'right' ? 'right-0' : 'left-0'
            } ${className}`}
            style={{
                borderRadius: 'var(--radius-base)',
                borderStyle: 'var(--border-style)'
            }}
        >
            {children}
        </div>
    );
}

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    icon?: React.ReactNode;
    active?: boolean;
}

export function DropdownItem({ children, icon, active, className = '', ...props }: DropdownItemProps) {
    return (
        <button
            className={`w-full text-left px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-2 border border-transparent ${
                active
                    ? 'bg-[var(--bg-tertiary)] text-[var(--accent-color)] font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/75 hover:text-[var(--text-primary)]'
            } ${className}`}
            {...props}
        >
            {icon && <span className="opacity-70 flex-shrink-0">{icon}</span>}
            <span className="truncate flex-1">{children}</span>
        </button>
    );
}
