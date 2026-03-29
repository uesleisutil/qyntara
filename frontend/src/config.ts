// API base URL — set via env var at build time, fallback to localhost
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// WebSocket — only works in local dev (Lambda doesn't support persistent WS)
export const WS_BASE = import.meta.env.VITE_WS_BASE || API_BASE.replace('http', 'ws');
