"use client";

/**
 * React Query hooks managing work items, mutations, optimistic updates, and conflicts.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";
import {
  ActivityLog,
  AIMetadata,
  Comment,
  SemanticSearchResponse,
  WorkItem,
  WorkItemListResponse,
} from "@/types";

export interface ItemFilters {
  teamId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Hook to retrieve a paginated collection of work items with filters.
 *
 * @param filters - Active filter parameters
 * @returns React Query query result
 */
export function useItems(
  filters: ItemFilters = {}
): UseQueryResult<WorkItemListResponse, ApiError> {
  const params = new URLSearchParams();
  if (filters.teamId) params.append("team_id", filters.teamId);
  if (filters.status) params.append("status", filters.status);
  if (filters.priority) params.append("priority", filters.priority);
  if (filters.assigneeId) params.append("assignee_id", filters.assigneeId);
  if (filters.search) params.append("search", filters.search);
  if (filters.page !== undefined) params.append("page", filters.page.toString());
  if (filters.pageSize !== undefined) params.append("page_size", filters.pageSize.toString());

  const queryPath = `/api/v1/items?${params.toString()}`;

  return useQuery<WorkItemListResponse, ApiError>({
    queryKey: ["items", filters],
    queryFn: () => apiFetch<WorkItemListResponse>(queryPath),
  });
}

/**
 * Hook to retrieve an individual work item by identifier.
 *
 * @param itemId - Work item UUID
 * @returns React Query query result
 */
export function useItem(itemId: string): UseQueryResult<WorkItem, ApiError> {
  return useQuery<WorkItem, ApiError>({
    queryKey: ["item", itemId],
    queryFn: () => apiFetch<WorkItem>(`/api/v1/items/${itemId}`),
    enabled: Boolean(itemId),
  });
}

export interface CreateItemPayload {
  title: string;
  description: string;
  team_id: string;
  priority: string;
  category: string;
  assignee_id?: string | null;
  idempotencyKey?: string;
}

/**
 * Hook to create a work item with an idempotency key.
 *
 * @returns React Query mutation result
 */
export function useCreateItem(): UseMutationResult<
  WorkItem,
  ApiError,
  CreateItemPayload
> {
  const queryClient = useQueryClient();

  return useMutation<WorkItem, ApiError, CreateItemPayload>({
    mutationFn: (payload: CreateItemPayload) => {
      const { idempotencyKey, ...body } = payload;
      return apiFetch<WorkItem>("/api/v1/items", {
        method: "POST",
        body: JSON.stringify(body),
        idempotencyKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export interface UpdateItemPayload {
  itemId: string;
  expectedVersion: number;
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
}

/**
 * Hook to update work item properties with optimistic concurrency expected version.
 *
 * @returns React Query mutation result
 */
export function useUpdateItem(): UseMutationResult<
  WorkItem,
  ApiError,
  UpdateItemPayload
> {
  const queryClient = useQueryClient();

  return useMutation<WorkItem, ApiError, UpdateItemPayload>({
    mutationFn: (payload: UpdateItemPayload) => {
      const { itemId, expectedVersion, ...body } = payload;
      return apiFetch<WorkItem>(`/api/v1/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          expected_version: expectedVersion,
          ...body,
        }),
      });
    },
    onSuccess: (data: WorkItem) => {
      queryClient.invalidateQueries({ queryKey: ["item", data.id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export interface TransitionItemPayload {
  itemId: string;
  targetStatus: string;
  expectedVersion: number;
}

/**
 * Hook to advance work item workflow state with optimistic concurrency.
 *
 * @returns React Query mutation result
 */
export function useTransitionItem(): UseMutationResult<
  WorkItem,
  ApiError,
  TransitionItemPayload
> {
  const queryClient = useQueryClient();

  return useMutation<WorkItem, ApiError, TransitionItemPayload>({
    mutationFn: (payload: TransitionItemPayload) => {
      return apiFetch<WorkItem>(`/api/v1/items/${payload.itemId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          target_status: payload.targetStatus,
          expected_version: payload.expectedVersion,
        }),
      });
    },
    onSuccess: (data: WorkItem) => {
      queryClient.invalidateQueries({ queryKey: ["item", data.id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["activity", data.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export interface AssignItemPayload {
  itemId: string;
  assigneeId: string | null;
  expectedVersion: number;
}

/**
 * Hook to reassign a work item with optimistic concurrency.
 *
 * @returns React Query mutation result
 */
export function useAssignItem(): UseMutationResult<
  WorkItem,
  ApiError,
  AssignItemPayload
> {
  const queryClient = useQueryClient();

  return useMutation<WorkItem, ApiError, AssignItemPayload>({
    mutationFn: (payload: AssignItemPayload) => {
      return apiFetch<WorkItem>(`/api/v1/items/${payload.itemId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          assignee_id: payload.assigneeId,
          expected_version: payload.expectedVersion,
        }),
      });
    },
    onSuccess: (data: WorkItem) => {
      queryClient.invalidateQueries({ queryKey: ["item", data.id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["activity", data.id] });
    },
  });
}

/**
 * Hook to fetch discussion comments on a work item.
 *
 * @param itemId - Work item UUID
 * @returns React Query query result
 */
export function useItemComments(
  itemId: string
): UseQueryResult<Comment[], ApiError> {
  return useQuery<Comment[], ApiError>({
    queryKey: ["comments", itemId],
    queryFn: () => apiFetch<Comment[]>(`/api/v1/items/${itemId}/comments`),
    enabled: Boolean(itemId),
  });
}

/**
 * Hook to submit a comment on a work item.
 *
 * @param itemId - Work item UUID
 * @returns React Query mutation result
 */
export function useAddComment(
  itemId: string
): UseMutationResult<Comment, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<Comment, ApiError, string>({
    mutationFn: (content: string) => {
      return apiFetch<Comment>(`/api/v1/items/${itemId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", itemId] });
      queryClient.invalidateQueries({ queryKey: ["activity", itemId] });
    },
  });
}

/**
 * Hook to fetch historical activity timeline for a work item.
 *
 * @param itemId - Work item UUID
 * @returns React Query query result
 */
export function useItemActivity(
  itemId: string
): UseQueryResult<ActivityLog[], ApiError> {
  return useQuery<ActivityLog[], ApiError>({
    queryKey: ["activity", itemId],
    queryFn: () => apiFetch<ActivityLog[]>(`/api/v1/items/${itemId}/activity`),
    enabled: Boolean(itemId),
  });
}

/**
 * Hook to fetch AI triage suggestions for a work item.
 *
 * @param itemId - Work item UUID
 * @returns React Query query result
 */
export function useItemSuggestions(
  itemId: string
): UseQueryResult<AIMetadata, ApiError> {
  return useQuery<AIMetadata, ApiError>({
    queryKey: ["suggestions", itemId],
    queryFn: () => apiFetch<AIMetadata>(`/api/v1/items/${itemId}/suggestions`),
    enabled: Boolean(itemId),
    staleTime: 60000,
  });
}

/**
 * Hook to execute a semantic vector search.
 *
 * @param query - Search query text
 * @returns React Query query result
 */
export function useSemanticSearch(
  query: string
): UseQueryResult<SemanticSearchResponse, ApiError> {
  return useQuery<SemanticSearchResponse, ApiError>({
    queryKey: ["semantic_search", query],
    queryFn: () =>
      apiFetch<SemanticSearchResponse>(
        `/api/v1/items/search?q=${encodeURIComponent(query)}`
      ),
    enabled: query.trim().length >= 2,
  });
}
