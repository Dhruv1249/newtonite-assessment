/**
 * Unified API client supporting authorization headers, typed errors, and conflict detection.
 */

import { API_BASE_URL } from "@/lib/config";

export class ApiError extends Error {
  public readonly status: number;
  public readonly isConflict: boolean;
  public readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isConflict = status === 409;
    this.payload = payload;
  }
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
}

/**
 * Execute an authenticated HTTP request against the OpFlow backend API.
 *
 * @param path - API path suffix (e.g. /api/v1/items)
 * @param options - Fetch options including optional idempotency token
 * @returns Parsed JSON response payload
 * @throws {ApiError} When response status is non-2xx
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("opflow_access_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  let responseData: unknown = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    if (
      responseData &&
      typeof responseData === "object" &&
      "detail" in responseData &&
      typeof (responseData as { detail: unknown }).detail === "string"
    ) {
      errorMessage = (responseData as { detail: string }).detail;
    }
    throw new ApiError(response.status, errorMessage, responseData);
  }

  return responseData as T;
}
