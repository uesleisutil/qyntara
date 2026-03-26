/**
 * Configuration file for the dashboard
 * 
 * Set VITE_API_BASE_URL and VITE_API_KEY in your .env.local for local dev.
 * In production, these are injected via GitHub Actions secrets.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_KEY = import.meta.env.VITE_API_KEY || '';
