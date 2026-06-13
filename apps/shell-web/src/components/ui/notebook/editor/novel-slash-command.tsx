import { createSuggestionItems, Command, renderItems } from "novel";
import {
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Code,
    CheckSquare,
    Type,
    Image,
    Minus,
    Table,
    Smile,
} from "lucide-react";
import React from "react";

export const suggestionItems = [
    {
        title: "Text",
        description: "Start writing with plain text.",
        searchTerms: ["p", "paragraph", "text"],
        icon: <Type className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").run();
        },
    },
    {
        title: "Heading 1",
        description: "Big section heading.",
        searchTerms: ["title", "big", "h1", "heading"],
        icon: <Heading1 className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
        },
    },
    {
        title: "Heading 2",
        description: "Medium section heading.",
        searchTerms: ["subtitle", "medium", "h2"],
        icon: <Heading2 className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
        },
    },
    {
        title: "Heading 3",
        description: "Small section heading.",
        searchTerms: ["subtitle", "small", "h3"],
        icon: <Heading3 className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
        },
    },
    {
        title: "To-do List",
        description: "Track tasks with checkboxes.",
        searchTerms: ["todo", "task", "list", "check", "checkbox"],
        icon: <CheckSquare className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
    },
    {
        title: "Bullet List",
        description: "Create a simple bulleted list.",
        searchTerms: ["unordered", "point", "bullet"],
        icon: <List className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
    },
    {
        title: "Numbered List",
        description: "Create a list with numbering.",
        searchTerms: ["ordered", "numbered"],
        icon: <ListOrdered className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
    },
    {
        title: "Quote",
        description: "Capture a quotation.",
        searchTerms: ["blockquote", "quote"],
        icon: <Quote className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
    },
    {
        title: "Code Block",
        description: "Capture a code snippet.",
        searchTerms: ["codeblock", "code", "snippet"],
        icon: <Code className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    {
        title: "Table",
        description: "Insert a data table.",
        searchTerms: ["table", "grid", "data", "rows", "columns"],
        icon: <Table className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        },
    },
    {
        title: "Image",
        description: "Upload an image from your computer.",
        searchTerms: ["photo", "picture", "media", "image"],
        icon: <Image className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).run();
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async () => {
                if (input.files?.length) {
                    const file = input.files[0];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        editor.chain().focus().setImage({ src: e.target?.result as string }).run();
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        },
    },
    {
        title: "Divider",
        description: "Insert a visual separator.",
        searchTerms: ["divider", "hr", "rule", "line", "separator"],
        icon: <Minus className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
    },
    {
        title: "Emoji",
        description: "Insert an emoji.",
        searchTerms: ["emoji", "smile", "face", "icon", "emote"],
        icon: <Smile className="w-4 h-4" />,
        command: ({ editor, range }: { editor: any, range: any }) => {
            editor.chain().focus().deleteRange(range).run();
            // Pass editor directly in the event to avoid context issues
            setTimeout(() => {
                const event = new CustomEvent("open-emoji-modal", { detail: { editor } });
                document.dispatchEvent(event);
            }, 50);
        },
    },
];

export const slashCommand = Command.configure({
    suggestion: {
        items: () => suggestionItems,
        render: renderItems,
    },
});
