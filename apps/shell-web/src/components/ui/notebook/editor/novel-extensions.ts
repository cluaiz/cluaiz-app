import {
    TiptapImage,
    TiptapLink,
    UpdatedImage,
    TaskList,
    TaskItem,
    HorizontalRule,
    StarterKit,
    Placeholder,
    TiptapUnderline,
} from "novel";
import Document from "@tiptap/extension-document";
import { InlineStyle, ColorHighlightExtension } from "./color-extension";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import CharacterCount from "@tiptap/extension-character-count";

// Force First Node as Heading (The Title Constraint)
// This strictly enforces that the first node is a heading and prevents it from being deleted or converted.
export const TitleDocument = Document.extend({
    content: "heading block*",
});

import { UploadImagesPlugin } from "novel";
import { cx } from "class-variance-authority";

// Implement Dual Placeholders
export const CustomPlaceholder = Placeholder.configure({
    placeholder: ({ node }: { node: any }) => {
        if (node.type.name === "heading" && node.attrs.level === 1) {
            return "Knowledge Doc Title...";
        }
        return "Knowledge Doc write... or press '/' for commands...";
    },
    showOnlyWhenEditable: false,
    includeChildren: false,
    emptyNodeClass: "is-empty",
});

const tiptapLink = TiptapLink.configure({
    HTMLAttributes: {
        class: cx(
            "text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer",
        ),
    },
});

const tiptapImage = TiptapImage.extend({
    addProseMirrorPlugins() {
        return [
            UploadImagesPlugin({
                imageClass: cx("opacity-40 rounded-lg border border-stone-200 object-cover"),
            }),
        ];
    },
}).configure({
    allowBase64: true,
    HTMLAttributes: {
        class: cx("rounded-lg border border-muted"),
    },
});

const updatedImage = UpdatedImage.configure({
    HTMLAttributes: {
        class: cx("rounded-lg border border-muted"),
    },
});

const taskList = TaskList.configure({
    HTMLAttributes: {
        class: cx("not-prose pl-2"),
    },
});
const taskItem = TaskItem.configure({
    HTMLAttributes: {
        class: cx("flex items-start my-4"),
    },
    nested: true,
});

const horizontalRule = HorizontalRule.configure({
    HTMLAttributes: {
        class: cx("mt-4 mb-6 border-t border-muted-foreground"),
    },
});

const starterKit = StarterKit.configure({
    bulletList: {
        HTMLAttributes: {
            class: cx("list-disc list-outside leading-3 -mt-2"),
        },
    },
    orderedList: {
        HTMLAttributes: {
            class: cx("list-decimal list-outside leading-3 -mt-2"),
        },
    },
    listItem: {
        HTMLAttributes: {
            class: cx("leading-normal -mb-2"),
        },
    },
    blockquote: {
        HTMLAttributes: {
            class: cx("border-l-4 border-primary"),
        },
    },
    codeBlock: {
        HTMLAttributes: {
            class: cx("rounded-sm bg-muted border p-5 font-mono font-medium"),
        },
    },
    code: {
        HTMLAttributes: {
            class: cx("rounded-md bg-muted px-1.5 py-1 font-mono font-medium"),
            spellcheck: "false",
        },
    },
    horizontalRule: false,
    dropcursor: {
        color: "#DBEAFE",
        width: 4,
    },
    gapcursor: false,
});

export const defaultExtensions = [
    TitleDocument,
    starterKit.configure({
        document: false,
    }),
    CustomPlaceholder,
    tiptapLink,
    tiptapImage,
    updatedImage,
    taskList,
    taskItem,
    horizontalRule,
    TiptapUnderline,
    InlineStyle,
    ColorHighlightExtension,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CharacterCount.configure({ limit: 12000 }),
];
