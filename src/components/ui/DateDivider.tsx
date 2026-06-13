"use client";

import React, { useState, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { CalendarDropdown, DateRange } from './dropdown/CalendarDropdown';

interface DateDividerProps {
    date: Date;
    dateRange?: DateRange;
    onDateRangeChange?: (range: DateRange | undefined) => void;
    bookedDates?: Date[];
    filteredMessagesCount?: number;
}

export const DateDivider: React.FC<DateDividerProps> = ({ 
    date: rawDate, 
    dateRange,
    onDateRangeChange, 
    bookedDates,
    filteredMessagesCount
}) => {
    const date = new Date(rawDate);

    if (isNaN(date.getTime())) {
        console.warn('⚠️ [DateDivider] Invalid date received:', rawDate);
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    let label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    if (isToday) label = 'Today';
    else if (isYesterday) label = 'Yesterday';

    if (dateRange?.from) {
        const fromStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateRange.from);
        if (dateRange.to) {
            const toStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateRange.to);
            label = `${fromStr} - ${toStr}`;
        } else {
            label = fromStr;
        }
    }

    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const handleSelect = (range: DateRange | undefined) => {
        if (onDateRangeChange) {
            onDateRangeChange(range);
        }
    };

    return (
        <div
            className="flex justify-center pt-0.5 pb-2 sticky top-0 z-30 pointer-events-none transition-all duration-300 w-full"
            style={{ top: 'calc(0rem + var(--pinned-offset, 0px))' }}
        >
            <div className="pointer-events-auto relative">
                <div className="flex items-center">
                    <button
                        ref={triggerRef}
                        onClick={() => setIsOpen(!isOpen)}
                        className={`px-2 py-0.5 md:px-2.5 md:py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] shadow-xl border cursor-pointer transition-all flex items-center gap-1.5 select-none bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border-[var(--border-color)] ${dateRange?.from ? 'text-[var(--accent-color)] border-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-color)]'}`}
                        style={{ borderStyle: 'var(--border-style)' }}
                    >
                        {label}
                        <ChevronDown size={9} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dateRange?.from && onDateRangeChange && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDateRangeChange(undefined);
                                setIsOpen(false);
                            }}
                            className="ml-2 p-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full text-[var(--text-muted)] hover:text-red-500 hover:border-red-500 transition-colors pointer-events-auto"
                            title="Clear date filter"
                        >
                            <X size={10}/>
                        </button>
                    )}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2">
                    <CalendarDropdown
                        isOpen={isOpen}
                        onClose={() => setIsOpen(false)}
                        dateRange={dateRange || { from: date }}
                        onDateRangeChange={handleSelect}
                        bookedDates={bookedDates || []}
                        filteredChatsCount={filteredMessagesCount || 0}
                        align="center"
                        triggerRef={triggerRef}
                    />
                </div>
            </div>
        </div>
    );
};

