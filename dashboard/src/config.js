/**
 * Configuration file for the dashboard
 * 
 * This file contains the configuration for the dashboard API.
 * In production, these values should be set via environment variables during build.
 * This file serves as a fallback for local development.
 */

// Use environment variables if available, otherwise use hardcoded values
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://og8m3nnj60.execute-api.us-east-1.amazonaws.com/prod';
export const API_KEY = process.env.REACT_APP_API_KEY || 'nU5X21rSSR4e6kU5AVOLPa063aQCsmGl4GdAFvcR';
