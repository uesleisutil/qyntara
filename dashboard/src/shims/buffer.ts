/**
 * Minimal buffer shim for browser compatibility.
 * plotly.js → ndarray → typedarray-pool imports Node.js 'buffer'.
 * This provides the minimal Buffer.isBuffer check it needs.
 */
export const Buffer = {
  isBuffer: (_obj: unknown): boolean => false,
};
export default { Buffer };
