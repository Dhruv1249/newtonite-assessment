/**
 * Server-Sent Events client establishing reactive subscriptions for TanStack Query invalidation.
 */

import { QueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";

/**
 * Connect to backend SSE event stream and bind cache invalidation triggers.
 *
 * @param queryClient - TanStack QueryClient instance
 * @returns Teardown function to close active EventSource stream
 */
export function initializeEventSource(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const token = localStorage.getItem("opflow_access_token") || "";
  const sseUrl = `${API_BASE_URL}/api/v1/events/stream?token=${encodeURIComponent(token)}`;

  const eventSource = new EventSource(sseUrl);

  eventSource.addEventListener("item_created", () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
  });

  eventSource.addEventListener("item_updated", (event) => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    try {
      const data = JSON.parse(event.data);
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ["item", data.item_id] });
        queryClient.invalidateQueries({ queryKey: ["activity", data.item_id] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });

  eventSource.addEventListener("item_transitioned", (event) => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    try {
      const data = JSON.parse(event.data);
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ["item", data.item_id] });
        queryClient.invalidateQueries({ queryKey: ["activity", data.item_id] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });

  eventSource.addEventListener("item_assigned", (event) => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    try {
      const data = JSON.parse(event.data);
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ["item", data.item_id] });
        queryClient.invalidateQueries({ queryKey: ["activity", data.item_id] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });

  eventSource.addEventListener("item_enriched", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ["item", data.item_id] });
        queryClient.invalidateQueries({ queryKey: ["suggestions", data.item_id] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });

  eventSource.addEventListener("comment_added", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ["comments", data.item_id] });
        queryClient.invalidateQueries({ queryKey: ["activity", data.item_id] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });

  return () => {
    eventSource.close();
  };
}
