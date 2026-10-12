export const SYSTEM_ENDPOINTS = {
  HEALTH: '/health',
  INFO: '/info',
  INFO_HARDWARE: '/v1/system/info',
  EXECUTE_CMD: '/v1/system/cmd',
  PS: '/v1/system/ps',
  CONTROL: '/v1/system/control',
  LIVE: '/v1/system/live',
  PLAN: '/v1/system/plan',
} as const;
