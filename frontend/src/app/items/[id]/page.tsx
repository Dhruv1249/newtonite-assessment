"use client";

/**
 * Work item detail view coordinating state transitions, concurrency resolution, and AI triage.
 */

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  useItem,
  useItemActivity,
  useItemComments,
  useAddComment,
  useTransitionItem,
  useAssignItem,
  useItemSuggestions,
} from "@/hooks/use-items";
import { useTeam, useTeamMembers, useWorkflow } from "@/hooks/use-teams";
import { StatusBadge, PriorityBadge } from "@/components/items/StatusBadge";
import { ConflictDialog } from "@/components/items/ConflictDialog";
import { AISuggestionsCard } from "@/components/items/AISuggestionsCard";
import { ActivityTimeline } from "@/components/items/ActivityTimeline";
import { ApiError } from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  MessageSquare,
  Send,
  User,
  Users,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  Lock,
  Workflow as WorkflowIcon,
} from "lucide-react";

/**
 * Work item detail page component.
 *
 * @returns JSX Element
 */
export default function WorkItemDetailPage(): React.JSX.Element {
  const params = useParams();
  const itemId = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();

  const [commentText, setCommentText] = useState<string>("");
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isConflictOpen, setIsConflictOpen] = useState<boolean>(false);

  const {
    data: item,
    isLoading: itemLoading,
    refetch: refetchItem,
    error: itemError,
  } = useItem(itemId);

  const { data: teamData } = useTeam(item?.team_id || "");
  const { data: teamMembers } = useTeamMembers(item?.team_id || "");
  const { data: workflowData } = useWorkflow(item?.workflow_id || teamData?.workflow_id || "");
  const { data: comments, isLoading: commentsLoading } = useItemComments(itemId);
  const { data: activityLogs, isLoading: activityLoading } = useItemActivity(itemId);
  const { data: aiMetadata, isLoading: suggestionsLoading } = useItemSuggestions(itemId);

  const addCommentMutation = useAddComment(itemId);
  const transitionMutation = useTransitionItem();
  const assignMutation = useAssignItem();

  const handleTransition = async (targetStatus: string): Promise<void> => {
    if (!item) return;
    try {
      await transitionMutation.mutateAsync({
        itemId: item.id,
        targetStatus,
        expectedVersion: item.version,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isConflict) {
        setConflictError(err.message);
        setIsConflictOpen(true);
      }
    }
  };

  const handleAssign = async (assigneeId: string | null): Promise<void> => {
    if (!item) return;
    try {
      await assignMutation.mutateAsync({
        itemId: item.id,
        assigneeId,
        expectedVersion: item.version,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isConflict) {
        setConflictError(err.message);
        setIsConflictOpen(true);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addCommentMutation.mutateAsync(commentText);
    setCommentText("");
  };

  if (itemLoading) {
    return (
      <div className="py-24 text-center text-xs text-text-muted">
        Loading operational item details...
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center bg-white rounded-2xl border border-surface-deep p-8 shadow-sm">
        <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-text-primary">Work Item Inaccessible</h2>
        <p className="text-xs text-text-secondary mt-1">
          This item does not exist or you lack team membership permissions to view it.
        </p>
        <Link
          href="/items"
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-surface-raised hover:bg-surface-deep border border-surface-deep rounded-xl text-xs font-semibold text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Work Items</span>
        </Link>
      </div>
    );
  }

  const userMembership = teamMembers?.find((m) => m.user_id === user?.id);
  const userRole = userMembership?.role || "viewer";

  const allowedTransitions =
    workflowData?.transitions.filter((t) => {
      if (t.from !== item.status) return false;
      if (userRole === "admin") return true;
      return t.required_roles.includes(userRole);
    }) || [];

  return (
    <div className="space-y-6">
      <ConflictDialog
        isOpen={isConflictOpen}
        onClose={() => setIsConflictOpen(false)}
        onRefresh={() => refetchItem()}
        errorMessage={conflictError || undefined}
      />

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to catalog</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-muted">
            Version {item.version}
          </span>
          <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-muted">
            ID: {item.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={item.priority} />
              <StatusBadge status={item.status} />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-raised border border-surface-deep text-text-secondary font-medium uppercase text-2xs">
                {item.category}
              </span>
            </div>

            <h1 className="text-xl font-bold text-text-primary leading-snug">
              {item.title}
            </h1>

            <div className="pt-2 border-t border-surface-deep/60">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Context & Investigation
              </h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="pt-4 border-t border-surface-deep/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-2xs text-text-muted uppercase tracking-wider block">
                  Owning Team
                </span>
                <span className="font-semibold text-text-primary mt-0.5 block truncate">
                  {item.team?.name || "Platform Engineering"}
                </span>
              </div>
              <div>
                <span className="text-2xs text-text-muted uppercase tracking-wider block">
                  Author
                </span>
                <span className="font-semibold text-text-primary mt-0.5 block truncate">
                  {item.creator?.display_name || "System"}
                </span>
              </div>
              <div>
                <span className="text-2xs text-text-muted uppercase tracking-wider block">
                  Created
                </span>
                <span className="font-mono text-text-secondary mt-0.5 block">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-2xs text-text-muted uppercase tracking-wider block">
                  Updated
                </span>
                <span className="font-mono text-text-secondary mt-0.5 block">
                  {new Date(item.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-surface-deep/60 pb-3">
              <div className="flex items-center gap-2">
                <WorkflowIcon className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Workflow Lifecycle Pipeline
                </h3>
              </div>
              {workflowData && (
                <Link
                  href={`/teams/${item.team_id}/workflow`}
                  className="text-2xs text-text-muted hover:text-accent flex items-center gap-1 font-mono transition-colors"
                >
                  <span>{workflowData.name}</span>
                  <GitBranch className="w-3 h-3" />
                </Link>
              )}
            </div>

            {workflowData && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                  {workflowData.states.map((st, idx) => {
                    const isCurrent = st.id === item.status;
                    const canTransitionTo = allowedTransitions.some((t) => t.to === st.id);

                    return (
                      <React.Fragment key={st.id}>
                        {idx > 0 && (
                          <div className="w-3 h-0.5 bg-surface-deep flex-shrink-0" />
                        )}
                        <div
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 flex-shrink-0 transition-all ${
                            isCurrent
                              ? "bg-accent text-white border-accent shadow-xs font-bold ring-2 ring-accent/30"
                              : canTransitionTo
                              ? "bg-accent-light/40 border-accent/40 text-accent hover:bg-accent hover:text-white cursor-pointer"
                              : "bg-surface-raised/40 border-surface-deep text-text-muted"
                          }`}
                          onClick={() => {
                            if (canTransitionTo) {
                              handleTransition(st.id);
                            }
                          }}
                        >
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                          <span>{st.label}</span>
                          {canTransitionTo && <ArrowRight className="w-3 h-3 opacity-70" />}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-surface-deep/40 flex items-center justify-between flex-wrap gap-2 text-2xs">
                  <span className="text-text-muted">
                    Your role in team: <strong className="uppercase font-mono text-text-secondary">{userRole}</strong>
                  </span>
                  {allowedTransitions.length > 0 ? (
                    <span className="text-accent font-semibold">
                      Click highlighted states above or advance below
                    </span>
                  ) : (
                    <span className="text-text-muted italic flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      No further transitions authorized for your role
                    </span>
                  )}
                </div>
              </div>
            )}

            {allowedTransitions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-deep/60">
                {allowedTransitions.map((t) => (
                  <button
                    key={`${t.from}-${t.to}`}
                    type="button"
                    disabled={transitionMutation.isPending}
                    onClick={() => handleTransition(t.to)}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white border border-accent rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    <span>Advance to {t.to.replace(/_/g, " ").toUpperCase()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}

            {transitionMutation.isError && !transitionMutation.error.isConflict && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs mt-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{transitionMutation.error.message}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span>Discussion Thread ({comments?.length || 0})</span>
            </div>

            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                rows={3}
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share findings, mitigation steps, or updates..."
                className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addCommentMutation.isPending || !commentText.trim()}
                  className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{addCommentMutation.isPending ? "Posting..." : "Post Comment"}</span>
                </button>
              </div>
            </form>

            <div className="space-y-3 pt-2">
              {commentsLoading ? (
                <div className="text-xs text-text-muted text-center py-4">Loading comments...</div>
              ) : comments && comments.length > 0 ? (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3.5 rounded-xl border border-surface-deep bg-surface-raised/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-2xs text-text-muted">
                      <span className="font-semibold text-text-primary">
                        {comment.author?.display_name || "Colleague"}
                      </span>
                      <span className="font-mono">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-text-muted italic">
                  No comments yet. Start the conversation.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Assigned Responsibility
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl border border-surface-deep bg-surface-raised/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">
                  {item.assignee ? item.assignee.display_name.charAt(0) : "?"}
                </div>
                <div>
                  <div className="font-semibold text-xs text-text-primary">
                    {item.assignee?.display_name || "Unassigned"}
                  </div>
                  <div className="text-2xs text-text-muted">
                    {item.assignee ? item.assignee.email : "Claim to take ownership"}
                  </div>
                </div>
              </div>
            </div>

            {userRole !== "viewer" && (
              <div className="space-y-2 pt-2 border-t border-surface-deep/60">
                <label className="block text-2xs font-semibold text-text-muted uppercase">
                  Change Assignee
                </label>
                <select
                  value={item.assignee_id || ""}
                  onChange={(e) => handleAssign(e.target.value || null)}
                  disabled={assignMutation.isPending}
                  className="w-full px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden"
                >
                  <option value="">Unassigned</option>
                  {teamMembers?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.display_name || m.user_id} ({m.role})
                    </option>
                  ))}
                </select>

                {!item.assignee_id && user && (
                  <button
                    type="button"
                    onClick={() => handleAssign(user.id)}
                    className="w-full py-1.5 bg-white border border-accent text-accent hover:bg-accent hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs mt-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Claim Ownership</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <AISuggestionsCard
            metadata={aiMetadata || item.ai_metadata}
            isLoading={suggestionsLoading}
            onApplyAssignee={(uid) => handleAssign(uid)}
          />

          <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <Clock className="w-4 h-4 text-accent" />
              <span>Activity History</span>
            </div>
            <ActivityTimeline logs={activityLogs || []} isLoading={activityLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
