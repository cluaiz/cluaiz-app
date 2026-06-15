import { useEngineStore } from '../../../store/engine/useEngineStore';
import { SettingSection, SettingItem } from './SharedComponents';

export function EngineSettings() {
    const { 
        launchOnStartup, 
        loadModelOnSend, 
        setLaunchOnStartup, 
        setLoadModelOnSend 
    } = useEngineStore();

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Engine Lifecycle">

                <SettingItem
                    label="Lazy Load Model (On Send)"
                    description="Wait until you send the first message to load the AI model. This saves RAM when you are just viewing chat history."
                    toggle
                    active={loadModelOnSend}
                    onToggle={() => setLoadModelOnSend(!loadModelOnSend)}
                />
            </SettingSection>

            <SettingSection title="Hardware & Optimization">
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-white">Default Model</div>
                            <div className="text-[10px] text-zinc-500">The primary AI model loaded into memory.</div>
                        </div>
                        <select
                            disabled
                            className="bg-zinc-850 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none opacity-50 cursor-not-allowed"
                        >
                            <option>Qwen 3.5 (4B)</option>
                            <option>Llama 3 (8B)</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <div>
                            <div className="text-sm font-bold text-white">Compute Device</div>
                            <div className="text-[10px] text-zinc-500">Preferred hardware for model inference.</div>
                        </div>
                        <select
                            disabled
                            className="bg-zinc-850 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none opacity-50 cursor-not-allowed"
                        >
                            <option>Auto (GPU + CPU)</option>
                            <option>CPU Only</option>
                        </select>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
}
