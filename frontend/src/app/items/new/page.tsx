"use client";

/**
 * Work item creation page with client idempotency key generation and duplicate detection.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateItem, useSemanticSearch } from "@/hooks/use-items";
import { useTeams, useTeamMembers } from "@/hooks/use-teams";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";

/**
 * Create new work item page component.
 *
 * @returns JSX Element
 */
export default function NewWorkItemPage(): React.JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState<string>("general");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  const { data: teamsData } = useTeams();
  const { data: teamMembersData } = useTeamMembers(teamId);
  const createItemMutation = useCreateItem();

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (teamsData && teamsData.length > 0 && !teamId) {
      setTeamId(teamsData[0].id);
    }
  }, [teamsData, teamId]);

  const { data: duplicateCheck } = useSemanticSearch(title.length >= 6 ? title : "");
  const potentialDuplicates = duplicateCheck?.results.filter((r) => r.similarity_score > 0.8) || [];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!teamId) return;

    try {
      const created = await createItemMutation.mutateAsync({
        title,
        description,
        team_id: teamId,
        priority,
        category,
        assignee_id: assigneeId || null,
        idempotencyKey,
      });
      router.push(`/items/${created.id}`);
    } catch {
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/items"
          className="p-2 rounded-xl border border-surface-deep bg-white hover:bg-surface-raised transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Create Operational Work Item
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Log an operational incident, customer request, or engineering task.
          </p>
        </div>
      </div>

      {createItemMutation.isError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{createItemMutation.error?.message || "Failed to create work item."}</span>
        </div>
      )}

      {potentialDuplicates.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Similar Existing Items Detected ({potentialDuplicates.length})</span>
          </div>
          <p className="text-xs text-amber-900/80">
            Before creating, verify whether this work is already in progress:
          </p>
          <div className="space-y-1.5 pt-1">
            {potentialDuplicates.map((dup) => (
              <Link
                key={dup.item.id}
                href={`/items/${dup.item.id}`}
                target="_blank"
                className="flex items-center justify-between p-2 rounded-lg bg-white/80 border border-amber-200 text-xs hover:bg-white transition-colors"
              >
                <span className="font-medium text-text-primary truncate mr-2">
                  {dup.item.title}
                </span>
                <span className="text-amber-800 font-mono text-2xs flex-shrink-0">
                  {Math.round(dup.similarity_score * 100)}% match
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Title
          </label>
          <input
            type="text"
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Payment gateway webhook timeouts on stripe-v3"
            className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Detailed Description & Context
          </label>
          <textarea
            required
            rows={5}
            minLength={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Document what occurred, why it matters, impact assessment, and initial observations..."
            className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Owning Operational Team
            </label>
            <select
              required
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            >
              {teamsData?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            >
              <option value="low">Low - Routine inquiry</option>
              <option value="medium">Medium - Standard operational task</option>
              <option value="high">High - Elevated impact</option>
              <option value="critical">Critical - Active blocker / outage</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            >
              <option value="incident">Production Incident</option>
              <option value="customer_issue">Customer Issue</option>
              <option value="engineering">Engineering Investigation</option>
              <option value="compliance">Compliance Request</option>
              <option value="operational">Operational Task</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Assignee (Optional)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            >
              <option value="">Unassigned (Claim later)</option>
              {teamMembersData?.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.display_name || m.user_id} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-surface-deep flex items-center justify-between">
          <div className="text-2xs text-text-muted font-mono truncate max-w-xs">
            Idempotency Key: {idempotencyKey.slice(0, 13)}...
          </div>
          <button
            type="submit"
            disabled={createItemMutation.isPending}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-60"
          >
            <span>{createItemMutation.isPending ? "Creating..." : "Create Work Item"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
