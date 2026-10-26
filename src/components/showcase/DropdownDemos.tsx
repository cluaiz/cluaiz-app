import { Sparkles, Trash2, Settings, Copy, Calendar, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import { ActionDropdown, ActionDropdownItem } from '../ui/dropdown/ActionDropdown';
import { CustomDropdown } from '../ui/dropdown/CustomDropdown';
import { CalendarDropdown } from '../ui/dropdown/CalendarDropdown';
import { FilterDropdown } from '../ui/dropdown/FilterDropdown';
import { toast } from '../ui/toast';
import type { ShowcaseDemoState } from './state';
export function DropdownDemos(state: ShowcaseDemoState){
const {selectedId, customDropdownVal, setCustomDropdownVal, selectedFilter, setSelectedFilter, demoDateRange, setDemoDateRange, isActionDropdownOpen, setIsActionDropdownOpen, isCalendarDropdownOpen, setIsCalendarDropdownOpen, isFilterDropdownOpen, setIsFilterDropdownOpen, actionDropdownRef, calendarDropdownRef, filterDropdownRef}=state;
return <>
{selectedId === 'customdropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">CustomDropdown (Searchable Floating Portal)</h4>
                                <p className="text-[11px] text-[var(--text-muted)] mt-1">Searchable options list with custom input support.</p>
                            </div>
                            <CustomDropdown
                                options={[
                                    { value: 'Rust Native', label: 'Rust Native Engine' },
                                    { value: 'CUDA Acceleration', label: 'NVIDIA CUDA Kernel' },
                                    { value: 'Metal Shaders', label: 'Apple Metal Shaders' },
                                    { value: 'Vulkan Compute', label: 'Cross-Vendor Vulkan' },
                                ]}
                                value={customDropdownVal}
                                onChange={setCustomDropdownVal}
                                placeholder="Select Engine Profile..."
                                floating={true}
                            />
                            <p className="text-xs text-[var(--text-muted)] font-mono">Selected: <span className="text-[var(--accent-color)]">{customDropdownVal}</span></p>
                        </div>
                    )}
{selectedId === 'calendardropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">CalendarDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Interactive drag-to-select calendar range selector.</p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={calendarDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCalendarDropdownOpen(!isCalendarDropdownOpen)}
                                    >
                                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Pick Date Range</span>
                                    </Button>
                                    <CalendarDropdown
                                        isOpen={isCalendarDropdownOpen}
                                        onClose={() => setIsCalendarDropdownOpen(false)}
                                        dateRange={demoDateRange}
                                        onDateRangeChange={setDemoDateRange}
                                        bookedDates={[new Date()]}
                                        filteredChatsCount={12}
                                        triggerRef={calendarDropdownRef}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'filterdropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">FilterDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Active Filter: <span className="text-[var(--accent-color)] capitalize">{selectedFilter}</span></p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={filterDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    >
                                        <Filter className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Filter Menu</span>
                                    </Button>
                                    <FilterDropdown
                                        isOpen={isFilterDropdownOpen}
                                        onClose={() => setIsFilterDropdownOpen(false)}
                                        activeFilter={selectedFilter}
                                        onFilterChange={(f) => {
                                            setSelectedFilter(f);
                                            setIsFilterDropdownOpen(false);
                                        }}
                                        triggerRef={filterDropdownRef}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'actiondropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">ActionDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Anchored floating actions portal.</p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={actionDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                                    >
                                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Actions</span>
                                    </Button>
                                    <ActionDropdown
                                        isOpen={isActionDropdownOpen}
                                        onClose={() => setIsActionDropdownOpen(false)}
                                        triggerRef={actionDropdownRef}
                                    >
                                        <ActionDropdownItem
                                            icon={<Sparkles className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                            onClick={() => toast.info('Memory Probed')}
                                        >
                                            Run Memory Prober
                                        </ActionDropdownItem>
                                        <ActionDropdownItem
                                            icon={<Copy className="w-3.5 h-3.5" />}
                                            onClick={() => toast.success('Config Copied')}
                                        >
                                            Copy Configuration
                                        </ActionDropdownItem>
                                        <ActionDropdownItem
                                            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                                            danger
                                            onClick={() => toast.warning('Cache Purged')}
                                        >
                                            Purge KV Cache
                                        </ActionDropdownItem>
                                    </ActionDropdown>
                                </div>
                            </div>
                        </div>
                    )}
</>;
}
