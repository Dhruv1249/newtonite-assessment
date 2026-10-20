/**
 * Centralized frontend configuration.
 *
 * All environment variable access must happen exclusively through this module.
 */

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!rawApiUrl && typeof window !== "undefined") {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_API_URL");
}

export const API_BASE_URL: string = rawApiUrl || "";
