"use client";

/**
 * Workflow templates library page — lists all defined workflow state machines.
 */

import React from "react";
import Link from "next/link";
import { useWorkflows } from "@/hooks/use-teams";
import { ArrowRight, GitBranch, Plus, Workflow as WorkflowIcon } from "lucide-react";

/**
 * Workflows library page component.
 *
 * @returns JSX Element
 */
export default function WorkflowsPage(): React.JSX.Element {
  const { data: workflows, isLoading } = useWorkflows();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Workflow Templates
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            State machine definitions governing work item lifecycle and role-based transition rules.
          </p>
        </div>
        <Link
          href="/workflows/new"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Workflow</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-white rounded-2xl border border-surface-deep p-5 shadow-2xs hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <WorkflowIcon className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="font-bold text-sm text-text-primary truncate">
                      {workflow.name}
                    </span>
                    {workflow.is_default && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-light text-accent font-semibold border border-accent/20">
                        Default
                      </span>
                    )}
                  </div>
                  {workflow.description && (
                    <p className="text-xs text-text-secondary pl-6">{workflow.description}</p>
                  )}
                  <div className="flex items-center gap-4 pl-6 text-2xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <WorkflowIcon className="w-3 h-3" />
                      {workflow.states.length} states
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {workflow.transitions.length} transitions
                    </span>
                    <span className="font-mono">
                      Created {new Date(workflow.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/teams/new?workflow_id=${workflow.id}`}
                      className="ml-auto font-sans font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <span>Create Team with this Workflow</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {workflow.states.slice(0, 5).map((state) => (
                    <span
                      key={state.id}
                      className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-muted"
                    >
                      {state.id}
                    </span>
                  ))}
                  {workflow.states.length > 5 && (
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-muted">
                      +{workflow.states.length - 5}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-2xl border border-surface-deep shadow-2xs">
          <WorkflowIcon className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-text-primary">No workflow templates defined</p>
          <p className="text-xs text-text-secondary mt-1 mb-4">
            Create a workflow to govern your team&apos;s work item lifecycle.
          </p>
          <Link
            href="/workflows/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white font-semibold text-xs rounded-xl hover:bg-accent-hover transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Workflow
          </Link>
        </div>
      )}
    </div>
  );
}
