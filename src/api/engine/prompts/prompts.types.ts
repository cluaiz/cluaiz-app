/** One prompt the Engine sends to a model; `overridden` means the text is the user's own. */
export interface EnginePrompt {
    id: string;
    description: string;
    text: string;
    variables: string[];
    overridden: boolean;
}

export interface PromptVersion { text: string; replaced_at: string }
