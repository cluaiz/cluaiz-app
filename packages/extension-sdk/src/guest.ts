/** Author-side connection entry. Host dispatch, App stores and credentials are never exported. */
export { connectExtension } from '../../../src/extensions/guest/client';
export { bootstrapExtension } from '../../../src/extensions/guest/bootstrap';
export { messagePortTransport } from '../../../src/extensions/guest/transport';
export { bindExtensionTheme } from '../../../src/extensions/guest/theme';
export { ExtensionError } from '../../../src/extensions/guest/contract';
export type { GuestExtensionSDK, ExtensionConnection, GuestHost, GuestErrorCode } from '../../../src/extensions/guest/contract';
export type { GuestTransport } from '../../../src/extensions/guest/transport';
export type { GuestTheme } from '../../../src/extensions/guest/theme';
