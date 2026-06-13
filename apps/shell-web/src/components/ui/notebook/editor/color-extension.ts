/**
 * Self-contained color + highlight extension.
 * Avoids module-scope conflicts with novel's bundled tiptap version.
 */
import { Extension, Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        colorHighlight: {
            setColor: (color: string) => ReturnType;
            unsetColor: () => ReturnType;
            setHighlight: (attrs?: { color: string }) => ReturnType;
            unsetHighlight: () => ReturnType;
        };
    }
}

// Inline TextStyle-compatible mark: stores color + backgroundColor
export const InlineStyle = Mark.create({
    name: "textStyle",
    addOptions() {
        return { HTMLAttributes: {} };
    },
    parseHTML() {
        return [
            {
                tag: "span",
                getAttrs: (el) =>
                    (el as HTMLElement).getAttribute("style") ? {} : false,
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            0,
        ];
    },
    addAttributes() {
        return {
            color: {
                default: null,
                parseHTML: (el) => (el as HTMLElement).style.color || null,
                renderHTML: (attrs) => {
                    if (!attrs.color) return {};
                    return { style: `color: ${attrs.color}` };
                },
            },
            backgroundColor: {
                default: null,
                parseHTML: (el) => (el as HTMLElement).style.backgroundColor || null,
                renderHTML: (attrs) => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
            },
        };
    },
});

// Exposes setColor / unsetColor / setHighlight / unsetHighlight
export const ColorHighlightExtension = Extension.create({
    name: "colorHighlight",
    addCommands() {
        return {
            setColor:
                (color: string) =>
                    ({ chain }: any) =>
                        chain().setMark("textStyle", { color }).run(),

            unsetColor:
                () =>
                    ({ chain }: any) =>
                        chain().setMark("textStyle", { color: null }).run(),

            setHighlight:
                (attrs?: { color: string }) =>
                    ({ chain }: any) =>
                        chain()
                            .setMark("textStyle", { backgroundColor: attrs?.color ?? null })
                            .run(),

            unsetHighlight:
                () =>
                    ({ chain }: any) =>
                        chain().setMark("textStyle", { backgroundColor: null }).run(),
        };
    },
});
