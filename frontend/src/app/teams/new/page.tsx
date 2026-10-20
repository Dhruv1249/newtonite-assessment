"use client";

/**
 * Team creation page with workflow selector.
 */

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCreateTeam } from "@/hooks/use-teams";
import { useWorkflows } from "@/hooks/use-teams";
import { AlertTriangle, ArrowLeft, ArrowRight, Users } from "lucide-react";

/**
 * Team creation form inner component.
 *
 * @returns JSX Element
 */
function NewTeamForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryWorkflowId = searchParams.get("workflow_id") || "";

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [workflowId, setWorkflowId] = useState<string>(queryWorkflowId);

  useEffect(() => {
    if (queryWorkflowId) {
      setWorkflowId(queryWorkflowId);
    }
  }, [queryWorkflowId]);

  const { data: workflows } = useWorkflows();
  const createTeamMutation = useCreateTeam();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      const team = await createTeamMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        workflow_id: workflowId || undefined,
      });
      router.push(`/teams/${team.id}`);
    } catch {
      // error surfaced via mutation.isError
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-xl border border-surface-deep bg-white hover:bg-surface-raised transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Create Operational Team
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Define a new team with a name, optional description, and workflow definition.
          </p>
        </div>
      </div>

      {createTeamMutation.isError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{createTeamMutation.error?.message || "Failed to create team."}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-5"
      >
        <div className="flex items-center gap-2 text-text-primary font-bold text-sm pb-3 border-b border-surface-deep/60">
          <Users className="w-4 h-4 text-accent" />
          <span>Team Details</span>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Team Name
          </label>
          <input
            type="text"
            required
            minLength={2}
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Platform Engineering, Customer Operations"
            className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the team's operational responsibilities..."
            className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Workflow Definition
          </label>
          <select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
          >
            <option value="">Use system default workflow</option>
            {workflows?.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}{wf.is_default ? " (Default)" : ""}
              </option>
            ))}
          </select>
          <p className="text-2xs text-text-muted mt-1">
            Governs permitted status transitions and role guards for all items in this team.
          </p>
        </div>

        <div className="pt-4 border-t border-surface-deep flex items-center justify-end">
          <button
            type="submit"
            disabled={createTeamMutation.isPending || !name.trim()}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-60"
          >
            <span>{createTeamMutation.isPending ? "Creating..." : "Create Team"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * New team creation form page wrapped in suspense boundary.
 *
 * @returns JSX Element
 */
export default function NewTeamPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-xs text-text-muted">
          Loading team creation...
        </div>
      }
    >
      <NewTeamForm />
    </Suspense>
  );
}
