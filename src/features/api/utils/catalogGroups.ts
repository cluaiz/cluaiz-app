import { Activity, Bot, Boxes, Brain, FolderGit2, Folder, Mic, Layers, Sliders,
    ShieldCheck, MessageSquare, Wrench } from 'lucide-react';
import type { ApiGroup } from '../types';

// Shared presentation metadata; method membership comes from the Engine docs.
const categories = [
    { category: 'ai-inference', id: 'pillar_ai', title: 'AI & Inference Core', icon: Brain,
        iconColor: 'text-purple-400', badgeStyle: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        accentColor: '#8b5cf6', borderGlow: 'border-violet-500/50 shadow-violet-500/10', badge: 'NEURAL COMPUTE' },
    { category: 'agents-tools', id: 'pillar_agents', title: 'Agents, MCP & Tools', icon: Bot,
        iconColor: 'text-emerald-400', badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        accentColor: '#10b981', borderGlow: 'border-emerald-500/50 shadow-emerald-500/10', badge: 'AGENTIC PROTOCOL' },
    { category: 'filesystem', id: 'pillar_fs', title: 'Filesystem & Security Jail', icon: FolderGit2,
        iconColor: 'text-blue-400', badgeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        accentColor: '#0ea5e9', borderGlow: 'border-sky-500/50 shadow-sky-500/10', badge: 'SANDBOX & VFS' },
    { category: 'models', id: 'pillar_models', title: 'Models & Engine Vault', icon: Boxes,
        iconColor: 'text-amber-400', badgeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        accentColor: '#f59e0b', borderGlow: 'border-amber-500/50 shadow-amber-500/10', badge: 'SILICON & WEIGHTS' },
    { category: 'system', id: 'pillar_system', title: 'System & Infrastructure', icon: Activity,
        iconColor: 'text-cyan-400', badgeStyle: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        accentColor: '#06b6d4', borderGlow: 'border-cyan-500/50 shadow-cyan-500/10', badge: 'OBSERVABILITY & TUNING' },
];

const icons: Record<string, typeof Activity> = { audio: Mic, tts: Mic, stt: Mic, chat: MessageSquare, memory: Layers,
    context: Layers, config: Sliders, approvals: ShieldCheck, tools: Wrench, fs: Folder };

// audio.run handles both tasks; show it once with TTS, matching its default text input.
const audioDomains: Record<string, string> = {
    'audio.voices': 'TTS', 'audio.languages': 'STT', 'audio.run': 'TTS',
};

/** Sidebar and architecture canvas read one catalog projection, with identical membership. */
export function catalogPillars(groups: ApiGroup[]) {
    return categories.map(category => {
        const merged = new Map<string, { id: string; title: string; icon: typeof Activity;
            iconColor: string; endpoints: ApiGroup['endpoints'] }>();
        for (const group of groups.filter(group => group.category === category.category)) {
            for (const endpoint of group.endpoints) {
                const title = category.category === 'ai-inference'
                    ? audioDomains[endpoint.path] || group.group : group.group;
                const key = title.toLowerCase();
                if (!merged.has(key)) merged.set(key, {
                    id: `${category.category}/${key}`, title,
                    icon: icons[key] || category.icon, iconColor: category.iconColor, endpoints: [],
                });
                merged.get(key)!.endpoints.push(endpoint);
            }
        }
        const subgroups = [...merged.values()];
        return { ...category, subgroups, totalEndpoints: subgroups.reduce((sum, group) => sum + group.endpoints.length, 0) };
    }).filter(category => category.totalEndpoints > 0);
}
