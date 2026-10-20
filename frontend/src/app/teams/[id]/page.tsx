"use client";

/**
 * Team administration and membership role management page.
 */

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  useTeam,
  useTeamMembers,
  useAddTeamMember,
  useUpdateMemberRole,
  useUserSearch,
  useWorkflows,
  useUpdateTeam,
} from "@/hooks/use-teams";
import { User } from "@/types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  GitBranch,
  Save,
  Search,
  Settings,
  UserPlus,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react";

/**
 * Team roster and role administration page component.
 *
 * @returns JSX Element
 */
export default function TeamManagementPage(): React.JSX.Element {
  const params = useParams();
  const teamId = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "lead" | "member" | "viewer">("member");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);
  const { data: userSearchResults } = useUserSearch(searchQuery);
  const { data: workflows } = useWorkflows();

  const addMemberMutation = useAddTeamMember();
  const updateRoleMutation = useUpdateMemberRole();
  const updateTeamMutation = useUpdateTeam();

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [workflowUpdateSuccess, setWorkflowUpdateSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    if (team?.workflow_id) {
      setSelectedWorkflowId(team.workflow_id);
    }
  }, [team?.workflow_id]);

  const currentMembership = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMembership?.role === "admin";

  const existingMemberIds = new Set(members?.map((m) => m.user_id) || []);
  const filteredSearchResults = userSearchResults?.filter(
    (u) => !existingMemberIds.has(u.id)
  );

  const handleSelectUser = (foundUser: User): void => {
    setSelectedUser(foundUser);
    setSearchQuery(foundUser.display_name);
    setShowDropdown(false);
  };

  const handleAddMember = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedUser) return;
    await addMemberMutation.mutateAsync({
      teamId,
      userId: selectedUser.id,
      role: newMemberRole,
    });
    setSelectedUser(null);
    setSearchQuery("");
  };

  const handleRoleChange = async (
    targetUserId: string,
    role: "admin" | "lead" | "member" | "viewer"
  ): Promise<void> => {
    await updateRoleMutation.mutateAsync({
      teamId,
      userId: targetUserId,
      role,
    });
  };

  const handleWorkflowChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedWorkflowId || selectedWorkflowId === team?.workflow_id) return;
    await updateTeamMutation.mutateAsync({
      teamId,
      workflow_id: selectedWorkflowId,
    });
    setWorkflowUpdateSuccess(true);
    setTimeout(() => setWorkflowUpdateSuccess(false), 3000);
  };

  if (teamLoading) {
    return (
      <div className="py-24 text-center text-xs text-text-muted">
        Loading team information...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="py-16 text-center text-xs text-text-muted">
        Team not found or access denied.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl border border-surface-deep bg-white hover:bg-surface-raised transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {team.name}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              {team.description || "Operational group roster and authorization settings."}
            </p>
          </div>
        </div>

        <Link
          href={`/teams/${team.id}/workflow`}
          className="px-4 py-2 bg-surface-raised hover:bg-surface-deep border border-surface-deep text-text-primary font-semibold text-xs rounded-xl transition-colors flex items-center gap-2"
        >
          <GitBranch className="w-4 h-4 text-accent" />
          <span>Workflow Definition</span>
        </Link>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <UserPlus className="w-4 h-4 text-accent" />
            <span>Enroll Team Member</span>
          </div>
          <form onSubmit={handleAddMember} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Search user by name or email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedUser(null);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-3.5 py-2 bg-surface/50 border border-surface-deep rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                  />
                </div>

                {showDropdown && searchQuery.trim().length >= 1 && filteredSearchResults && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-surface-deep rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-surface-deep">
                    {filteredSearchResults.length > 0 ? (
                      filteredSearchResults.map((foundUser) => (
                        <button
                          key={foundUser.id}
                          type="button"
                          onClick={() => handleSelectUser(foundUser)}
                          className="w-full px-3 py-2 text-left hover:bg-surface-raised flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-text-primary">{foundUser.display_name}</div>
                            <div className="text-2xs text-text-muted font-mono">{foundUser.email}</div>
                          </div>
                          <span className="text-2xs font-mono text-accent">Select</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-2xs text-text-muted text-center">No matching unassigned users found</div>
                    )}
                  </div>
                )}
              </div>

              <select
                value={newMemberRole}
                onChange={(e) =>
                  setNewMemberRole(e.target.value as "admin" | "lead" | "member" | "viewer")
                }
                className="px-3 py-2 bg-surface-raised border border-surface-deep rounded-xl text-xs text-text-primary focus:outline-hidden"
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>

              <button
                type="submit"
                disabled={addMemberMutation.isPending || !selectedUser}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs disabled:opacity-50"
              >
                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
              </button>
            </div>

            {selectedUser && (
              <div className="text-2xs text-text-secondary bg-surface-raised/50 px-3 py-1.5 rounded-lg border border-surface-deep flex items-center justify-between">
                <span>Selected: <strong>{selectedUser.display_name}</strong> ({selectedUser.email})</span>
                <span className="font-mono text-text-muted text-3xs">{selectedUser.id}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-surface-deep/60 pb-3">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <WorkflowIcon className="w-4 h-4 text-accent" />
              <span>Assigned State Machine Workflow</span>
            </div>
            <Link
              href={`/teams/${team.id}/workflow`}
              className="text-2xs text-accent hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Edit State Rules</span>
              <GitBranch className="w-3.5 h-3.5" />
            </Link>
          </div>

          {workflowUpdateSuccess && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Workflow template successfully applied to team.</span>
            </div>
          )}

          {updateTeamMutation.isError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{updateTeamMutation.error?.message || "Failed to switch workflow."}</span>
            </div>
          )}

          <form onSubmit={handleWorkflowChange} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="flex-1 w-full">
              <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1 font-semibold">
                Select Active Workflow Definition
              </label>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface/50 border border-surface-deep rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
              >
                {workflows?.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.states.length} states, {wf.transitions.length} transitions)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={updateTeamMutation.isPending || selectedWorkflowId === team.workflow_id}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{updateTeamMutation.isPending ? "Applying..." : "Apply Workflow"}</span>
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-surface-deep bg-surface-raised/40 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
            <Users className="w-4 h-4 text-accent" />
            <span>Enrolled Members ({members?.length || 0})</span>
          </div>
          <span className="text-2xs text-text-muted">
            Your role in team: <strong className="uppercase">{team.user_role}</strong>
          </span>
        </div>

        {membersLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading roster...</div>
        ) : members && members.length > 0 ? (
          <div className="divide-y divide-surface-deep/60">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-surface-raised/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center">
                    {member.user?.display_name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-text-primary">
                      {member.user?.display_name || "Team Member"}
                    </div>
                    <div className="text-2xs text-text-muted font-mono">
                      {member.user?.email || member.user_id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isAdmin ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(
                          member.user_id,
                          e.target.value as "admin" | "lead" | "member" | "viewer"
                        )
                      }
                      className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs font-semibold text-text-primary uppercase focus:outline-hidden"
                    >
                      <option value="admin">Admin</option>
                      <option value="lead">Lead</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-secondary uppercase">
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-text-muted">No members enrolled.</div>
        )}
      </div>
    </div>
  );
}
