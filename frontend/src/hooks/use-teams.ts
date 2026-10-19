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
