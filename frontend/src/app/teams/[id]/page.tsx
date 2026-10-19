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
} from "@/hooks/use-teams";
import {
  ArrowLeft,
  GitBranch,
  Shield,
  Trash2,
  UserPlus,
  Users,
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

  const [newUserId, setNewUserId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "lead" | "member" | "viewer">("member");

  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);

  const addMemberMutation = useAddTeamMember();
  const updateRoleMutation = useUpdateMemberRole();

  const currentMembership = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMembership?.role === "admin";

  const handleAddMember = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newUserId) return;
    await addMemberMutation.mutateAsync({
      teamId,
      userId: newUserId,
      role: newMemberRole,
    });
    setNewUserId("");
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
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="User UUID identifier..."
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-surface/50 border border-surface-deep rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            />
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
              disabled={addMemberMutation.isPending}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs disabled:opacity-50"
            >
              {addMemberMutation.isPending ? "Adding..." : "Add Member"}
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
