import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Terminal as TerminalIcon, X, Maximize2, Minimize2, Plus, 
    Loader2
} from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ProjectFile } from '../types';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { useTerminalHost } from '../hooks/useTerminalHost';
import { useTerminalExecution } from '../hooks/useTerminalExecution';
import { terminalPath, changeTerminalDirectory, completeTerminalPath, terminalCommand } from '../hooks/terminalPaths';
import { Button } from '../../../components/ui/Button';
import { FileIcon, FolderIcon } from 'react-material-icon-theme';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { useProjectStore } from '../../../store/workspace/useProjectStore';

export interface TerminalTarget {
    path: string;
    type: 'folder' | 'file' | 'root';
    token: number;
}

export interface TerminalSession {
    id: string;
    origin: string;
    displayName: string;
    targetType: 'folder' | 'file' | 'root';
    shellType: 'cmd' | 'sh';
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
    const connection = useConnectionStore(s => `${s.protocol}:${s.host}:${s.port}`);
    const host = useTerminalHost(isOpen, connection, rootPath);
    const isWindows = host.windows;
    const defaultShell = isWindows ? 'cmd' as const : 'sh' as const;

    const { theme } = useThemeStore();

    const getBaseRootPath = useCallback(() => host.workspace, [host.workspace]);

    const [terminalHeight, setTerminalHeight] = useState(250);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const isExecutingRef = useRef(isExecuting);
    isExecutingRef.current = isExecuting;
    const origin = JSON.stringify([connection, host.workspace]);

    // Multi-session state
    const [sessions, setSessions] = useState<TerminalSession[]>([
        {
            id: 'sess-1',
            origin,
            displayName: projectName || 'terminal',
            targetType: 'root',
            shellType: defaultShell,
            cwd: getBaseRootPath(),
            commandHistory: [],
            historyIndex: null
        }
    ]);
    const [activeSessionId, setActiveSessionId] = useState<string>('sess-1');
    const execution = useTerminalExecution(JSON.stringify([isOpen, connection, activeSessionId, host.ready, host.workspace]));
    useEffect(() => { isExecutingRef.current = false; setIsExecuting(false); }, [isOpen, connection, activeSessionId, host.ready, host.workspace]);
    useEffect(() => {
        if (!host.ready) return;
        setSessions([{ id: 'sess-1', origin, displayName: projectName || 'terminal', targetType: 'root',
            shellType: defaultShell, cwd: host.workspace, commandHistory: [], historyIndex: null }]);
        setActiveSessionId('sess-1');
    }, [connection, host.ready]);

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
    const printPrompt = useCallback((path: string, _shell: string, term?: XTerm, withNewline = true) => {
        const targetTerm = term || xtermRef.current;
        if (!targetTerm) return;
        const normalized = path || getBaseRootPath();
        const prefix = withNewline ? '\r\n' : '';
        if (isWindows) {
            targetTerm.write(`${prefix}\x1b[90m${normalized}\x1b[0m\x1b[33m>\x1b[0m `);
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
        if (!isOpen || !host.ready) return;

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

        const targetPath = terminalPath(getBaseRootPath(), dirSub || '.');

        const existing = sessionsRef.current.find(s => s.origin === origin && (isWindows
            ? s.cwd.toLowerCase() === targetPath.toLowerCase() : s.cwd === targetPath));
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
            origin,
            displayName,
            targetType,
            shellType: defaultShell,
            cwd: targetPath,
            commandHistory: [],
            historyIndex: null
        };

        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newId);
    }, [terminalTarget, initialCwd, isOpen, host.ready, origin, defaultShell, getBaseRootPath, projectName, isWindows]);

    // Execute Command on OS via Engine
    const executeOnSystem = useCallback(async (commandToRun: string) => {
        const term = xtermRef.current;
        const curSession = getActiveSession();
        if (!term || !curSession || !host.ready || isExecutingRef.current) return;

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

        const effectiveCwd = curSession.cwd || host.workspace;

        isExecutingRef.current = true;
        setIsExecuting(true);
        term.write('\r\n');

        try {
            // Navigation uses the existing filesystem API, never a shell probe.
            const cdRegex = /^cd(\.\.|[\/\\]|~|\s.*|$)/i;
            if (cdRegex.test(trimmed)) {
                const target = trimmed.slice(2).trim();
                if (!target) { term.writeln(effectiveCwd); return; }
                const resolved = await changeTerminalDirectory(effectiveCwd, target);
                if (xtermRef.current !== term) return;
                curSession.cwd = resolved;
                setSessions([...sessionsRef.current]);
                return;
            }

            // Engine chooses cmd/sh and enforces shell policy before any process starts.
            const data = await execution.execute(terminalCommand(effectiveCwd, trimmed, isWindows));
            if (xtermRef.current !== term) return;
            if (data.output) term.writeln(data.output.replace(/\r?\n/g, '\r\n'));
            if (data.status === 'error') term.writeln(`[Process exited: ${data.exit_code ?? 'no exit code'}]`);
            useProjectStore.getState().syncFromDisk().catch(() => {});
        } catch (err: unknown) {
            if (xtermRef.current === term) term.writeln(`[Cluaiz Engine Error]: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            if (xtermRef.current === term) {
                isExecutingRef.current = false;
                setIsExecuting(false);
                printPrompt(curSession.cwd || effectiveCwd, curSession.shellType, term, false);
            }
        }
    }, [printPrompt, getActiveSession, isWindows, host.ready, host.workspace, execution.execute]);

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

    // Completion lists existing Engine files, without executing ls/dir.
    const handleTabCompletion = useCallback(async () => {
        const term = xtermRef.current, session = getActiveSession();
        const line = currentLineRef.current;
        const word = line.split(' ').pop() || '';
        if (!term || !session || !word || !host.ready || isExecutingRef.current) return;
        try {
            const data = await completeTerminalPath(session.cwd || host.workspace, word);
            if (xtermRef.current !== term || currentLineRef.current !== line) return;
            if (data.matches.length === 1) {
                const completion = data.matches[0].slice(word.length);
                currentLineRef.current += completion;
                term.write(completion);
            } else if (data.matches.length > 1) {
                term.writeln('\r\n' + data.matches.join('   '));
            }
            if (data.truncated || data.skipped) term.writeln('\r\n[Directory listing is partial]');
            if (data.matches.length > 1 || data.truncated || data.skipped) {
                printPrompt(session.cwd, session.shellType);
                term.write(currentLineRef.current);
            }
        } catch (error) {
            if (xtermRef.current === term) term.writeln(`\r\n[Completion unavailable]: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [getActiveSession, printPrompt, host.ready, host.workspace]);

    const executeOnSystemRef = useRef(executeOnSystem);
    executeOnSystemRef.current = executeOnSystem;
    const handleTabCompletionRef = useRef(handleTabCompletion);
    handleTabCompletionRef.current = handleTabCompletion;
    const printPromptRef = useRef(printPrompt);
    printPromptRef.current = printPrompt;

    // Initialize or switch Xterm
    useEffect(() => {
        if (!isOpen || !host.ready || !terminalContainerRef.current) return;

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

        // Prompt uses the selected Engine workspace, not a browser-cached home directory.
        curSession.cwd = curSession.origin === origin ? curSession.cwd || host.workspace : host.workspace;
        printPrompt(curSession.cwd, defaultShell, term, false);

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
    }, [isOpen, activeSessionId, host.ready, host.workspace, connection]);

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
    const handleAddSession = () => {
        const base = getBaseRootPath();
        const baseName = projectName || base.split(/[\\/]/).filter(Boolean).pop() || 'terminal';
        const newId = `sess-${Date.now()}`;
        setSessions(prev => [...prev, {
            id: newId, origin, displayName: baseName, targetType: 'root', shellType: defaultShell,
            cwd: base, commandHistory: [], historyIndex: null
        }]);
        setActiveSessionId(newId);
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

                    {/* New session uses the Engine's actual platform shell. */}
                    <div className="relative shrink-0">
                        <div className="flex items-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <button
                                type="button"
                                onClick={handleAddSession}
                                disabled={!host.ready}
                                title={`New Terminal (${defaultShell})`}
                                className="p-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>

                        </div>


                    </div>
                </div>

                {/* Right Zone: Running indicator + Window Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {isExecuting && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent-color)] font-mono animate-pulse mr-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {execution.approval ? 'Awaiting approval...' : 'Waiting for result...'}
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

            {!host.ready && <p role={host.error ? 'alert' : 'status'} className="p-2 text-xs text-[var(--text-secondary)]">
                {host.error || 'Reading Engine workspace...'}
            </p>}
            {execution.approval && <div className="flex items-center gap-2 p-2 text-xs border-b border-[var(--border-color)] text-[var(--text-primary)]">
                <span className="min-w-0 flex-1">Command approval: <code className="break-all">{execution.approval.target}</code></span>
                <Button size="sm" disabled={execution.deciding} onClick={() => void execution.decide(false)}>Reject</Button>
                <Button size="sm" disabled={execution.deciding} onClick={() => void execution.decide(true)}>Approve</Button>
            </div>}
            {execution.error && <p role="alert" className="p-2 text-xs text-[var(--text-danger)]">{execution.error}</p>}
            {/* Full-width xterm canvas; clipboard behavior stays in the existing view. */}
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
