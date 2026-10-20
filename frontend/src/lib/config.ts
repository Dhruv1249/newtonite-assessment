/**
 * Centralized frontend configuration.
 *
 * All environment variable access must happen exclusively through this module.
 * Defaults to localhost API endpoint for zero-configuration evaluation.
 */

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
