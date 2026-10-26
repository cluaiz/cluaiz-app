import type { ToolCatalogEntry } from '../catalog';

/** Session attachments are package bindings, not OpenAI function definitions. */
export interface ToolBinding {
  id: string;
  turns: number;
  inline?: boolean;
  pinned?: boolean;
  idle?: number;
}

/** inline/idle are Engine-owned observations, not settings this facade writes. */
export type ToolBindingInput = string | Pick<ToolBinding, 'id' | 'turns' | 'pinned'>;

export interface AllToolsResponse {
  tools: ToolCatalogEntry[];
  [key: string]: unknown;
}

export interface SessionToolsResponse {
  session_id: string;
  tools: ToolBinding[];
  [key: string]: unknown;
}

export interface SessionToolsUpdateRequest {
  tools?: ToolBindingInput[];
  detach?: string[];
}
