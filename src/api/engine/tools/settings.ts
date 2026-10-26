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

function settingsResult(value: unknown) {
  if (!object(value) || !object(value.schema) || !object(value.values) || !validValues(value.values)
    || [...fields].some(field => (value.values as Record<string, unknown>)[field] === undefined)) {
    throw new ApiError('Engine returned invalid tool settings', 200, 'INVALID_TOOL_SETTINGS', 'tools.get_settings');
  }
  return { status: 'success', schema: value.schema, values: value.values };
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
