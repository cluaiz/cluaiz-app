export interface ApiAuth {
  required: boolean;
  tokens: string[];
}

export interface SlotConfig {
  model_id?: string | null;
  format_type?: string | null;
  supported_tasks?: string[];
}

export interface ModelSelection {
  text?: string | null;
  vision?: string | null;
  audio?: string | null;
}

/** One value of `agent_security_mode` as the Engine describes it (`config.get` engine `security_modes`) */
export interface SecurityModeInfo {
  id: 'full_access' | 'sandboxed' | 'strict';
  title: string;
  /** What runs without asking and what is asked */
  summary: string;
  /** The mode a new install starts in */
  default: boolean;
}

export interface PermissionSchema {
  active_slots?: Record<string, SlotConfig>;
  vector_models?: ModelSelection;
  chat_models?: ModelSelection;
  wasm_firewall?: 'auto' | 'strict' | 'off';
  vectorize_user_input?: boolean;
  vectorize_ai_response?: boolean;
  stream_telemetry?: boolean;
  lazy_load_model: boolean;
  enable_kvcache?: boolean;
  model_header_info?: boolean;
  api_port?: number;
  api_host?: string;
  connection_protocol?: string;
  api_auth?: ApiAuth;
  agent_security_mode?: 'full_access' | 'sandboxed' | 'strict';
  /** The modes and their rules, from the Engine; absent on an Engine older than this list */
  security_modes?: SecurityModeInfo[];
  /** Saved fields the Engine does not act on */
  unused_fields?: string[];
  /** The fields this Engine sent (set by the App), so a switch it does not have is not offered as working */
  engine_fields?: string[];
  temporary_chat_ttl_hours?: number;
  require_login_on_boot?: boolean;
  api_key_storage?: string;
  auto_execute_shell?: boolean;
  workspace_read_access?: boolean;
  ingest_models?: Record<string, any>;
  tts_models?: Record<string, any>;
  stt_models?: Record<string, any>;
  available_models?: string[];
  available_chat_models?: string[];
  available_vector_models?: string[];
  available_vision_models?: string[];
  available_audio_models?: string[];
  available_vision_ingest_models?: string[];
  available_tts_models?: string[];
  available_stt_models?: string[];
  available_devices?: string[];
  [key: string]: any;
}

export interface PermissionResponse {
  status: string;
  permission: PermissionSchema;
  lan_ip?: string;
  message?: string;
}

export interface TokenListResponse {
  tokens: string[];
  api_auth_required: boolean;
}

export interface TokenGenerateResponse extends TokenListResponse {
  token: string;
}

export interface TokenRevokeResponse extends TokenListResponse {
  revoked_token: string;
}

export interface PendingPermissionRequest {
  id: string;
  method: string;
  target: string;
  principal: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'used';
}

export interface PendingPermissionsResponse {
  pending: PendingPermissionRequest[];
}

export interface ApprovalActionRequest {
  request_id: string;
  feedback?: string;
}

export interface ApprovalActionResponse {
  approval: PendingPermissionRequest;
  grant?: { chat_id: string; tool: string; minutes: number } | null;
}
