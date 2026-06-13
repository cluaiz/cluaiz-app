import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DateRange {
    from: Date | undefined;
    to?: Date | undefined;
}

interface CalendarDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    bookedDates: Date[];
    filteredChatsCount: number;
    align?: 'left' | 'right' | 'center';
    triggerRef?: React.RefObject<HTMLElement | null>;
}

const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
};

export function CalendarDropdown({
    isOpen,
    onClose,
    dateRange,
    onDateRangeChange,
    bookedDates,
    filteredChatsCount,
    align = 'right',
    triggerRef
}: CalendarDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Drag-to-select range states
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Date | null>(null);
    const lastMonthChangeRef = useRef<number>(0);

    // Initial calendar month/year
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState(() => {
        if (dateRange?.from) return new Date(dateRange.from);
        return new Date();
    });

    // Update viewDate if dateRange changes from outside
    useEffect(() => {
        if (dateRange?.from) {
            setViewDate(new Date(dateRange.from));
        }
    }, [dateRange]);

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const prevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const nextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    // Throttled month changes for boundary drags
    const throttleMonthChange = (dir: 'prev' | 'next') => {
        const now = Date.now();
        if (now - lastMonthChangeRef.current > 700) { // 700ms throttle for smooth flips
            lastMonthChangeRef.current = now;
            if (dir === 'prev') {
                prevMonth();
            } else {
                nextMonth();
            }
        }
    };

    // Global drag end listener
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragStart(null);
            }
        };

        if (isDragging) {
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging]);

    // Boundary check during drags (hits top/bottom/left/right of popover)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dropdownRef.current) return;
            const rect = dropdownRef.current.getBoundingClientRect();
            const padding = 24; // boundary detection thickness

            if (e.clientY >= rect.top && e.clientY <= rect.top + padding) {
                throttleMonthChange('prev');
            } else if (e.clientY <= rect.bottom && e.clientY >= rect.bottom - padding) {
                throttleMonthChange('next');
            } else if (e.clientX >= rect.left && e.clientX <= rect.left + padding) {
                throttleMonthChange('prev');
            } else if (e.clientX <= rect.right && e.clientX >= rect.right - padding) {
                throttleMonthChange('next');
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isDragging]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                (!triggerRef?.current || !triggerRef.current.contains(event.target as Node))
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    // Helper to compare dates ignoring hours
    const isSameDay = (d1: Date | undefined, d2: Date) => {
        if (!d1) return false;
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    };

    const isFuture = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const t = new Date(today);
        t.setHours(0, 0, 0, 0);
        return d > t;
    };

    const isFutureMonthDisabled = currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth >= today.getMonth());

    // Calculate grid items
    const gridDays = useMemo(() => {
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

        const items: { date: Date; isCurrentMonth: boolean }[] = [];

        // Previous month padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            items.push({
                date: new Date(currentYear, currentMonth - 1, prevMonthTotalDays - i),
                isCurrentMonth: false
            });
        }

        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            items.push({
                date: new Date(currentYear, currentMonth, i),
                isCurrentMonth: true
            });
        }

        // Next month padding to complete 42 cells (6 rows * 7 days)
        const nextPadding = 42 - items.length;
        for (let i = 1; i <= nextPadding; i++) {
            items.push({
                date: new Date(currentYear, currentMonth + 1, i),
                isCurrentMonth: false
            });
        }

        return items;
    }, [currentMonth, currentYear]);

    // Mousedown starts drag range selection
    const handleDayMouseDown = (dayDate: Date) => {
        if (isFuture(dayDate)) return;
        setIsDragging(true);
        setDragStart(dayDate);
        onDateRangeChange({ from: dayDate, to: dayDate });
    };

    // MouseEnter expands range selection when holding/dragging
    const handleDayMouseEnter = (dayDate: Date, isCurrentMonth: boolean) => {
        if (!isDragging || !dragStart || isFuture(dayDate)) return;

        // Set range bound correctly
        if (dayDate >= dragStart) {
            onDateRangeChange({ from: dragStart, to: dayDate });
        } else {
            onDateRangeChange({ from: dayDate, to: dragStart });
        }

        // Navigate month if hovering padded outside dates
        if (!isCurrentMonth) {
            const firstOfCurrentMonth = new Date(currentYear, currentMonth, 1);
            throttleMonthChange(dayDate < firstOfCurrentMonth ? 'prev' : 'next');
        }
    };

    // Double click clears the active filter completely
    const handleDayDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDateRangeChange(undefined);
    };

    // Check if date is booked (has chat history)
    const isBooked = (date: Date) => {
        return bookedDates.some(bd => isSameDay(bd, date));
    };

    // Check if day is selected
    const getSelectionState = (date: Date) => {
        const from = dateRange?.from;
        const to = dateRange?.to;

        if (!from) return 'none';

        const isStart = isSameDay(from, date);
        const isEnd = to ? isSameDay(to, date) : false;

        if (isStart && !to) return 'single';
        if (isStart && isEnd) return 'single'; // same day selection
        if (isStart) return 'start';
        if (isEnd) return 'end';

        if (to && date > from && date < to) return 'middle';

        return 'none';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className={`absolute top-full mt-1.5 w-[240px] bg-zinc-950/95 border border-white/10 shadow-2xl z-50 rounded-2xl backdrop-blur-md overflow-hidden select-none ${
                        align === 'right' ? 'right-2' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-2'
                    }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                        <button
                            onClick={prevMonth}
                            className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[11px] font-bold text-zinc-200 tracking-wide select-none">
                            {monthNames[currentMonth]} {currentYear}
                        </span>
                        <button
                            onClick={nextMonth}
                            disabled={isFutureMonthDisabled}
                            className={`p-1 rounded-lg transition-colors ${isFutureMonthDisabled ? 'hidden' : 'hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer'}`}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-0.5 px-2.5 pt-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center select-none">
                        <span>Su</span>
                        <span>Mo</span>
                        <span>Tu</span>
                        <span>We</span>
                        <span>Th</span>
                        <span>Fr</span>
                        <span>Sa</span>
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 p-2.5">
                        {gridDays.map(({ date, isCurrentMonth }, idx) => {
                            const selection = getSelectionState(date);
                            const hasHistory = isBooked(date);
                            const isToday = isSameDay(today, date);

                            // Determine day classes
                            let dayClasses = "relative aspect-square flex items-center justify-center text-[10.5px] font-medium transition-all select-none ";
                            const isDateFuture = isFuture(date);
                            
                            if (isDateFuture) {
                                dayClasses += "text-zinc-700 opacity-30 cursor-not-allowed";
                            } else {
                                dayClasses += "cursor-pointer ";
                                if (selection === 'single') {
                                    dayClasses += "bg-[var(--accent-color)] text-[var(--accent-contrast)] rounded-md font-bold shadow-[0_0_12px_var(--accent-glow)] z-10";
                                } else if (selection === 'start') {
                                    dayClasses += "bg-[var(--accent-color)] text-[var(--accent-contrast)] rounded-l-md font-bold shadow-[0_0_12px_var(--accent-glow)] z-10";
                                } else if (selection === 'end') {
                                    dayClasses += "bg-[var(--accent-color)] text-[var(--accent-contrast)] rounded-r-md font-bold shadow-[0_0_12px_var(--accent-glow)] z-10";
                                } else if (selection === 'middle') {
                                    dayClasses += "bg-[var(--accent-color)]/20 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30";
                                } else {
                                    // Default state
                                    if (isCurrentMonth) {
                                        dayClasses += "text-zinc-200 hover:bg-white/5 rounded-md";
                                    } else {
                                        dayClasses += "text-zinc-600 hover:bg-white/5 rounded-md";
                                    }

                                    if (isToday) {
                                        dayClasses += " border border-zinc-700/80 shadow-inner";
                                    }
                                }
                            }

                            // Booked style (chat history exists) overrides
                            const itemStyle: React.CSSProperties = {};
                            if (hasHistory && selection === 'none') {
                                itemStyle.fontWeight = '900';
                                itemStyle.color = 'var(--accent-color)';
                            }

                            return (
                                <div
                                    key={idx}
                                    onMouseDown={() => handleDayMouseDown(date)}
                                    onMouseEnter={() => handleDayMouseEnter(date, isCurrentMonth)}
                                    onDoubleClick={(e) => handleDayDoubleClick(e)}
                                    className={dayClasses}
                                    style={itemStyle}
                                >
                                    <span>{date.getDate()}</span>
                                    {/* Optional microdot indicator for chat history */}
                                    {hasHistory && selection !== 'none' && (
                                        <span className="absolute bottom-0.5 w-1 h-1 bg-[var(--accent-contrast)] rounded-full" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-2.5 py-2 border-t border-white/5 bg-black/10 text-[9px] text-center text-zinc-500 font-bold select-none flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-pulse flex-shrink-0" />
                        {dateRange?.from ? (
                            <span className="truncate max-w-full px-1">
                                {formatDate(dateRange.from)}
                                {dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? ` - ${formatDate(dateRange.to)}` : ''} : {filteredChatsCount} chats found
                            </span>
                        ) : (
                            <span>Bold dates have chat history</span>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
