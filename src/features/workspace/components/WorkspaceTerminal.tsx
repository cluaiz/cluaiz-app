import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Terminal as TerminalIcon, X, Maximize2, Minimize2, Plus, 
    ChevronDown, Shield, ShieldAlert, ShieldCheck, Loader2, Check, Ban 
} from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ProjectFile } from '../types';
import { useSystemStore } from '../../../api/engine/system/system.store';
import type { CmdResponse } from '../../../api/engine/system/system.types';
import { FileIcon, FolderIcon } from 'react-material-icon-theme';

export type SecurityMode = 'full_access' | 'sandboxed' | 'strict';

const sendEngineCmd = (command: string): Promise<CmdResponse> => {
    return useSystemStore.getState().executeCommand(command);
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

    const [systemCwd, setSystemCwd] = useState<string>(() => {
        try { return localStorage.getItem('cluaiz_user_profile_dir') || ''; } catch { return ''; }
    });

    const getBaseRootPath = useCallback(() => rootPath || systemCwd || '', [rootPath, systemCwd]);

    // Proactively resolve host user profile directory ($env:USERPROFILE) when no workspace is open
    useEffect(() => {
        if (!rootPath) {
            const probeCmd = isWindows 
                ? 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$env:USERPROFILE"' 
                : 'echo $HOME';
            sendEngineCmd(probeCmd).then(res => {
                const probed = res?.output?.trim().split(/[\r\n]+/)[0]?.trim();
                if (probed && probed.length > 1) {
                    try { localStorage.setItem('cluaiz_user_profile_dir', probed); } catch {}
                    setSystemCwd(probed);
                    setSessions(prev => prev.map(s => (s.id === 'sess-1' && !s.cwd) ? { ...s, cwd: probed } : s));
                }
            }).catch(() => {});
        }
    }, [rootPath, isWindows]);

    const [terminalHeight, setTerminalHeight] = useState(250);
    const [isMaximized, setIsMaximized] = useState(false);
    const [securityMode, setSecurityMode] = useState<SecurityMode>('sandboxed');
    const [pendingReviewCmd, setPendingReviewCmd] = useState<string | null>(null);
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

        // Proactively ensure target folder exists on disk via engine
        const mkdirCmd = isWindows 
            ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Test-Path -LiteralPath '${targetPath}')) { New-Item -ItemType Directory -Path '${targetPath}' -Force | Out-Null }"`
            : `mkdir -p "${targetPath}"`;
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

        // Strict Review check
        if (securityMode === 'strict' && !pendingReviewCmd) {
            setPendingReviewCmd(trimmed);
            return;
        }

        // Sandboxed check
        if (securityMode === 'sandboxed') {
            const forbiddenPaths = ['c:\\windows', 'c:\\program files', '/etc', '/bin', '/usr'];
            const lower = trimmed.toLowerCase();
            const touchesForbidden = forbiddenPaths.some(fp => lower.includes(fp));
            if (touchesForbidden && !pendingReviewCmd) {
                setPendingReviewCmd(trimmed);
                return;
            }
        }

        setIsExecuting(true);
        term.write('\r\n');

        try {
            // Effective directory fallback
            const effectiveCwd = curSession.cwd || systemCwd || '.';
            const safeCwd = effectiveCwd.replace(/'/g, "''");

            // Builtin cd navigation
            if (trimmed.toLowerCase().startsWith('cd ') || trimmed.toLowerCase() === 'cd') {
                const target = trimmed.slice(2).trim();
                if (!target) {
                    term.writeln(`\x1b[90m${effectiveCwd}\x1b[0m`);
                    printPrompt(effectiveCwd, curSession.shellType);
                    setIsExecuting(false);
                    return;
                }

                const script = `& { if (-not (Test-Path -LiteralPath '${safeCwd}')) { New-Item -ItemType Directory -Path '${safeCwd}' -Force | Out-Null }; Set-Location -LiteralPath '${safeCwd}'; Set-Location '${target.replace(/'/g, "''")}'; (Get-Location).Path }`;
                const data = await sendEngineCmd(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script}"`);
                if (data.status === 'success' && data.output) {
                    const lines = data.output.trim().split('\n');
                    const resolved = lines[lines.length - 1]?.trim();
                    if (resolved && resolved.length > 2) {
                        curSession.cwd = resolved;
                        setSessions([...sessionsRef.current]);
                    }
                } else {
                    term.writeln(`\x1b[31mSet-Location: Cannot find path '${target}' because it does not exist.\x1b[0m`);
                }
                printPrompt(curSession.cwd || effectiveCwd, curSession.shellType);
                setIsExecuting(false);
                return;
            }

            // General command execution inside session cwd
            const escaped = trimmed.replace(/"/g, '`"');
            const pwshScript = curSession.shellType === 'cmd'
                ? `& { if (-not (Test-Path -LiteralPath '${safeCwd}')) { New-Item -ItemType Directory -Path '${safeCwd}' -Force | Out-Null }; Set-Location -LiteralPath '${safeCwd}'; cmd.exe /c "${trimmed.replace(/"/g, '\\"')}" }`
                : `& { if (-not (Test-Path -LiteralPath '${safeCwd}')) { New-Item -ItemType Directory -Path '${safeCwd}' -Force | Out-Null }; Set-Location -LiteralPath '${safeCwd}'; ${escaped} }`;
            const data = await sendEngineCmd(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${pwshScript}"`);
            if (data.output) {
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
            setPendingReviewCmd(null);
            printPrompt(curSession.cwd, curSession.shellType);
        }
    }, [printPrompt, securityMode, pendingReviewCmd, getActiveSession]);

    // Handle Tab Autocompletion
    const handleTabCompletion = useCallback(async () => {
        const term = xtermRef.current;
        const curSession = getActiveSession();
        if (!term || !curSession) return;

        const line = currentLineRef.current;
        const lastWord = line.split(' ').pop() || '';
        if (!lastWord) return;

        try {
            const effectiveCwd = curSession.cwd || systemCwd || '.';
            const safeCwd = effectiveCwd.replace(/'/g, "''");
            const script = `& { if (Test-Path -LiteralPath '${safeCwd}') { Set-Location -LiteralPath '${safeCwd}'; Get-ChildItem -Name | Where-Object { $_ -like '${lastWord}*' } } }`;
            const data = await sendEngineCmd(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script}"`);
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
    }, [getActiveSession, printPrompt]);

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
            theme: {
                background: '#0d1117', foreground: '#e6edf3', cursor: '#38bdf8', cursorAccent: '#0d1117',
                selectionBackground: 'rgba(56, 189, 248, 0.25)', black: '#21262d', red: '#ff7b72',
                green: '#3fb950', yellow: '#e3b341', blue: '#58a6ff', magenta: '#d2a8ff', cyan: '#39c5cf',
                white: '#b1bac4', brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
                brightYellow: '#f1e05a', brightBlue: '#79c0ff', brightMagenta: '#e2c5ff', brightCyan: '#56d4dd', brightWhite: '#ffffff',
            },
            fontFamily: 'Consolas, "Fira Code", monospace, "Courier New"',
            fontSize: 12, lineHeight: 1.25, cursorBlink: true, cursorStyle: 'bar',
            allowTransparency: true, convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalContainerRef.current);
        fitAddon.fit();

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
            if (!activeCwd) {
                try { activeCwd = localStorage.getItem('cluaiz_user_profile_dir') || ''; } catch {}
            }
            if (!activeCwd) {
                try {
                    const probeCmd = isWindows 
                        ? 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$env:USERPROFILE"' 
                        : 'echo $HOME';
                    const res = await sendEngineCmd(probeCmd);
                    const probed = res?.output?.trim().split(/[\r\n]+/)[0]?.trim();
                    if (probed && probed.length > 1) {
                        activeCwd = probed;
                        try { localStorage.setItem('cluaiz_user_profile_dir', probed); } catch {}
                    }
                } catch {}
            }
            const finalCwd = activeCwd || (isWindows ? 'C:\\Users' : '~');
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
            style={{ height: isMaximized ? '80%' : `${terminalHeight}px` }}
            className="w-full border-t border-[var(--border-color)]/80 bg-[#0d1117] flex flex-col font-mono text-xs flex-shrink-0 z-30 select-none shadow-2xl transition-all duration-150"
        >
            {/* Top Resize Dragger */}
            <div 
                onMouseDown={handleMouseDownResize}
                className="h-1 w-full hover:bg-[var(--accent-color)]/60 cursor-row-resize transition-colors flex-shrink-0"
                title="Drag to resize terminal"
            />

            {/* UNIFIED TOP HEADER: Tabs on Left + Controls on Right */}
            <div className="h-8 border-b border-white/[0.08] bg-zinc-950/90 px-2 flex items-center justify-between flex-shrink-0">
                {/* Left Zone: Title + Inline Tabs + Add Button */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 mr-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 pr-1 shrink-0">
                        <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
                        TERMINAL
                    </span>

                    <div className="h-3.5 w-px bg-white/10 shrink-0 mx-0.5" />

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
                                            ? 'bg-white/[0.10] text-cyan-300 font-medium border border-cyan-500/30'
                                            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
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
                                        className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded text-zinc-500 hover:text-rose-400 transition-all shrink-0"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add New Session Button (+) with Dropdown */}
                    <div className="relative shrink-0">
                        <div className="flex items-center rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                            <button
                                type="button"
                                onClick={() => handleAddSession(defaultShell)}
                                title={`New Terminal (${defaultShell})`}
                                className="p-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsNewMenuOpen(prev => !prev)}
                                className="p-0.5 pr-1"
                                title="Select Shell"
                            >
                                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                            </button>
                        </div>

                        {isNewMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsNewMenuOpen(false)} />
                                <div className="absolute left-0 top-full mt-1 w-36 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl p-1 z-50 text-[11px]">
                                    {(isWindows ? ['powershell', 'cmd'] : ['bash', 'zsh']).map((sh) => (
                                        <button
                                            key={sh}
                                            type="button"
                                            onClick={() => handleAddSession(sh as any)}
                                            className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-zinc-200 capitalize"
                                        >
                                            {sh === 'cmd' ? 'Command Prompt' : sh}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Zone: Security Sandbox Selector + Window Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Security Sandbox Mode Selector */}
                    <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/5 text-[10px]">
                        <button
                            type="button"
                            onClick={() => setSecurityMode('full_access')}
                            title="Full access: Agents have full access to machine & resources."
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${securityMode === 'full_access' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Shield className="w-2.5 h-2.5" /> Full Access
                        </button>
                        <button
                            type="button"
                            onClick={() => setSecurityMode('sandboxed')}
                            title="Sandboxed: Agents run restricted to trusted folders."
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${securityMode === 'sandboxed' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <ShieldCheck className="w-2.5 h-2.5" /> Sandboxed
                        </button>
                        <button
                            type="button"
                            onClick={() => setSecurityMode('strict')}
                            title="Strict: Terminal commands always require manual review."
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${securityMode === 'strict' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <ShieldAlert className="w-2.5 h-2.5" /> Strict
                        </button>
                    </div>

                    {isExecuting && (
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono animate-pulse">
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
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close Terminal"
                        className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Strict / Sandbox Review Modal Banner */}
            {pendingReviewCmd && (
                <div className="bg-amber-950/90 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-200">
                    <span className="flex items-center gap-1.5 font-mono">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Confirm Command:</span>
                        <code className="bg-black/40 px-1.5 py-0.5 rounded text-white font-bold">{pendingReviewCmd}</code>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const cmd = pendingReviewCmd;
                                setPendingReviewCmd(null);
                                setTimeout(() => executeOnSystem(cmd), 40);
                            }}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                            <Check className="w-3 h-3" />
                            Run
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPendingReviewCmd(null);
                                const term = xtermRef.current;
                                if (term) {
                                    term.writeln('\r\n\x1b[31mCancelled by user.\x1b[0m');
                                    const sess = getActiveSession();
                                    printPrompt(sess.cwd, sess.shellType);
                                }
                            }}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold border border-rose-500/30 transition-colors cursor-pointer"
                        >
                            <Ban className="w-3 h-3" />
                            Deny
                        </button>
                    </div>
                </div>
            )}

            {/* 100% Full-Width xterm.js Canvas Container with Right-Click Paste */}
            <div 
                ref={terminalContainerRef}
                className="flex-1 w-full h-full overflow-hidden p-2 select-text"
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
