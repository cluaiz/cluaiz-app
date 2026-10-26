import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Terminal as TerminalIcon, X, Maximize2, Minimize2, Plus, 
    ChevronDown, Loader2 
} from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ProjectFile } from '../types';
import { useSystemStore } from '../../../api/engine/system/system.store';
import type { CmdResponse } from '../../../api/engine/system/system.types';
import { FileIcon, FolderIcon } from 'react-material-icon-theme';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { useProjectStore } from '../../../store/workspace/useProjectStore';

const sendEngineCmd = (command: string, timeoutMs?: number): Promise<CmdResponse> => {
    return useSystemStore.getState().executeCommand(command, timeoutMs);
};

// Pure path validation guard across Windows, Linux and macOS
const isValidPath = (p: string | undefined | null, isWin: boolean): boolean => {
    if (!p || typeof p !== 'string') return false;
    const clean = p.trim();
    if (clean.length < 2) return false;
    if (clean.includes('\n') || clean.includes('\r')) return false;
    const lower = clean.toLowerCase();
    if (
        lower.includes('failed') || 
        lower.includes('http://') || 
        lower.includes('https://') || 
        lower.includes('engine connection') || 
        lower.includes('cannot find') ||
        lower.includes('not recognized') ||
        lower.includes('syntax is incorrect') ||
        lower.includes('no such file') ||
        clean.includes('& {') ||
        clean.includes('powershell')
    ) {
        return false;
    }
    if (isWin) {
        return /^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith('\\\\');
    }
    return clean.startsWith('/') || clean.startsWith('~');
};

export interface TerminalTarget {
    path: string;
    type: 'folder' | 'file' | 'root';
    token: number;
}

export interface TerminalSession {
    id: string;
    displayName: string;
    targetType: 'folder' | 'file' | 'root';
    shellType: 'powershell' | 'cmd' | 'bash' | 'zsh';
    cwd: string;
    commandHistory: string[];
    historyIndex: number | null;
}

interface WorkspaceTerminalProps {
    isOpen: boolean;
    onClose: () => void;
    cwd?: string;
    terminalTarget?: TerminalTarget;
    files: Record<string, ProjectFile>;
    projectName?: string;
    rootPath?: string;
    onOpenFile?: (path: string) => void;
}

export const WorkspaceTerminal: React.FC<WorkspaceTerminalProps> = ({
    isOpen,
    onClose,
    cwd: initialCwd,
    terminalTarget,
    files = {},
    projectName = 'workspace',
    rootPath,
}) => {
    const isWindows = typeof navigator !== 'undefined' && (
        navigator.userAgent.includes('Windows') || 
        navigator.platform?.startsWith('Win')
    );
    const isMac = typeof navigator !== 'undefined' && (
        navigator.userAgent.includes('Mac') || 
        navigator.platform?.startsWith('Mac')
    );

    const defaultShell: 'powershell' | 'cmd' | 'bash' | 'zsh' = isWindows 
        ? 'powershell' 
        : isMac ? 'zsh' : 'bash';

    const { theme } = useThemeStore();

    const [systemCwd, setSystemCwd] = useState<string>(() => {
        try {
            const stored = localStorage.getItem('cluaiz_user_profile_dir') || '';
            if (isValidPath(stored, isWindows)) {
                return stored;
            }
            localStorage.removeItem('cluaiz_user_profile_dir');
            return '';
        } catch { return ''; }
    });

    const getBaseRootPath = useCallback(() => rootPath || (isValidPath(systemCwd, isWindows) ? systemCwd : '') || '', [rootPath, systemCwd, isWindows]);

    // Proactively resolve host user profile directory ($env:USERPROFILE / $HOME) when no workspace is open
    useEffect(() => {
        if (!rootPath) {
            const probeCmd = isWindows ? 'echo %USERPROFILE%' : 'echo $HOME';
            sendEngineCmd(probeCmd).then(res => {
                if (res?.status === 'success' && res.output) {
                    const probed = res.output.trim().split(/[\r\n]+/)[0]?.trim();
                    if (isValidPath(probed, isWindows)) {
                        try { localStorage.setItem('cluaiz_user_profile_dir', probed); } catch {}
                        setSystemCwd(probed);
                        setSessions(prev => prev.map(s => (s.id === 'sess-1' && (!s.cwd || !isValidPath(s.cwd, isWindows))) ? { ...s, cwd: probed } : s));
                    }
                }
            }).catch(() => {});
        }
    }, [rootPath, isWindows]);

    const [terminalHeight, setTerminalHeight] = useState(250);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

    // Multi-session state
    const [sessions, setSessions] = useState<TerminalSession[]>([
        {
            id: 'sess-1',
            displayName: projectName || 'terminal',
            targetType: 'root',
            shellType: defaultShell,
            cwd: getBaseRootPath(),
            commandHistory: [],
            historyIndex: null
        }
    ]);
    const [activeSessionId, setActiveSessionId] = useState<string>('sess-1');

    const terminalContainerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const isResizingRef = useRef(false);

    // Input state refs
    const currentLineRef = useRef<string>('');
    const sessionsRef = useRef<TerminalSession[]>(sessions);
    sessionsRef.current = sessions;
    const activeSessionIdRef = useRef<string>(activeSessionId);
    activeSessionIdRef.current = activeSessionId;

    const getActiveSession = useCallback(() => {
        return sessionsRef.current.find(s => s.id === activeSessionIdRef.current) || sessionsRef.current[0];
    }, []);

    // Print Prompt to Xterm
    const printPrompt = useCallback((path: string, shell: string, term?: XTerm, withNewline = true) => {
        const targetTerm = term || xtermRef.current;
        if (!targetTerm) return;
        const normalized = path || getBaseRootPath();
        const prefix = withNewline ? '\r\n' : '';
        if (isWindows) {
            if (shell === 'cmd') {
                targetTerm.write(`${prefix}\x1b[90m${normalized}\x1b[0m\x1b[33m>\x1b[0m `);
            } else {
                targetTerm.write(`${prefix}\x1b[36mPS\x1b[0m \x1b[90m${normalized}\x1b[0m\x1b[33m>\x1b[0m `);
            }
        } else {
            targetTerm.write(`${prefix}\x1b[32muser@cluaiz\x1b[0m:\x1b[34m${normalized}\x1b[0m$ `);
        }
    }, [isWindows, getBaseRootPath]);

    // Keep sess-1 cwd in sync if rootPath changes
    useEffect(() => {
        const base = getBaseRootPath();
        const dName = projectName || 'terminal';
        setSessions(prev => {
            if (prev.length === 0) return prev;
            return prev.map(s => {
                if (s.id === 'sess-1' && (s.cwd !== base || s.displayName !== dName)) {
                    return { ...s, cwd: base, displayName: dName };
                }
                return s;
            });
        });
    }, [getBaseRootPath, projectName]);

    // Handle Target Right-Click Launch (Folder, File, or Root)
    useEffect(() => {
        if (!isOpen) return;

        let rawPath = '';
        let targetType: 'folder' | 'file' | 'root' = 'folder';

        if (terminalTarget && terminalTarget.token) {
            rawPath = terminalTarget.path.trim();
            targetType = terminalTarget.type;
        } else if (initialCwd && initialCwd.trim()) {
            rawPath = initialCwd.trim();
            targetType = 'folder';
        } else {
            return;
        }

        const sep = isWindows ? '\\' : '/';
        let dirSub = '';
        let displayName = projectName || 'terminal';

        if (targetType === 'file') {
            const lastIdx = Math.max(rawPath.lastIndexOf('/'), rawPath.lastIndexOf('\\'));
            dirSub = lastIdx !== -1 ? rawPath.substring(0, lastIdx) : '';
            displayName = rawPath.split(/[\\/]/).filter(Boolean).pop() || rawPath;
        } else if (targetType === 'folder') {
            dirSub = rawPath;
            displayName = rawPath.split(/[\\/]/).filter(Boolean).pop() || rawPath || projectName;
        } else {
            dirSub = '';
            displayName = projectName;
        }

        const isAbsolute = isWindows 
            ? /^[a-zA-Z]:[\\/]/.test(dirSub)
            : dirSub.startsWith('/');
        const normalizedSub = isWindows ? dirSub.replace(/\//g, '\\') : dirSub;
        const targetPath = dirSub 
            ? (isAbsolute ? normalizedSub : `${getBaseRootPath()}${sep}${normalizedSub}`)
            : getBaseRootPath();

        // Proactively ensure target folder exists on disk via native engine command
        const cleanTargetPath = targetPath.replace(/^["']|["']$/g, '').trim();
        const mkdirCmd = isWindows 
            ? `if not exist "${cleanTargetPath}" mkdir "${cleanTargetPath}"`
            : `mkdir -p "${cleanTargetPath}"`;
        sendEngineCmd(mkdirCmd).catch(() => {});

        const existing = sessionsRef.current.find(s => s.cwd.toLowerCase() === targetPath.toLowerCase());
        if (existing) {
            existing.displayName = displayName;
            existing.targetType = targetType;
            setSessions([...sessionsRef.current]);
            setActiveSessionId(existing.id);
            return;
        }

        const newId = `sess-${Date.now()}`;
        const newSession: TerminalSession = {
            id: newId,
            displayName,
            targetType,
            shellType: defaultShell,
            cwd: targetPath,
            commandHistory: [],
            historyIndex: null
        };

        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newId);
    }, [terminalTarget, initialCwd, isOpen, defaultShell, getBaseRootPath, isWindows, projectName]);

    // Execute Command on OS via Engine
    const executeOnSystem = useCallback(async (commandToRun: string) => {
        const term = xtermRef.current;
        const curSession = getActiveSession();
        if (!term || !curSession) return;

        const trimmed = commandToRun.trim();
        if (!trimmed) {
            printPrompt(curSession.cwd, curSession.shellType);
            return;
        }

        curSession.commandHistory.push(trimmed);
        curSession.historyIndex = null;
        currentLineRef.current = '';

        // Built-in clear
        if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
            term.clear();
            printPrompt(curSession.cwd, curSession.shellType, undefined, false);
            return;
        }

        // Effective directory fallback
        const effectiveCwd = (isValidPath(curSession.cwd, isWindows) ? curSession.cwd : '') || 
                             (isValidPath(systemCwd, isWindows) ? systemCwd : '') || 
                             rootPath || 
                             (isWindows ? 'C:\\Users' : '.');

        setIsExecuting(true);
        term.write('\r\n');

        try {
            // Builtin cd navigation: handles cd, cd .., cd.., cd/, cd\, cd~, cd <path>
            const cdRegex = /^cd(\.\.|[\/\\]|~|\s.*|$)/i;
            if (cdRegex.test(trimmed)) {
                let target = '';
                if (/^cd\.\./i.test(trimmed)) {
                    target = '..' + trimmed.slice(4);
                } else if (/^cd[\/\\]/i.test(trimmed)) {
                    target = trimmed.slice(2);
                } else if (/^cd~/i.test(trimmed)) {
                    target = '~' + trimmed.slice(3);
                } else {
                    target = trimmed.slice(2).trim();
                }

                // Strip surrounding quotes
                target = target.replace(/^["']|["']$/g, '').trim();

                if (!target) {
                    if (isWindows) {
                        term.writeln(`\x1b[90m${effectiveCwd}\x1b[0m`);
                        return;
                    } else {
                        target = '~';
                    }
                }

                // Handle tilde home alias
                if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) {
                    const homeDir = systemCwd || (isWindows ? 'C:\\Users' : '/');
                    target = target === '~' ? homeDir : target.replace('~', homeDir);
                }

                const cleanCwd = effectiveCwd.replace(/^["']|["']$/g, '').trim();
                const cleanTarget = target.replace(/^["']|["']$/g, '').trim();

                const navCmd = isWindows
                    ? `cd /d ${cleanCwd} && cd ${cleanTarget} && cd`
                    : `cd "${cleanCwd}" && cd "${cleanTarget}" && pwd`;

                const data = await sendEngineCmd(navCmd);
                let resolved: string | undefined;

                if (data.status === 'success' && data.output) {
                    const lines = data.output.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    const candidate = lines[lines.length - 1];
                    if (candidate && isValidPath(candidate, isWindows)) {
                        resolved = candidate;
                    }
                }

                // If direct cd failed, try Smart Workspace Directory Auto-Jump
                if (!resolved && !cleanTarget.startsWith('.') && !cleanTarget.includes('/') && !cleanTarget.includes('\\')) {
                    // Check in files prop first (fast in-memory lookup)
                    let matchedSubdir = '';
                    const lowerTarget = cleanTarget.toLowerCase();
                    for (const f of Object.values(files || {}) as ProjectFile[]) {
                        if (!f?.path) continue;
                        const norm = f.path.replace(/\\/g, '/');
                        const parts = norm.split('/');
                        for (let i = 1; i < parts.length; i++) {
                            const dirPart = parts.slice(0, i).join('/');
                            const dirName = parts[i - 1]?.toLowerCase();
                            if (dirName === lowerTarget || dirPart.toLowerCase().endsWith('/' + lowerTarget)) {
                                matchedSubdir = dirPart;
                                break;
                            }
                        }
                        if (matchedSubdir) break;
                    }

                    if (matchedSubdir) {
                        const subCmd = isWindows
                            ? `cd /d ${cleanCwd} && cd ${matchedSubdir.replace(/\//g, '\\')} && cd`
                            : `cd "${cleanCwd}" && cd "${matchedSubdir}" && pwd`;
                        const subRes = await sendEngineCmd(subCmd);
                        if (subRes.status === 'success' && subRes.output) {
                            const subLines = subRes.output.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            const subCandidate = subLines[subLines.length - 1];
                            if (subCandidate && isValidPath(subCandidate, isWindows)) {
                                resolved = subCandidate;
                                term.writeln(`\x1b[90m-> Auto-jumped to workspace folder: ${matchedSubdir}\x1b[0m`);
                            }
                        }
                    }

                    // Fallback to fast OS deep probe if not found in files prop
                    if (!resolved) {
                        const probeCmd = isWindows
                            ? `cd /d ${cleanCwd} && dir /s /b /ad ${cleanTarget} 2>nul`
                            : `find "${cleanCwd}" -maxdepth 5 -type d -name "${cleanTarget}" 2>/dev/null`;
                        const probeRes = await sendEngineCmd(probeCmd);
                        if (probeRes.status === 'success' && probeRes.output) {
                            const firstFound = probeRes.output.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0];
                            if (firstFound && isValidPath(firstFound, isWindows)) {
                                resolved = firstFound;
                                term.writeln(`\x1b[90m-> Auto-jumped to workspace folder: ${firstFound}\x1b[0m`);
                            }
                        }
                    }
                }

                if (resolved && isValidPath(resolved, isWindows)) {
                    curSession.cwd = resolved;
                    setSessions([...sessionsRef.current]);
                } else {
                    const errMsg = data.output?.trim() || `The system cannot find the path specified.`;
                    term.writeln(`\x1b[31m${errMsg}\x1b[0m`);
                }
                return;
            }

            // General command execution inside session cwd (native Windows cmd / Unix sh)
            const cleanCwd = effectiveCwd.replace(/^["']|["']$/g, '').trim();
            const hostCmd = isWindows
                ? `cd /d ${cleanCwd} && ${trimmed}`
                : `cd "${cleanCwd}" && ${trimmed}`;

            const data = await sendEngineCmd(hostCmd);
            if (data.status === 'error' && (data.output?.includes('Engine connection failed') || data.output?.includes('Failed to fetch'))) {
                term.writeln(`\x1b[33m[Cluaiz Engine Offline]\x1b[0m Cannot execute host command.`);
                term.writeln(`\x1b[90mThe local Cluaiz engine backend (http://127.0.0.1:8000) is offline. Start the Cluaiz engine to execute system commands.\x1b[0m`);
            } else if (data.output) {
                const cleanOutput = data.output.replace(/\r?\n/g, '\r\n');
                if (data.status === 'error') {
                    term.writeln(`\x1b[31m${cleanOutput}\x1b[0m`);
                } else {
                    term.writeln(cleanOutput);
                }
            }
        } catch (err: any) {
            term.writeln(`\x1b[31m[Cluaiz Engine Error]: ${err?.message || err}\x1b[0m`);
        } finally {
            setIsExecuting(false);
            printPrompt(curSession.cwd || effectiveCwd, curSession.shellType, undefined, false);
            // Instant Live File Tree Auto-Sync (like VS Code): automatically update workspace tree after terminal commands
            useProjectStore.getState().syncFromDisk().catch(() => {});
        }
    }, [printPrompt, getActiveSession, isWindows, systemCwd, rootPath, files]);

    // Dynamic XTerm theme generator from active CSS tokens
    const getXTermTheme = useCallback(() => {
        const computed = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
        const bgPrimary = computed?.getPropertyValue('--bg-primary')?.trim() || '#0d1117';
        const bgSecondary = computed?.getPropertyValue('--bg-secondary')?.trim() || '#161b22';
        const textPrimary = computed?.getPropertyValue('--text-primary')?.trim() || '#e6edf3';
        const textMuted = computed?.getPropertyValue('--text-muted')?.trim() || '#8b949e';
        const accentColor = computed?.getPropertyValue('--accent-color')?.trim() || '#38bdf8';
        const accentRgb = computed?.getPropertyValue('--accent-color-rgb')?.trim() || '56, 189, 248';

        return {
            background: bgPrimary,
            foreground: textPrimary,
            cursor: accentColor,
            cursorAccent: bgPrimary,
            selectionBackground: `rgba(${accentRgb}, 0.28)`,
            black: bgSecondary,
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#e3b341',
            blue: accentColor,
            magenta: '#d2a8ff',
            cyan: accentColor,
            white: textPrimary,
            brightBlack: textMuted,
            brightRed: '#ffa198',
            brightGreen: '#56d364',
            brightYellow: '#f1e05a',
            brightBlue: accentColor,
            brightMagenta: '#e2c5ff',
            brightCyan: accentColor,
            brightWhite: '#ffffff',
        };
    }, []);

    // Dynamically update terminal theme on active theme switch
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getXTermTheme();
        }
    }, [theme, getXTermTheme]);

    // Handle Tab Autocompletion
    const handleTabCompletion = useCallback(async () => {
        const term = xtermRef.current;
        const curSession = getActiveSession();
        if (!term || !curSession) return;

        const line = currentLineRef.current;
        const lastWord = line.split(' ').pop() || '';
        if (!lastWord) return;

        try {
            const effectiveCwd = (isValidPath(curSession.cwd, isWindows) ? curSession.cwd : '') || 
                                 (isValidPath(systemCwd, isWindows) ? systemCwd : '') || 
                                 rootPath || 
                                 (isWindows ? 'C:\\Users' : '.');
            const cleanCwd = effectiveCwd.replace(/^["']|["']$/g, '').trim();
            const cleanPrefix = lastWord.replace(/^["']|["']$/g, '').trim();

            const tabCmd = isWindows
                ? `cd /d ${cleanCwd} && dir /b /a ${cleanPrefix}* 2>nul`
                : `cd "${cleanCwd}" && ls -d ${cleanPrefix}* 2>/dev/null`;

            const data = await sendEngineCmd(tabCmd);
            if (data.status === 'success' && data.output) {
                const matches = data.output.trim().split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
                if (matches.length === 1) {
                    const match = matches[0];
                    const completion = match.slice(lastWord.length);
                    currentLineRef.current += completion;
                    term.write(completion);
                } else if (matches.length > 1) {
                    term.writeln('\r\n' + matches.join('   '));
                    printPrompt(curSession.cwd, curSession.shellType);
                    term.write(currentLineRef.current);
                }
            }
        } catch {}
    }, [getActiveSession, printPrompt, isWindows, systemCwd, rootPath]);

    const isExecutingRef = useRef(isExecuting);
    isExecutingRef.current = isExecuting;
    const executeOnSystemRef = useRef(executeOnSystem);
    executeOnSystemRef.current = executeOnSystem;
    const handleTabCompletionRef = useRef(handleTabCompletion);
    handleTabCompletionRef.current = handleTabCompletion;
    const printPromptRef = useRef(printPrompt);
    printPromptRef.current = printPrompt;

    // Initialize or switch Xterm
    useEffect(() => {
        if (!isOpen || !terminalContainerRef.current) return;

        if (xtermRef.current) {
            xtermRef.current.dispose();
            xtermRef.current = null;
        }

        const term = new XTerm({
            theme: getXTermTheme(),
            fontFamily: 'Consolas, "Fira Code", monospace, "Courier New"',
            fontSize: 13,
            lineHeight: 1.35,
            cursorBlink: true,
            cursorStyle: 'block',
            cursorWidth: 2,
            smoothScrollDuration: 120,
            scrollback: 5000,
            allowTransparency: true,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalContainerRef.current);
        fitAddon.fit();

        // Responsive ResizeObserver: ensures canvas & scrollbar stay perfectly synced with container
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                try { fitAddon.fit(); } catch {}
            });
        });
        if (terminalContainerRef.current) {
            resizeObserver.observe(terminalContainerRef.current);
        }

        // Attach native clipboard copy & paste
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            // Handle Ctrl+C (Copy if text is selected, else let xterm emit ^C)
            if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
                if (term.hasSelection()) {
                    navigator.clipboard.writeText(term.getSelection());
                    return false;
                }
                return true;
            }

            // Handle Ctrl+V (Paste directly into command buffer and screen)
            if (event.ctrlKey && (event.key === 'v' || event.key === 'V')) {
                if (event.type === 'keydown') {
                    navigator.clipboard.readText().then((text) => {
                        if (text) {
                            const clean = text.replace(/[\r\n]+/g, ' ');
                            currentLineRef.current += clean;
                            term.write(clean);
                        }
                    }).catch(() => {});
                }
                return false;
            }

            return true;
        });

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const curSession = getActiveSession();
        currentLineRef.current = '';

        // Clean direct initial prompt with dynamic host path resolution
        const initTerminalPrompt = async () => {
            let activeCwd = curSession.cwd || systemCwd;
            if (!isValidPath(activeCwd, isWindows)) {
                activeCwd = '';
            }
            if (!activeCwd) {
                try {
                    const stored = localStorage.getItem('cluaiz_user_profile_dir') || '';
                    if (isValidPath(stored, isWindows)) {
                        activeCwd = stored;
                    } else {
                        localStorage.removeItem('cluaiz_user_profile_dir');
                    }
                } catch {}
            }
            if (!activeCwd) {
                try {
                    const probeCmd = isWindows ? 'echo %USERPROFILE%' : 'echo $HOME';
                    const res = await sendEngineCmd(probeCmd);
                    if (res?.status === 'success' && res.output) {
                        const probed = res.output.trim().split(/[\r\n]+/)[0]?.trim();
                        if (isValidPath(probed, isWindows)) {
                            activeCwd = probed;
                            try { localStorage.setItem('cluaiz_user_profile_dir', probed); } catch {}
                        }
                    }
                } catch {}
            }
            const fallbackPath = rootPath || (isWindows ? 'C:\\Users' : '~');
            const finalCwd = isValidPath(activeCwd, isWindows) ? activeCwd : fallbackPath;
            curSession.cwd = finalCwd;
            setSystemCwd(finalCwd);
            setSessions(prev => prev.map(s => s.id === curSession.id ? { ...s, cwd: finalCwd } : s));
            printPrompt(finalCwd, curSession.shellType, term, false);
        };
        initTerminalPrompt();

        // Native Keystroke Handler
        const disposable = term.onData((data) => {
            if (isExecutingRef.current) return;
            const activeSess = getActiveSession();

            if (data === '\r') { executeOnSystemRef.current(currentLineRef.current); return; }
            if (data === '\t') { handleTabCompletionRef.current(); return; }
            if (data === '\u007F' || data === '\b') {
                if (currentLineRef.current.length > 0) {
                    currentLineRef.current = currentLineRef.current.slice(0, -1);
                    term.write('\b \b');
                }
                return;
            }
            if (data === '\u0003') {
                term.write('^C');
                currentLineRef.current = '';
                printPromptRef.current(activeSess.cwd, activeSess.shellType);
                return;
            }
            if (data === '\u001b[A') {
                if (activeSess.commandHistory.length === 0) return;
                const newIdx = activeSess.historyIndex === null ? activeSess.commandHistory.length - 1 : Math.max(0, activeSess.historyIndex - 1);
                activeSess.historyIndex = newIdx;
                const prevCmd = activeSess.commandHistory[newIdx];
                while (currentLineRef.current.length > 0) { term.write('\b \b'); currentLineRef.current = currentLineRef.current.slice(0, -1); }
                currentLineRef.current = prevCmd; term.write(prevCmd);
                return;
            }
            if (data === '\u001b[B') {
                if (activeSess.historyIndex === null) return;
                const newIdx = activeSess.historyIndex + 1;
                while (currentLineRef.current.length > 0) { term.write('\b \b'); currentLineRef.current = currentLineRef.current.slice(0, -1); }
                if (newIdx >= activeSess.commandHistory.length) {
                    activeSess.historyIndex = null; currentLineRef.current = '';
                } else {
                    activeSess.historyIndex = newIdx;
                    const nextCmd = activeSess.commandHistory[newIdx];
                    currentLineRef.current = nextCmd; term.write(nextCmd);
                }
                return;
            }

            // Standard character input
            if (data.length === 1 && data >= ' ') {
                currentLineRef.current += data;
                term.write(data);
            }
        });

        const handleResize = () => {
            try { fitAddon.fit(); } catch {}
        };
        window.addEventListener('resize', handleResize);

        return () => {
            disposable.dispose();
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            term.dispose();
            xtermRef.current = null;
        };
    }, [isOpen, activeSessionId]);

    // Handle Height Resizing
    const handleMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!isResizingRef.current) return;
            setTerminalHeight(Math.max(140, Math.min(650, window.innerHeight - moveEvent.clientY)));
            try { fitAddonRef.current?.fit(); } catch {}
        };
        const onMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Add Session
    const handleAddSession = (type: 'powershell' | 'cmd' | 'bash' | 'zsh' = defaultShell) => {
        const base = getBaseRootPath();
        const baseName = projectName || base.split(/[\\/]/).filter(Boolean).pop() || 'terminal';
        const newId = `sess-${Date.now()}`;
        setSessions(prev => [...prev, {
            id: newId, displayName: baseName, targetType: 'root', shellType: type,
            cwd: base, commandHistory: [], historyIndex: null
        }]);
        setActiveSessionId(newId);
        setIsNewMenuOpen(false);
    };

    // Close Session
    const handleCloseSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (sessions.length <= 1) {
            onClose();
            return;
        }
        const filtered = sessions.filter(s => s.id !== id);
        setSessions(filtered);
        if (activeSessionId === id) {
            setActiveSessionId(filtered[filtered.length - 1].id);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            style={{ height: isMaximized ? '80%' : `${terminalHeight}px`, backgroundColor: 'var(--bg-primary)' }}
            className="w-full border-t border-[var(--border-color)]/80 flex flex-col font-mono text-xs flex-shrink-0 z-30 select-none shadow-2xl transition-all duration-150"
        >
            {/* Top Resize Dragger */}
            <div 
                onMouseDown={handleMouseDownResize}
                className="h-1 w-full hover:bg-[var(--accent-color)]/60 cursor-row-resize transition-colors flex-shrink-0"
                title="Drag to resize terminal"
            />

            {/* UNIFIED TOP HEADER: Tabs on Left + Controls on Right */}
            <div className="h-8 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] px-2 flex items-center justify-between flex-shrink-0">
                {/* Left Zone: Title + Inline Tabs + Add Button */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 mr-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)] pr-1 shrink-0">
                        <TerminalIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        TERMINAL
                    </span>

                    <div className="h-3.5 w-px bg-[var(--border-color)]/60 shrink-0 mx-0.5" />

                    {/* Inline Terminal Session Tabs with Code-Editor Style Icons */}
                    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                        {sessions.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            const isFile = sess.targetType === 'file';
                            const ext = sess.displayName.includes('.') ? sess.displayName.split('.').pop()?.toLowerCase() : undefined;
                            return (
                                <div
                                    key={sess.id}
                                    onClick={() => setActiveSessionId(sess.id)}
                                    className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] cursor-pointer transition-all shrink-0 ${
                                        isActive
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-medium border border-[var(--accent-color)]/30'
                                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    {isFile ? (
                                        <FileIcon fileName={sess.displayName} fileExtension={ext} languageId={ext} size={13} />
                                    ) : (
                                        <FolderIcon folderName={sess.displayName} isOpen={isActive} size={13} />
                                    )}
                                    <span className="truncate max-w-[130px] font-mono">{sess.displayName}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleCloseSession(e, sess.id)}
                                        title="Close Terminal"
                                        className="opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-primary)] p-0.5 rounded text-[var(--text-muted)] hover:text-rose-400 transition-all shrink-0 cursor-pointer"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add New Session Button (+) with Dropdown */}
                    <div className="relative shrink-0">
                        <div className="flex items-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <button
                                type="button"
                                onClick={() => handleAddSession(defaultShell)}
                                title={`New Terminal (${defaultShell})`}
                                className="p-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsNewMenuOpen(prev => !prev)}
                                className="p-0.5 pr-1 cursor-pointer"
                                title="Select Shell"
                            >
                                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                            </button>
                        </div>

                        {isNewMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsNewMenuOpen(false)} />
                                <div className="absolute left-0 top-full mt-1 w-36 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl p-1 z-50 text-[11px]">
                                    {(isWindows ? ['powershell', 'cmd'] : ['bash', 'zsh']).map((sh) => (
                                        <button
                                            key={sh}
                                            type="button"
                                            onClick={() => handleAddSession(sh as any)}
                                            className="w-full text-left px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] capitalize cursor-pointer"
                                        >
                                            {sh === 'cmd' ? 'Command Prompt' : sh}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Zone: Running indicator + Window Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {isExecuting && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent-color)] font-mono animate-pulse mr-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Running...
                        </span>
                    )}

                    {/* Window Controls */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsMaximized(prev => !prev);
                            setTimeout(() => fitAddonRef.current?.fit(), 160);
                        }}
                        title={isMaximized ? "Restore" : "Maximize"}
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                        {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close Terminal"
                        className="p-1 rounded hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* 100% Full-Width xterm.js Canvas Container with Right-Click Paste */}
            <div 
                ref={terminalContainerRef}
                className="flex-1 w-full h-full overflow-hidden select-text relative terminal-viewport-container"
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (xtermRef.current?.hasSelection()) {
                        navigator.clipboard.writeText(xtermRef.current.getSelection());
                    } else {
                        navigator.clipboard.readText().then((text) => {
                            if (text && xtermRef.current) {
                                const clean = text.replace(/[\r\n]+/g, ' ');
                                currentLineRef.current += clean;
                                xtermRef.current.write(clean);
                            }
                        }).catch(() => {});
                    }
                }}
            />
        </div>
    );
};
