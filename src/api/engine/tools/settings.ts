import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { toolTarget } from './lifecycle';
import type { UpdateComponentSettingsPayload } from './components/components.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const securityModes = new Set(['inherit', 'require_approval', 'always_allow']);
const executionModes = new Set(['auto', 'manual', 'confirm_destructive']);
const fields = new Set(['enabled', 'execution_mode', 'security_mode', 'trust_annotations']);
const validValues = (value: Record<string, unknown>) =>
  (value.enabled === undefined || typeof value.enabled === 'boolean')
  && (value.trust_annotations === undefined || typeof value.trust_annotations === 'boolean')
  && (value.execution_mode === undefined || executionModes.has(value.execution_mode as string))
  && (value.security_mode === undefined || securityModes.has(value.security_mode as string));

/** One permission the tool asks for, as the Engine reports it (`tools.get_settings`). */
export interface ToolPermission {
  kind: string;
  title: string;
  info: string;
  /** The Engine asks before allowing it at install */
  sensitive: boolean;
  /** What the package asks for, before the user chose */
  default: boolean;
  /** Allowed now */
  on: boolean;
  /** The user (or the install) has chosen */
  chosen: boolean;
  /** Fixed options of the type, such as `access` and `hosts` */
  options: Record<string, unknown>;
}

/** One value the tool reads (a name in its `env`), never the value itself. */
export interface ToolUserSetting {
  name: string;
  info: string;
  required: boolean;
  /** Saved, or present in the system environment */
  set: boolean;
  /** The system environment has it; that comes before a saved value */
  in_system: boolean;
}

const bool = (value: unknown): value is boolean => typeof value === 'boolean';
const str = (value: unknown): value is string => typeof value === 'string';
const permissionOf = (value: unknown): ToolPermission | null =>
  object(value) && str(value.kind) && value.kind && str(value.info) && bool(value.on) && bool(value.sensitive)
    ? { kind: value.kind, title: str(value.title) && value.title ? value.title : value.kind, info: value.info,
      sensitive: value.sensitive, default: value.default !== false, on: value.on, chosen: value.chosen === true,
      options: object(value.options) ? value.options : {} }
    : null;
const userSettingOf = (value: unknown): ToolUserSetting | null =>
  object(value) && str(value.name) && /^[A-Z][A-Z0-9_]*$/.test(value.name) && bool(value.set)
    ? { name: value.name, info: str(value.info) ? value.info : '', required: value.required === true,
      set: value.set, in_system: value.in_system === true }
    : null;
// Optional parts of the answer: an older Engine sends none, and an entry it cannot read is left out
const listOf = <T>(value: unknown, parse: (item: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(parse).filter((item): item is T => item !== null) : [];

function settingsResult(value: unknown) {
  if (!object(value) || !object(value.schema) || !object(value.values) || !validValues(value.values)
    || [...fields].some(field => (value.values as Record<string, unknown>)[field] === undefined)) {
    throw new ApiError('Engine returned invalid tool settings', 200, 'INVALID_TOOL_SETTINGS', 'tools.get_settings');
  }
  return { status: 'success', schema: value.schema, values: value.values,
    permissions: listOf(value.permissions, permissionOf), user_settings: listOf(value.user_settings, userSettingOf) };
}

export async function getToolSettings(kind?: string, name?: string) {
  return settingsResult(await callCep('tools.get_settings', toolTarget(kind, name)));
}

export async function setToolSettings(payload: UpdateComponentSettingsPayload) {
  if (!object(payload) || Object.keys(payload).some(key => !['component_type', 'component_id', 'settings'].includes(key))
    || !object(payload.settings) || Object.keys(payload.settings).some(key => !fields.has(key))
    || !validValues(payload.settings)) {
    throw new ApiError('Unsupported tool settings patch', 400, 'INVALID_TOOL_SETTINGS_PATCH', 'tools.set_settings');
  }
  const saved = settingsResult(await callCep('tools.set_settings', {
    ...toolTarget(payload.component_type, payload.component_id), patch: payload.settings,
  }));
  if (Object.entries(payload.settings).some(([key, value]) => saved.values[key] !== value)) {
    throw new ApiError('Engine did not acknowledge the requested tool settings', 200, 'TOOL_SETTINGS_NOT_SAVED', 'tools.set_settings');
  }
  return saved;
}

/** Allows or refuses one permission the tool asks for; the Engine's answer must show the choice. */
export async function setToolPermission(kind: string, name: string, permission: string, on: boolean) {
  if (!str(permission) || !permission || !bool(on)) {
    throw new ApiError('Choose a permission and on or off', 400, 'INVALID_TOOL_SETTINGS_PATCH', 'tools.set_settings');
  }
  const saved = settingsResult(await callCep('tools.set_settings', {
    ...toolTarget(kind, name), patch: { permissions: { [permission]: on } },
  }));
  if (saved.permissions.find(p => p.kind === permission)?.on !== on) {
    throw new ApiError('Engine did not acknowledge the permission', 200, 'TOOL_SETTINGS_NOT_SAVED', 'tools.set_settings');
  }
  return saved;
}

/** Saves one value the tool reads, such as a key; an empty value removes the saved one. The value
 * is never read back: the Engine only reports whether one is set. */
export async function setToolUserSetting(kind: string, name: string, setting: string, value: string) {
  if (!str(setting) || !/^[A-Z][A-Z0-9_]*$/.test(setting) || !str(value)) {
    throw new ApiError('Choose a setting name and a text value', 400, 'INVALID_TOOL_SETTINGS_PATCH', 'tools.set_settings');
  }
  const saved = settingsResult(await callCep('tools.set_settings', {
    ...toolTarget(kind, name), patch: { user_settings: { [setting]: value } },
  }));
  const reported = saved.user_settings.find(s => s.name === setting);
  if (!reported || (value !== '' && !reported.set)) {
    throw new ApiError('Engine did not acknowledge the setting', 200, 'TOOL_SETTINGS_NOT_SAVED', 'tools.set_settings');
  }
  return saved;
}
