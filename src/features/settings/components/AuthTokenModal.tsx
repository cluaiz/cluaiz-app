import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, Eye, EyeOff, Loader2, Terminal, X, Copy, Check } from 'lucide-react';
import { client } from '../../../api';
import { permissionApi } from '../../../api/engine/permission/permission.api';
import { usePermissionStore } from '../../../api/engine/permission/permission.store';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { toast } from '../../../components/ui/toast';

export function AuthTokenModal() {
  const isOpen = usePermissionStore((s) => s.isAuthModalOpen);
  const setOpen = usePermissionStore((s) => s.setAuthModalOpen);
  const fetchPermission = usePermissionStore((s) => s.fetchPermission);

  const [tokenInput, setTokenInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (cmd: string) => {
    try {
      navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 1500);
      toast.success(`Copied: ${cmd}`);
    } catch {
      // Fallback
    }
  };

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMsg('Please enter a valid API Bearer token.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      // Set token via unified client and verify against permission endpoint
      client.setToken(cleanToken);
      const res = await permissionApi.getPermission();
      
      if (res && (res.status === 'success' || Boolean((res as any).permission))) {
        toast.success('Successfully authenticated with Cluaiz Engine');
        setOpen(false);
        setTokenInput('');
        // Refresh application permissions state
        await fetchPermission();
        // Also refresh engine settings so offline guard unlocks
        await useEngineStore.getState().initEngineSettings();
      } else {
        setErrorMsg('Authentication failed: Engine rejected this token.');
        client.setToken(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Verification failed: ${msg}`);
      client.setToken(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setErrorMsg(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md p-6 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl text-[var(--text-primary)]"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 rounded-xl text-[var(--accent-color)] flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Engine Authentication Required</h3>
              <p className="text-xs text-[var(--text-muted)]">API security is active on Cluaiz Engine</p>
            </div>
          </div>

          {/* Terminal Command Helper Callout */}
          <div className="p-3 mb-4 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-2">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <Terminal className="w-4 h-4 text-[var(--accent-color)]" />
              <span>How to find your token:</span>
            </div>

            <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
              Run this command in your terminal to display your active token:
            </p>

            <div className="pt-0.5">
              {/* Show Tokens Command */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] font-mono text-[11px] group">
                <span className="text-[var(--accent-color)] select-all truncate">
                  cluaiz token show
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('cluaiz token show')}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0 ml-2"
                  title="Copy command"
                >
                  {copiedCmd === 'cluaiz token show' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Sub-commands helpers */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1 pt-0.5">
                <span className="truncate">Need a new token?</span>
                <button
                  type="button"
                  onClick={() => handleCopy('cluaiz token create')}
                  className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-color)] underline underline-offset-2 transition-colors cursor-pointer ml-1 truncate"
                  title="Click to copy create command"
                >
                  cluaiz token create
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
                <span className="truncate">View all commands:</span>
                <button
                  type="button"
                  onClick={() => handleCopy('cluaiz token -h')}
                  className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-color)] underline underline-offset-2 transition-colors cursor-pointer ml-1 truncate"
                  title="Click to copy help command"
                >
                  cluaiz token -h
                </button>
              </div>
            </div>
          </div>

          {/* Token Input Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center justify-between">
                <span>API Token</span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">e.g. sk-cluaiz-758cfa11...</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste token here..."
                  className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifying || !tokenInput.trim()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--accent-contrast,#ffffff)] bg-[var(--accent-color)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
