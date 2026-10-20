"use client";

/**
 * Team workflow state machine editor and inspector.
 *
 * Renders the current workflow definition and allows admins to edit states
 * and transitions inline, then persist changes via PUT /api/v1/workflows/{id}.
 */

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTeam } from "@/hooks/use-teams";
import { useWorkflow, useUpdateWorkflow } from "@/hooks/use-teams";
import { StatusBadge } from "@/components/items/StatusBadge";
import { WorkflowState, WorkflowTransition } from "@/types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitBranch,
  Lock,
  Plus,
  Save,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";

const ROLE_OPTIONS = ["admin", "lead", "member", "viewer"] as const;
const STATE_TYPE_OPTIONS = ["initial", "active", "terminal"] as const;

/**
 * Team workflow editor component.
 *
 * Admin users can add/remove states and transitions and save to the server.
 * Non-admin users see a read-only view.
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
  const updateWorkflowMutation = useUpdateWorkflow();

  const [editingStates, setEditingStates] = useState<WorkflowState[]>([]);
  const [editingTransitions, setEditingTransitions] = useState<WorkflowTransition[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const isAdmin = team?.user_role === "admin";

  useEffect(() => {
    if (workflow) {
      setEditingStates(workflow.states.map((s) => ({ ...s })));
      setEditingTransitions(workflow.transitions.map((t) => ({ ...t })));
      setIsDirty(false);
    }
  }, [workflow]);

  const markDirty = (): void => {
    setIsDirty(true);
    setSavedSuccess(false);
  };

  const handleStateChange = (
    index: number,
    field: keyof WorkflowState,
    value: string
  ): void => {
    setEditingStates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    markDirty();
  };

  const handleAddState = (): void => {
    setEditingStates((prev) => [
      ...prev,
      { id: "", label: "", type: "active" },
    ]);
    markDirty();
  };

  const handleRemoveState = (index: number): void => {
    setEditingStates((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const handleTransitionChange = (
    index: number,
    field: keyof WorkflowTransition,
    value: string | string[]
  ): void => {
    setEditingTransitions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    markDirty();
  };

  const handleToggleRole = (transitionIndex: number, role: string): void => {
    setEditingTransitions((prev) => {
      const updated = [...prev];
      const current = updated[transitionIndex].required_roles;
      updated[transitionIndex] = {
        ...updated[transitionIndex],
        required_roles: current.includes(role)
          ? current.filter((r) => r !== role)
          : [...current, role],
      };
      return updated;
    });
    markDirty();
  };

  const handleAddTransition = (): void => {
    const stateIds = editingStates.map((s) => s.id).filter(Boolean);
    setEditingTransitions((prev) => [
      ...prev,
      {
        from: stateIds[0] || "",
        to: stateIds[1] || "",
        required_roles: ["member", "lead", "admin"],
      },
    ]);
    markDirty();
  };

  const handleRemoveTransition = (index: number): void => {
    setEditingTransitions((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const handleSave = async (): Promise<void> => {
    if (!workflow) return;
    await updateWorkflowMutation.mutateAsync({
      workflowId: workflow.id,
      states: editingStates.filter((s) => s.id.trim() && s.label.trim()),
      transitions: editingTransitions
        .filter((t) => t.from && t.to)
        .map((t) => ({
          from: t.from,
          to: t.to,
          required_roles: t.required_roles,
        })),
    });
    setIsDirty(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const validStateIds = editingStates.map((s) => s.id).filter(Boolean);

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
      <div className="flex items-center justify-between">
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
              {isAdmin
                ? "Edit states and transitions, then save to apply changes."
                : "Read-only view of the state machine for " + team.name + "."}
            </p>
          </div>
        </div>

        {isAdmin && isDirty && (
          <button
            onClick={handleSave}
            disabled={updateWorkflowMutation.isPending}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{updateWorkflowMutation.isPending ? "Saving..." : "Save Changes"}</span>
          </button>
        )}

        {savedSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Workflow saved</span>
          </div>
        )}
      </div>

      {updateWorkflowMutation.isError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{updateWorkflowMutation.error?.message || "Failed to save workflow."}</span>
        </div>
      )}

      {/* States */}
      <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-surface-deep/60 pb-3">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <WorkflowIcon className="w-4 h-4 text-accent" />
            <span>States ({editingStates.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-text-muted font-mono">
              {workflow.is_default ? "System Default Template" : "Custom Team Workflow"}
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleAddState}
                className="flex items-center gap-1 text-2xs font-semibold text-accent hover:text-accent-hover px-2.5 py-1 rounded-lg border border-accent/30 hover:bg-accent-light transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add State
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {editingStates.map((state, idx) =>
            isAdmin ? (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border border-surface-deep bg-surface-raised/20"
              >
                <div className="col-span-3">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">ID</label>
                  <input
                    type="text"
                    value={state.id}
                    onChange={(e) => handleStateChange(idx, "id", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                    placeholder="e.g. in_progress"
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs font-mono text-text-primary focus:outline-hidden focus:border-accent transition-colors"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">Label</label>
                  <input
                    type="text"
                    value={state.label}
                    onChange={(e) => handleStateChange(idx, "label", e.target.value)}
                    placeholder="e.g. In Progress"
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent transition-colors"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={state.type}
                    onChange={(e) => handleStateChange(idx, "type", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    {STATE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => handleRemoveState(idx)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className="p-3 rounded-xl border border-surface-deep bg-surface-raised/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={state.id} />
                  <span className="text-2xs font-mono text-text-muted">{state.id}</span>
                </div>
                <span className="text-3xs uppercase font-mono px-1.5 py-0.5 rounded bg-surface-deep/50 text-text-muted">
                  {state.type}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Transitions */}
      <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-surface-deep bg-surface-raised/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <GitBranch className="w-4 h-4 text-accent" />
            <span>Permitted Transitions &amp; Role Guards ({editingTransitions.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xs text-text-muted">Enforced server-side</span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleAddTransition}
                className="flex items-center gap-1 text-2xs font-semibold text-accent hover:text-accent-hover px-2.5 py-1 rounded-lg border border-accent/30 hover:bg-accent-light transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Transition
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-surface-deep/60">
          {editingTransitions.map((transition, idx) =>
            isAdmin ? (
              <div
                key={idx}
                className="p-4 space-y-3"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-2xs text-text-muted uppercase tracking-wider">From</label>
                    <select
                      value={transition.from}
                      onChange={(e) => handleTransitionChange(idx, "from", e.target.value)}
                      className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden"
                    >
                      {validStateIds.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted" />
                  <div className="flex items-center gap-2">
                    <label className="text-2xs text-text-muted uppercase tracking-wider">To</label>
                    <select
                      value={transition.to}
                      onChange={(e) => handleTransitionChange(idx, "to", e.target.value)}
                      className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden"
                    >
                      {validStateIds.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTransition(idx)}
                    className="ml-auto p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Lock className="w-3 h-3 text-text-muted" />
                  <span className="text-2xs text-text-muted">Required roles:</span>
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleToggleRole(idx, role)}
                      className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded transition-colors ${
                        transition.required_roles.includes(role)
                          ? "bg-accent-light text-accent border border-accent/30"
                          : "bg-surface-raised text-text-muted border border-surface-deep"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-raised/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={transition.from} />
                  <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <StatusBadge status={transition.to} />
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-2xs text-text-muted mr-1">Required roles:</span>
                  <div className="flex flex-wrap gap-1">
                    {transition.required_roles.map((r) => (
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
            )
          )}
        </div>
      </div>

      {isAdmin && isDirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateWorkflowMutation.isPending}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{updateWorkflowMutation.isPending ? "Saving..." : "Save Workflow Changes"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
