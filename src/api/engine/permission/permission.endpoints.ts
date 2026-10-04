export const PERMISSION_ENDPOINTS = {
  PERMISSION: '/v1/system/permission',
  AUTH_TOKEN_GENERATE: '/v1/system/auth/token/generate',
  AUTH_TOKEN_REVOKE: '/v1/system/auth/token/revoke',
  PENDING_PERMISSIONS: '/v1/system/permission/pending',
  APPROVE_PERMISSION: '/v1/system/permission/approve',
  REJECT_PERMISSION: '/v1/system/permission/reject',
} as const;
