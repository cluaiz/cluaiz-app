import { Sparkles, Flame, Zap, Code } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { ElasticSlider } from '../ui/cursor/ElasticSlider';
import { ContextChip } from '../ui/ContextChip';
import { DateDivider } from '../ui/DateDivider';
import { toast } from '../ui/toast';
import type { ShowcaseDemoState } from './state';
export function PrimitiveDemos(state: ShowcaseDemoState){
const {selectedId, inputVal, setInputVal, inputError, setInputError, toggle1, setToggle1, toggle2, setToggle2, sliderVal, setSliderVal}=state;
return <>
{selectedId === 'button' && (
                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Visual Variants
                                </h3>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button variant="default">Default Accent</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="ghost">Ghost</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button variant="cyber">Cyberpunk Neon</Button>
                                    <Button variant="pixel">Pixel 8-Bit</Button>
                                    <Button variant="link">Inline Link</Button>
                                </div>

                                <div className="border-t border-[var(--border-color)] pt-5">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                                        Sizing Scale & Icon Slot
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button size="sm" variant="outline">Small (sm)</Button>
                                        <Button size="default" variant="outline">Default</Button>
                                        <Button size="lg" variant="outline">Large (lg)</Button>
                                        <Button size="icon" variant="outline">
                                            <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'input' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5 max-w-xl">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Standard Editable Input</label>
                                <Input
                                    value={inputVal}
                                    onChange={(e) => setInputVal(e.target.value)}
                                    placeholder="Type something here..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Validation Error State</label>
                                <Input
                                    value={inputError}
                                    onChange={(e) => setInputError(e.target.value)}
                                    placeholder="Enter port number..."
                                    error="Port must be an integer between 1024 and 65535"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Disabled Input</label>
                                <Input disabled value="Protected Silicon Registry Port" />
                            </div>
                        </div>
                    )}
{selectedId === 'toggleswitch' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Hardware Acceleration</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">Direct NVMM/Vulkan tensor compute pass</p>
                                </div>
                                <ToggleSwitch active={toggle1} onToggle={() => setToggle1(!toggle1)} />
                            </div>
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Low Latency Zero-Copy Buffer</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">Bypass IPC buffer serialization</p>
                                </div>
                                <ToggleSwitch active={toggle2} onToggle={() => setToggle2(!toggle2)} />
                            </div>
                        </div>
                    )}
{selectedId === 'elasticslider' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Inference Temperature / Penalty</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Drag the slider or stretch past bounds to feel elastic sigmoid recoil.</p>
                                </div>
                                <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                    Value: {sliderVal}%
                                </span>
                            </div>

                            <div className="py-6">
                                <ElasticSlider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={sliderVal}
                                    onChange={setSliderVal}
                                />
                            </div>
                        </div>
                    )}
{selectedId === 'badge' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">All Badge Variants</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="default">Default Accent</Badge>
                                <Badge variant="secondary">Secondary</Badge>
                                <Badge variant="outline">Outline</Badge>
                                <Badge variant="destructive">Destructive Error</Badge>
                                <Badge variant="cyber">Neon Sync</Badge>
                                <Badge variant="pixel">8-BIT CHIP</Badge>
                            </div>
                        </div>
                    )}
{selectedId === 'tag' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Interactive Filter Tags</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Tag>Research</Tag>
                                <Tag active>Active Tag</Tag>
                                <Tag className="inline-flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Trending</span>
                                </Tag>
                                <Tag className="inline-flex items-center gap-1">
                                    <Code className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Rust Native</span>
                                </Tag>
                            </div>
                        </div>
                    )}
{selectedId === 'contextchip' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Draggable Context Chips</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <ContextChip
                                    id="src/engine/cuda.rs"
                                    rawPath="src/engine/cuda.rs"
                                    type="file"
                                    lineRange="L1-L45"
                                    onRemove={() => toast.info('Removed file chip')}
                                />
                                <ContextChip
                                    id="cluaiz-core"
                                    name="cluaiz-core"
                                    type="folder"
                                    onRemove={() => toast.info('Removed folder chip')}
                                />
                                <ContextChip
                                    id="rust-analyzer"
                                    name="Rust Expert Skill"
                                    type="skill"
                                    icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                                    onRemove={() => toast.info('Removed skill chip')}
                                />
                            </div>
                        </div>
                    )}
{selectedId === 'datedivider' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Timeline Date Divider</h3>
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                <DateDivider date={new Date()} />
                            </div>
                        </div>
                    )}
{selectedId === 'card' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Card Surface Types</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Standard Card</CardTitle>
                                        <CardDescription>Default surface token</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Informational grids and structured items.</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-[var(--bg-primary)]/40 backdrop-blur-md border-[var(--border-color)]">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                                            <span>Glassmorphic</span>
                                        </CardTitle>
                                        <CardDescription>Frosted glass blur</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Floating HUD overlays.</p>
                                    </CardContent>
                                </Card>

                                <Card className="hover:border-[var(--accent-color)]/50 transition-all cursor-pointer">
                                    <CardHeader>
                                        <CardTitle>Interactive Card</CardTitle>
                                        <CardDescription>Hover border reactive</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Click targets and library rows.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
</>;
}
