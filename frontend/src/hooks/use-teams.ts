"use client";

/**
 * React Query hooks managing teams, memberships, workflows, and dashboard statistics.
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
  DashboardStats,
  Team,
  TeamMember,
  User,
  Workflow,
} from "@/types";

/**
 * Hook to retrieve teams accessible to the current user.
 *
 * @returns React Query query result
 */
export function useTeams(): UseQueryResult<Team[], ApiError> {
  return useQuery<Team[], ApiError>({
    queryKey: ["teams"],
    queryFn: () => apiFetch<Team[]>("/api/v1/teams"),
  });
}

/**
 * Hook to retrieve an individual team by identifier.
 *
 * @param teamId - Team UUID
 * @returns React Query query result
 */
export function useTeam(teamId: string): UseQueryResult<Team, ApiError> {
  return useQuery<Team, ApiError>({
    queryKey: ["team", teamId],
    queryFn: () => apiFetch<Team>(`/api/v1/teams/${teamId}`),
    enabled: Boolean(teamId),
  });
}

/**
 * Hook to retrieve team member roster with assigned roles.
 *
 * @param teamId - Team UUID
 * @returns React Query query result
 */
export function useTeamMembers(
  teamId: string
): UseQueryResult<TeamMember[], ApiError> {
  return useQuery<TeamMember[], ApiError>({
    queryKey: ["team_members", teamId],
    queryFn: () => apiFetch<TeamMember[]>(`/api/v1/teams/${teamId}/members`),
    enabled: Boolean(teamId),
  });
}

export interface AddMemberPayload {
  teamId: string;
  userId: string;
  role: "admin" | "lead" | "member" | "viewer";
}

/**
 * Hook to enroll a member into a team.
 *
 * @returns React Query mutation result
 */
export function useAddTeamMember(): UseMutationResult<
  TeamMember,
  ApiError,
  AddMemberPayload
> {
  const queryClient = useQueryClient();

  return useMutation<TeamMember, ApiError, AddMemberPayload>({
    mutationFn: (payload: AddMemberPayload) => {
      return apiFetch<TeamMember>(`/api/v1/teams/${payload.teamId}/members`, {
        method: "POST",
        body: JSON.stringify({
          user_id: payload.userId,
          role: payload.role,
        }),
      });
    },
    onSuccess: (_, variables: AddMemberPayload) => {
      queryClient.invalidateQueries({ queryKey: ["team_members", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export interface UpdateRolePayload {
  teamId: string;
  userId: string;
  role: "admin" | "lead" | "member" | "viewer";
}

/**
 * Hook to update a team member's role.
 *
 * @returns React Query mutation result
 */
export function useUpdateMemberRole(): UseMutationResult<
  TeamMember,
  ApiError,
  UpdateRolePayload
> {
  const queryClient = useQueryClient();

  return useMutation<TeamMember, ApiError, UpdateRolePayload>({
    mutationFn: (payload: UpdateRolePayload) => {
      return apiFetch<TeamMember>(
        `/api/v1/teams/${payload.teamId}/members/${payload.userId}`,
        {
          method: "PUT",
          body: JSON.stringify({ role: payload.role }),
        }
      );
    },
    onSuccess: (_, variables: UpdateRolePayload) => {
      queryClient.invalidateQueries({ queryKey: ["team_members", variables.teamId] });
    },
  });
}

/**
 * Hook to fetch all workflow templates.
 *
 * @returns React Query query result
 */
export function useWorkflows(): UseQueryResult<Workflow[], ApiError> {
  return useQuery<Workflow[], ApiError>({
    queryKey: ["workflows"],
    queryFn: () => apiFetch<Workflow[]>("/api/v1/workflows"),
  });
}

/**
 * Hook to fetch an individual workflow by identifier.
 *
 * @param workflowId - Workflow UUID
 * @returns React Query query result
 */
export function useWorkflow(
  workflowId: string
): UseQueryResult<Workflow, ApiError> {
  return useQuery<Workflow, ApiError>({
    queryKey: ["workflow", workflowId],
    queryFn: () => apiFetch<Workflow>(`/api/v1/workflows/${workflowId}`),
    enabled: Boolean(workflowId),
  });
}

export interface UpdateWorkflowPayload {
  workflowId: string;
  states?: Array<{ id: string; label: string; type: string }>;
  transitions?: Array<{ from: string; to: string; required_roles: string[] }>;
  name?: string;
  description?: string;
}

/**
 * Hook to update a workflow definition.
 *
 * @returns React Query mutation result
 */
export function useUpdateWorkflow(): UseMutationResult<
  Workflow,
  ApiError,
  UpdateWorkflowPayload
> {
  const queryClient = useQueryClient();

  return useMutation<Workflow, ApiError, UpdateWorkflowPayload>({
    mutationFn: (payload: UpdateWorkflowPayload) => {
      const { workflowId, ...body } = payload;
      return apiFetch<Workflow>(`/api/v1/workflows/${workflowId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data: Workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflow", data.id] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

/**
 * Hook to fetch aggregated operational dashboard statistics.
 *
 * @returns React Query query result
 */
export function useDashboardStats(): UseQueryResult<DashboardStats, ApiError> {
  return useQuery<DashboardStats, ApiError>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/v1/dashboard/stats"),
  });
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  workflow_id?: string;
}

/**
 * Hook to create a new operational team.
 *
 * @returns React Query mutation result
 */
export function useCreateTeam(): UseMutationResult<Team, ApiError, CreateTeamPayload> {
  const queryClient = useQueryClient();

  return useMutation<Team, ApiError, CreateTeamPayload>({
    mutationFn: (payload: CreateTeamPayload) =>
      apiFetch<Team>("/api/v1/teams", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  states: Array<{ id: string; label: string; type: string }>;
  transitions: Array<{ from_state: string; to_state: string; required_roles: string[] }>;
  is_default?: boolean;
}

/**
 * Hook to create a new workflow definition.
 *
 * @returns React Query mutation result
 */
export function useCreateWorkflow(): UseMutationResult<Workflow, ApiError, CreateWorkflowPayload> {
  const queryClient = useQueryClient();

  return useMutation<Workflow, ApiError, CreateWorkflowPayload>({
    mutationFn: (payload: CreateWorkflowPayload) =>
      apiFetch<Workflow>("/api/v1/workflows", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

/**
 * Hook to search users by name or email prefix for team enrollment.
 *
 * @param query - Partial name or email to match
 * @returns React Query query result
 */
export function useUserSearch(query: string): UseQueryResult<User[], ApiError> {
  return useQuery<User[], ApiError>({
    queryKey: ["user_search", query],
    queryFn: () =>
      apiFetch<User[]>(`/api/v1/auth/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 1,
    staleTime: 10000,
  });
}

export interface UpdateTeamPayload {
  teamId: string;
  name?: string;
  description?: string;
  workflow_id?: string;
}

/**
 * Hook to update a team's metadata or workflow binding.
 *
 * @returns React Query mutation result
 */
export function useUpdateTeam(): UseMutationResult<Team, ApiError, UpdateTeamPayload> {
  const queryClient = useQueryClient();

  return useMutation<Team, ApiError, UpdateTeamPayload>({
    mutationFn: (payload: UpdateTeamPayload) => {
      const { teamId, ...body } = payload;
      return apiFetch<Team>(`/api/v1/teams/${teamId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data: Team) => {
      queryClient.invalidateQueries({ queryKey: ["team", data.id] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
}

/**
 * Hook to list all registered users across the platform.
 *
 * @returns React Query query result
 */
export function useUsers(): UseQueryResult<User[], ApiError> {
  return useQuery<User[], ApiError>({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/api/v1/auth/users"),
  });
}

export interface CreateUserPayload {
  email: string;
  password: string;
  display_name: string;
}

/**
 * Hook to register a new platform user from the management view.
 *
 * @returns React Query mutation result
 */
export function useCreateUser(): UseMutationResult<User, ApiError, CreateUserPayload> {
  const queryClient = useQueryClient();

  return useMutation<User, ApiError, CreateUserPayload>({
    mutationFn: (payload: CreateUserPayload) =>
      apiFetch<User>("/api/v1/auth/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user_search"] });
    },
  });
}

export interface UpdateUserPayload {
  userId: string;
  display_name?: string;
  email?: string;
  password?: string;
}

/**
 * Hook to update an existing user profile (Admin required).
 *
 * @returns React Query mutation result
 */
export function useUpdateUser(): UseMutationResult<User, ApiError, UpdateUserPayload> {
  const queryClient = useQueryClient();

  return useMutation<User, ApiError, UpdateUserPayload>({
    mutationFn: ({ userId, ...payload }: UpdateUserPayload) =>
      apiFetch<User>(`/api/v1/auth/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user_search"] });
    },
  });
}

/**
 * Hook to delete a platform user account (Admin required).
 *
 * @returns React Query mutation result
 */
export function useDeleteUser(): UseMutationResult<{ success: boolean; message: string }, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, ApiError, string>({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/v1/auth/users/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user_search"] });
    },
  });
}
