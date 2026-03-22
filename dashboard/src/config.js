/**
 * Configuration file for the dashboard
 * 
 * Set REACT_APP_API_BASE_URL and REACT_APP_API_KEY in your .env.local for local dev.
 * In production, these are injected via GitHub Actions secrets.
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
export const API_KEY = process.env.REACT_APP_API_KEY || '';
