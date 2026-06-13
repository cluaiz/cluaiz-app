"use client";
import "./novel-setup";

import React, { useState, useEffect } from "react";
import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandItem,
  EditorCommandEmpty,
  EditorCommandList,
  EditorBubble,
  EditorBubbleItem,
  useEditor,
  type JSONContent,
} from "novel";
import { handleCommandNavigation } from "novel";
import { TextSelection } from "prosemirror-state";
import { defaultExtensions } from "./novel-extensions";
import { slashCommand, suggestionItems } from "./novel-slash-command";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Underline as UnderlineIcon,
  Palette,
  ExternalLink,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  ChevronDown,
  Smile,
  Plus,
  Trash2,
  Rows3,
  Columns3,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../Dialog";
import { Input } from "../../Input";
import { Button } from "../../Button";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useThemeStore } from "../../../../store/ui/useThemeStore";
import { AiFillYoutube } from "react-icons/ai";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`overflow-auto ${className}`}>{children}</div>
);

interface BrainEditorProps {
  initialContent?: any;
  onChange?: (content: any, html: string, text: string) => void;
  className?: string;
}

const defaultInitialContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [],
    },
    {
      type: "paragraph",
      content: [],
    },
  ],
};

const COLORS = [
  { name: "Default", color: "inherit" },
  { name: "Gray", color: "#6b7280" },
  { name: "Red", color: "#ef4444" },
  { name: "Orange", color: "#f97316" },
  { name: "Yellow", color: "#eab308" },
  { name: "Green", color: "#22c55e" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Purple", color: "#a855f7" },
  { name: "Pink", color: "#ec4899" },
];

function BubbleMenuContent({
  showColorSelector,
  setShowColorSelector,
  onOpenLinkModal,
  onOpenYoutubeModal
}: {
  showColorSelector: boolean,
  setShowColorSelector: (v: boolean) => void,
  onOpenLinkModal: () => void,
  onOpenYoutubeModal: () => void
}) {
  const { editor: _editor } = useEditor();
  const editor = _editor as any;
  const [colorType, setColorType] = useState<"text" | "background">("text");

  if (!editor) return null;

  return (
    <div className="flex items-center gap-1">
      {showColorSelector ? (
        <div className="flex flex-col gap-2  pt-0">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1 mb-1">
            <div className="flex gap-1">
              <button
                onClick={() => setColorType("text")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                  colorType === "text"
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Text
              </button>
              <button
                onClick={() => setColorType("background")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                  colorType === "background"
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Highlight
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowColorSelector(false)}
              className="text-[10px] font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-white px-1"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  if (c.color === "inherit") {
                    if (colorType === "text") {
                      editor.chain().focus().unsetColor().run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                  } else {
                    if (colorType === "text") {
                      editor.chain().focus().setColor(c.color).run();
                    } else {
                      editor.chain().focus().setHighlight({ color: c.color }).run();
                    }
                  }
                  setShowColorSelector(false);
                }}
                className="h-6 w-6 rounded-md border border-neutral-200 dark:border-neutral-700 transition-colors hover:scale-110 shadow-sm"
                style={{ backgroundColor: c.color === "inherit" ? "white" : c.color }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Node Type Switcher Dropdown */}
          <NodeTypeSwitcher editor={editor} />
          <div className="mx-1 h-5 w-px bg-neutral-700/60" />
          <EditorBubbleItem
            onSelect={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("bold") && "bg-white/10 text-white"
            )}
          >
            <Bold className="h-4 w-4" />
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("italic") && "bg-white/10 text-white"
            )}
          >
            <Italic className="h-4 w-4" />
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("underline") && "bg-white/10 text-white"
            )}
          >
            <UnderlineIcon className="h-4 w-4" />
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("strike") && "bg-white/10 text-white"
            )}
          >
            <Strikethrough className="h-4 w-4" />
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("code") && "bg-white/10 text-white"
            )}
          >
            <Code className="h-4 w-4" />
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={onOpenLinkModal}
            className={cn(
              "rounded-lg p-2 text-neutral-300 hover:bg-white/10",
              editor.isActive("link") && "bg-white/10 text-white"
            )}
          >
            <LinkIcon className="h-4 w-4" />
          </EditorBubbleItem>
          <div className="mx-1 h-5 w-px bg-neutral-700/60" />
          <button
            type="button"
            onClick={() => setShowColorSelector(true)}
            className="rounded-lg p-2 text-neutral-300 hover:bg-white/10"
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const event = new CustomEvent("open-emoji-modal", { detail: { editor } });
              document.dispatchEvent(event);
            }}
            className="rounded-lg p-2 text-neutral-300 hover:bg-white/10"
            title="Insert Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>

          {editor.isActive("table") && (
            <>
              <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700/60" />
              <TableActionMenu editor={editor} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// Helper component for the node type switcher
function NodeTypeSwitcher({ editor }: { editor: any }) {
  const [open, setOpen] = useState(false);

  const getCurrentLabel = () => {
    if (editor.isActive("heading", { level: 1 })) return "Heading 1";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    if (editor.isActive("bulletList")) return "Bullet List";
    if (editor.isActive("orderedList")) return "Numbered List";
    if (editor.isActive("blockquote")) return "Quote";
    if (editor.isActive("codeBlock")) return "Code";
    if (editor.isActive("taskList")) return "To-do";
    return "Text";
  };

  const options = [
    { label: "Text", icon: <Type className="h-3.5 w-3.5" />, action: () => editor.chain().focus().setParagraph().run() },
    { label: "Heading 1", icon: <Heading1 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().setNode("heading", { level: 1 }).run() },
    { label: "Heading 2", icon: <Heading2 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().setNode("heading", { level: 2 }).run() },
    { label: "Heading 3", icon: <Heading3 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().setNode("heading", { level: 3 }).run() },
    { label: "Bullet List", icon: <List className="h-3.5 w-3.5" />, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered List", icon: <ListOrdered className="h-3.5 w-3.5" />, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "To-do", icon: <CheckSquare className="h-3.5 w-3.5" />, action: () => editor.chain().focus().toggleTaskList().run() },
    { label: "Quote", icon: <Quote className="h-3.5 w-3.5" />, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Code", icon: <Code className="h-3.5 w-3.5" />, action: () => editor.chain().focus().toggleCodeBlock().run() },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10 transition-all whitespace-nowrap"
      >
        {getCurrentLabel()}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1a1a1a] shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden">
            {options.map((opt) => {
              const isActive = getCurrentLabel() === opt.label;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => { opt.action(); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-white"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100"
                  )}
                >
                  <span className="opacity-70">{opt.icon}</span>
                  {opt.label}
                  {isActive && <span className="ml-auto text-[10px] text-neutral-500">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Helper component for Table Action switcher dropdown
function TableActionMenu({ editor }: { editor: any }) {
  const [open, setOpen] = useState(false);

  const options = [
    { label: "Add Row Above", icon: <Rows3 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().addRowBefore().run() },
    { label: "Add Row Below", icon: <Rows3 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().addRowAfter().run() },
    { label: "Add Col Left", icon: <Columns3 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().addColumnBefore().run() },
    { label: "Add Col Right", icon: <Columns3 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().addColumnAfter().run() },
    { label: "Delete Row", icon: <Trash2 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().deleteRow().run(), danger: true },
    { label: "Delete Col", icon: <Trash2 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().deleteColumn().run(), danger: true },
    { label: "Delete Table", icon: <Trash2 className="h-3.5 w-3.5" />, action: () => editor.chain().focus().deleteTable().run(), danger: true },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10 transition-all whitespace-nowrap"
      >
        Table
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1a1a1a] shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden">
            {options.map((opt, idx) => {
              return (
                <div key={opt.label}>
                  {(idx === 4 || idx === 6) && <div className="h-px bg-neutral-200 dark:bg-white/10 my-1 mx-2" />}
                  <button
                    type="button"
                    onClick={() => { opt.action(); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all group",
                      opt.danger
                        ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100"
                    )}
                  >
                    <span className={cn(
                      opt.danger ? "opacity-70 group-hover:opacity-100 text-red-500 dark:text-red-400" : "opacity-70"
                    )}>{opt.icon}</span>
                    <span className={cn(opt.danger && "font-semibold")}>{opt.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  setUrl: (url: string) => void;
}

function LinkModal({ isOpen, onClose, url, setUrl }: ModalProps) {
  const { editor: _editor } = useEditor();
  const editor = _editor as any;

  const handleSetLink = () => {
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
      setUrl("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#0A0A0A] border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden rounded-2xl shadow-2xl overflow-y-visible">
        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-2">
              <ExternalLink className="w-5 h-5 text-blue-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Add Web Link</DialogTitle>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Enter the URL to create a hyperlink in your document.</p>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSetLink();
              }}
              className="h-11 bg-neutral-50 dark:bg-[#0E0E0E] border-neutral-200 dark:border-white/5 focus:ring-blue-500 rounded-xl px-4"
              autoFocus
            />
          </div>
          <DialogFooter className="flex sm:justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={onClose} className="rounded-xl h-10 px-6 font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Cancel</Button>
            <Button
              onClick={handleSetLink}
              className="rounded-xl h-10 px-8 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-lg shadow-black/5 dark:shadow-white/5 transition-all active:scale-95"
            >
              Apply Link
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function YoutubeModal({ isOpen, onClose, url, setUrl }: ModalProps) {
  const { editor: _editor } = useEditor();
  const editor = _editor as any;

  const handleSetYoutube = () => {
    if (url && editor) {
      if (typeof (editor.commands as any).setYoutubeVideo === 'function') {
        (editor.commands as any).setYoutubeVideo({ src: url });
      } else {
        editor.chain().focus().insertContent({
          type: 'youtube',
          attrs: { src: url }
        }).run();
      }
      setUrl("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#0A0A0A] border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden rounded-2xl shadow-2xl overflow-y-visible">
        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-2">
              <AiFillYoutube className="w-5 h-5 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Embed Video</DialogTitle>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Paste a YouTube video link to embed it directly into your doc.</p>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSetYoutube();
              }}
              className="h-11 bg-neutral-50 dark:bg-[#0E0E0E] border-neutral-200 dark:border-white/5 focus:ring-red-500 rounded-xl px-4"
              autoFocus
            />
          </div>
          <DialogFooter className="flex sm:justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={onClose} className="rounded-xl h-10 px-6 font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Cancel</Button>
            <Button
              onClick={handleSetYoutube}
              className="rounded-xl h-10 px-8 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-lg shadow-black/5 dark:shadow-white/5 transition-all active:scale-95"
            >
              Embed Video
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// This inner component lives INSIDE EditorRoot — so useEditor() works reliably
function EditorHistoryListener() {
  const { editor } = useEditor();

  useEffect(() => {
    if (!editor) return;

    const handleUndo = () => (editor as any).chain().focus().undo().run();
    const handleRedo = () => (editor as any).chain().focus().redo().run();

    document.addEventListener('editor-undo', handleUndo);
    document.addEventListener('editor-redo', handleRedo);

    return () => {
      document.removeEventListener('editor-undo', handleUndo);
      document.removeEventListener('editor-redo', handleRedo);
    };
  }, [editor]);

  return null;
}

// Emoji Modal — accepts editor as DIRECT PROP (no useEditor hook needed)
// This avoids the React context issues with Dialog portals
function EmojiInsertModal({ isOpen, onClose, editor }: {
  isOpen: boolean;
  onClose: () => void;
  editor: any;
}) {
  const theme = useThemeStore((state) => state.theme);

  const handleEmojiClick = (emojiObj: any) => {
    if (editor) {
      editor.chain().focus().insertContent(emojiObj.emoji).run();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-fit bg-white dark:bg-[#111111] border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">Choose an Emoji</DialogTitle>
        <EmojiPicker
          theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
          onEmojiClick={handleEmojiClick}
          autoFocusSearch={false}
          lazyLoadEmojis={true}
          searchDisabled={false}
          skinTonesDisabled={true}
        />
      </DialogContent>
    </Dialog>
  );
}

// Removed EditorEmojiListener as we're lifting state back to BrainEditor

export function BrainEditor({ initialContent, onChange, className }: BrainEditorProps) {
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);
  const [emojiEditor, setEmojiEditor] = useState<any>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  useEffect(() => {
    const handleEmojiToggled = (e: any) => {
      if (e.detail?.editor) {
        setEmojiEditor(e.detail.editor);
        setIsEmojiModalOpen(true);
      }
    };
    document.addEventListener("open-emoji-modal", handleEmojiToggled);
    return () => document.removeEventListener("open-emoji-modal", handleEmojiToggled);
  }, []);

  return (
    <div className={cn("relative w-full h-auto", className)}>
      <EditorRoot>
        <EditorContent
          initialContent={initialContent || defaultInitialContent}
          extensions={[...defaultExtensions, slashCommand] as any}
          className="relative w-full"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
              contextmenu: (view, event) => {
                event.preventDefault();
                const posAtCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (posAtCoords) {
                  const { pos } = posAtCoords;
                  const $pos = view.state.doc.resolve(pos);
                  if ($pos.parent.isTextblock) {
                    const text = $pos.parent.textContent;
                    const parentOffset = $pos.parentOffset;
                    let start = parentOffset;
                    let end = parentOffset;
                    while (start > 0 && /\w/.test(text[start - 1])) start--;
                    while (end < text.length && /\w/.test(text[end])) end++;
                    
                    if (start !== end) {
                      const absoluteStart = pos - parentOffset + start;
                      const absoluteEnd = pos - parentOffset + end;
                      const selection = TextSelection.create(view.state.doc, absoluteStart, absoluteEnd);
                      view.dispatch(view.state.tr.setSelection(selection));
                    } else if (text.length === 0) {
                      view.dispatch(view.state.tr.insertText("\u200B", pos));
                      const selection = TextSelection.create(view.state.doc, pos, pos + 1);
                      view.dispatch(view.state.tr.setSelection(selection));
                    } else {
                      const selection = TextSelection.create(view.state.doc, pos, pos);
                      view.dispatch(view.state.tr.setSelection(selection));
                    }
                  }
                }
                return true;
              }
            },
            attributes: {
              class: cn(
                "tiptap prose prose-lg dark:prose-invert max-w-none w-full focus:outline-none",
                "selection:bg-indigo-500/30",
                "prose-headings:font-bold prose-headings:text-neutral-900 dark:prose-headings:text-neutral-100",
                "prose-h1:text-[3.5rem] prose-h1:mb-2 prose-h1:mt-0 prose-h1:tracking-tight prose-h1:leading-tight",
                "prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10",
                "prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8",
                "prose-p:text-neutral-600 dark:prose-p:text-neutral-400 prose-p:my-1 prose-p:leading-relaxed",
                "prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-200 dark:prose-pre:border-neutral-800",
                "prose-table:border-collapse prose-table:my-0",
                "prose-td:border prose-td:border-neutral-200 dark:prose-td:border-neutral-800",
                "prose-th:border prose-th:border-neutral-200 dark:prose-th:border-neutral-800",
                "prose-td:p-2 prose-th:p-2 prose-th:bg-neutral-50 dark:prose-th:bg-neutral-900 prose-td:relative",
                "prose-td:min-w-[100px]",
                "[&_p.is-empty]:before:content-[attr(data-placeholder)] [&_h1.is-empty]:before:content-[attr(data-placeholder)]",
                "[&_table_p.is-empty]:before:content-none",
                "[&_p.is-empty]:before:float-left [&_h1.is-empty]:before:float-left",
                "[&_p.is-empty]:before:h-0 [&_h1.is-empty]:before:h-0",
                "[&_p.is-empty]:before:pointer-events-none [&_h1.is-empty]:before:pointer-events-none",
                "[&_p.is-empty]:before:text-neutral-400/50 dark:[&_p.is-empty]:before:text-neutral-600/50 [&_h1.is-empty]:before:text-neutral-400/50 dark:[&_h1.is-empty]:before:text-neutral-600/50",
              ),
              spellcheck: "false",
            },
          }}
          onUpdate={({ editor }) => {
            if (onChange) {
              onChange(editor.getJSON(), editor.getHTML(), editor.getText());
            }
          }}
        >
          <EditorCommand className="z-50 h-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111111] shadow-2xl shadow-black/10 overflow-hidden">
            <ScrollArea className="h-[400px] w-full">
              <div className="flex flex-col p-2">
                <EditorCommandEmpty className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  No results found
                </EditorCommandEmpty>
                <EditorCommandList className="flex flex-col gap-0.5">
                  {suggestionItems.map((item: any) => (
                    <EditorCommandItem
                      value={item.title}
                      onCommand={({ editor, range }) => item.command?.({ editor, range })}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-neutral-100 dark:focus:bg-neutral-900 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-900 group cursor-pointer"
                      key={item.title}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                        {item.icon || <Heading1 className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {item.description}
                        </span>
                      </div>
                    </EditorCommandItem>
                  ))}
                </EditorCommandList>
              </div>
            </ScrollArea>
          </EditorCommand>

          {!(isLinkModalOpen || isYoutubeModalOpen || isEmojiModalOpen) && (
            <EditorBubble
              tippyOptions={{
                placement: "top",
                onHidden: () => setShowColorSelector(false)
              }}
              className="flex w-fit items-center gap-0.5 rounded-md border border-neutral-200/50 dark:border-neutral-800/50 bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl p-1 shadow-2xl shadow-black/10"
            >
              <BubbleMenuContent
                showColorSelector={showColorSelector}
                setShowColorSelector={setShowColorSelector}
                onOpenLinkModal={() => setIsLinkModalOpen(true)}
                onOpenYoutubeModal={() => setIsYoutubeModalOpen(true)}
              />
            </EditorBubble>
          )}

          <LinkModal
            isOpen={isLinkModalOpen}
            onClose={() => setIsLinkModalOpen(false)}
            url={linkUrl}
            setUrl={setLinkUrl}
          />

          <EditorHistoryListener />
        </EditorContent>
      </EditorRoot>

      {/* Global Emoji Modal sits outside ProseMirror tree to avoid Dialog nesting bugs */}
      <EmojiInsertModal
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        editor={emojiEditor}
      />
    </div>
  );
}

const ImageResizer = () => null;
