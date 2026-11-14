import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, ExternalLink, Check, Trash2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  type CloudProviderId,
  CLOUD_PROVIDERS,
  useCloudProviderStore,
} from '../../store/cloud/useCloudProviderStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface CloudModelConfigModalProps {
  providerId: CloudProviderId | null;
  onClose: () => void;
}

export const CloudModelConfigModal: React.FC<CloudModelConfigModalProps> = ({
  providerId,
  onClose,
}) => {
  const { apiKeys, customBaseUrls, setApiKey, removeApiKey } = useCloudProviderStore();
  const [keyInput, setKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const provider = providerId ? CLOUD_PROVIDERS[providerId] : null;

  useEffect(() => {
    if (providerId) {
      setKeyInput(apiKeys[providerId] || '');
      setBaseUrlInput(customBaseUrls[providerId] || provider?.defaultBaseUrl || '');
      setSavedSuccess(false);
    }
  }, [providerId, apiKeys, customBaseUrls, provider]);

  if (!providerId || !provider) return null;

  const isConfigured = Boolean(apiKeys[providerId] && apiKeys[providerId].trim().length > 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setApiKey(providerId, keyInput.trim(), baseUrlInput.trim() || undefined);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleRemove = () => {
    removeApiKey(providerId);
    setKeyInput('');
    setSavedSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)]">
                <Key size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Configure {provider.name}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">{provider.company}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-4 space-y-4">
            {/* Status notification */}
            {isConfigured && !savedSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <ShieldCheck size={15} className="shrink-0" />
                <span>API Key configured & stored securely in local browser vault.</span>
              </div>
            )}

            {savedSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-pulse">
                <Check size={15} className="shrink-0" />
                <span>Settings saved successfully!</span>
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[var(--text-primary)]">
                  API Key <span className="text-red-400">*</span>
                </label>
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 text-[11px] text-[var(--accent-color)] hover:underline"
                >
                  <span>Get API Key</span>
                  <ExternalLink size={10} />
                </a>
              </div>

              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder={provider.apiKeyHelp}
                  wrapperClassName="w-full pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                  title={showKey ? 'Hide Key' : 'Show Key'}
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                Never sent to any third-party servers. Communicates directly from your device to {provider.name}.
              </p>
            </div>

            {/* Custom Endpoint URL (optional) */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Base URL <span className="text-[10px] font-normal text-[var(--text-muted)]">(Optional proxy / endpoint)</span>
              </label>
              <Input
                type="text"
                value={baseUrlInput}
                onChange={e => setBaseUrlInput(e.target.value)}
                placeholder={provider.defaultBaseUrl || 'https://api.example.com/v1'}
                wrapperClassName="w-full font-mono text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
              {isConfigured ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove Key</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  type="submit"
                  disabled={!keyInput.trim()}
                >
                  Save & Connect
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

