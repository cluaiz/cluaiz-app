import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Button } from '../../Button';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

export const CodeBlockComponent = ({ node, updateAttributes, extension }: any) => {
    const [copied, setCopied] = useState(false);

    const textContent = node.textContent || '';
    let displayLanguage = node.attrs.language;
    
    if (!displayLanguage && textContent) {
        try {
            const detected = hljs.highlightAuto(textContent);
            displayLanguage = detected.language;
        } catch (e) {
            // ignore
        }
    }
    
    const finalLangName = displayLanguage || 'Code';
    const linesCount = textContent.split('\n').length;
    const lineNumbers = Array.from({ length: linesCount || 1 }, (_, i) => i + 1);

    const handleCopy = () => {
        navigator.clipboard.writeText(textContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <NodeViewWrapper className="relative group my-2 rounded-xl overflow-hidden bg-[#1e1e1e] border border-neutral-800 shadow-sm transition-all hover:shadow-md">
            {/* Header / Actions */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#252526] border-b border-[#333333]">
                <span className="text-[11px] font-bold tracking-widest text-neutral-400 uppercase select-none">
                    {finalLangName}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="h-6 w-6 rounded-md hover:bg-neutral-700/50 hover:text-white text-neutral-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Copy code"
                >
                    {copied ? <Check className="h-3 w-3 text-[var(--accent-color)]" /> : <Copy className="h-3 w-3" />}
                </Button>
            </div>
            
            {/* Code Content with Line Numbers */}
            <div className="flex items-stretch overflow-hidden bg-[#1e1e1e]">
                {/* Line Numbers Column */}
                <div className="flex flex-col text-right px-3 py-3 select-none border-r border-[#333333] text-[#858585] bg-[#1e1e1e] font-mono text-[13px] leading-[1.5rem]">
                    {lineNumbers.map((n) => (
                        <span key={n} className="inline-block">{n}</span>
                    ))}
                </div>

                {/* Actual Code content */}
                <pre className="m-0 py-3 px-4 overflow-x-auto text-[#d4d4d4] !bg-transparent custom-scrollbar !border-none font-mono text-[13px] leading-[1.5rem] flex-1">
                    <NodeViewContent as="code" className={cn(displayLanguage ? `language-${displayLanguage}` : '')} />
                </pre>
            </div>
        </NodeViewWrapper>
    );
};
