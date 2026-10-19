"use client";

/**
 * Team workflow state machine inspection and configuration editor.
 */

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTeam, useWorkflow } from "@/hooks/use-teams";
import { StatusBadge } from "@/components/items/StatusBadge";
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Lock,
  Shield,
  Workflow as WorkflowIcon,
} from "lucide-react";

/**
 * Team workflow editor and state machine rules inspector.
 *
 * @returns JSX Element
 */
export default function TeamWorkflowPage(): React.JSX.Element {
  const params = useParams();
  const teamId = typeof params.id === "string" ? params.id : "";

  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(
    team?.workflow_id || ""
  );

  if (teamLoading || workflowLoading) {
    return (
      <div className="py-24 text-center text-xs text-text-muted">
        Loading workflow definition...
      </div>
    );
  }

  if (!team || !workflow) {
    return (
      <div className="py-16 text-center text-xs text-text-muted">
        Workflow specification not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/teams/${team.id}`}
          className="p-2 rounded-xl border border-surface-deep bg-white hover:bg-surface-raised transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Workflow: {workflow.name}
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Configured state machine governing work item transitions for {team.name}.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-surface-deep/60 pb-3">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <WorkflowIcon className="w-4 h-4 text-accent" />
            <span>Declared States ({workflow.states.length})</span>
          </div>
          <span className="text-2xs text-text-muted font-mono">
            {workflow.is_default ? "System Default Template" : "Custom Team Workflow"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {workflow.states.map((state) => (
            <div
              key={state.id}
              className="p-3 rounded-xl border border-surface-deep bg-surface-raised/40 space-y-1"
            >
              <div className="flex items-center justify-between">
                <StatusBadge status={state.id} />
                <span className="text-3xs uppercase font-mono px-1.5 py-0.5 rounded bg-surface-deep/50 text-text-muted">
                  {state.type}
                </span>
              </div>
              <div className="text-2xs font-mono text-text-muted truncate mt-1">
                ID: {state.id}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-surface-deep bg-surface-raised/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <GitBranch className="w-4 h-4 text-accent" />
            <span>Permitted State Transitions & Role Guards ({workflow.transitions.length})</span>
          </div>
          <span className="text-2xs text-text-muted">
            Enforced server-side
          </span>
        </div>

        <div className="divide-y divide-surface-deep/60">
          {workflow.transitions.map((t, idx) => (
            <div
              key={idx}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-raised/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={t.from} />
                <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                <StatusBadge status={t.to} />
              </div>

              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-2xs text-text-muted mr-1">Required roles:</span>
                <div className="flex flex-wrap gap-1">
                  {t.required_roles.map((r) => (
                    <span
                      key={r}
                      className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-accent-light text-accent uppercase"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
