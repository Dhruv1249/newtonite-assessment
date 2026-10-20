"use client";

/**
 * Standalone workflow creation page for defining new state machine templates.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateWorkflow } from "@/hooks/use-teams";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitBranch,
  Lock,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";

interface DraftState {
  id: string;
  label: string;
  type: "initial" | "active" | "terminal";
}

interface DraftTransition {
  from_state: string;
  to_state: string;
  required_roles: string[];
}

const ROLE_OPTIONS = ["admin", "lead", "member", "viewer"] as const;
const STATE_TYPE_OPTIONS: Array<"initial" | "active" | "terminal"> = [
  "initial",
  "active",
  "terminal",
];

const DEFAULT_STATES: DraftState[] = [
  { id: "open", label: "Open", type: "initial" },
  { id: "in_progress", label: "In Progress", type: "active" },
  { id: "resolved", label: "Resolved", type: "terminal" },
];

const DEFAULT_TRANSITIONS: DraftTransition[] = [
  { from_state: "open", to_state: "in_progress", required_roles: ["member", "lead", "admin"] },
  { from_state: "in_progress", to_state: "resolved", required_roles: ["lead", "admin"] },
];

/**
 * Workflow creation page component.
 *
 * Allows any authenticated user to compose a new workflow definition with
 * custom states and role-guarded transitions, then POST to the server.
 *
 * @returns JSX Element
 */
export default function NewWorkflowPage(): React.JSX.Element {
  const router = useRouter();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [states, setStates] = useState<DraftState[]>(DEFAULT_STATES);
  const [transitions, setTransitions] = useState<DraftTransition[]>(DEFAULT_TRANSITIONS);

  const createWorkflowMutation = useCreateWorkflow();

  const validStateIds = states.map((s) => s.id).filter(Boolean);

  const handleStateChange = (
    index: number,
    field: keyof DraftState,
    value: string
  ): void => {
    setStates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as DraftState;
      return updated;
    });
  };

  const handleAddState = (): void => {
    setStates((prev) => [...prev, { id: "", label: "", type: "active" }]);
  };

  const handleRemoveState = (index: number): void => {
    setStates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTransitionChange = (
    index: number,
    field: "from_state" | "to_state",
    value: string
  ): void => {
    setTransitions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleRole = (transitionIndex: number, role: string): void => {
    setTransitions((prev) => {
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
  };

  const handleAddTransition = (): void => {
    setTransitions((prev) => [
      ...prev,
      {
        from_state: validStateIds[0] || "",
        to_state: validStateIds[1] || "",
        required_roles: ["member", "lead", "admin"],
      },
    ]);
  };

  const handleRemoveTransition = (index: number): void => {
    setTransitions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const validStates = states.filter((s) => s.id.trim() && s.label.trim());
    const validTransitions = transitions.filter((t) => t.from_state && t.to_state);

    await createWorkflowMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      states: validStates,
      transitions: validTransitions,
    });

    router.push("/workflows");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="p-2 rounded-xl border border-surface-deep bg-white hover:bg-surface-raised transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Create Workflow Definition
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Define a new state machine with custom states, transitions, and role guards.
          </p>
        </div>
      </div>

      {createWorkflowMutation.isError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{createWorkflowMutation.error?.message || "Failed to create workflow."}</span>
        </div>
      )}

      {createWorkflowMutation.isSuccess && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Workflow created successfully. Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm pb-3 border-b border-surface-deep/60">
            <WorkflowIcon className="w-4 h-4 text-accent" />
            <span>Workflow Identity</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Workflow Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bug Triage Flow, Support Escalation Workflow"
              className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and scope of this workflow..."
              className="w-full px-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>

        {/* States editor */}
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-surface-deep/60 pb-3">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <WorkflowIcon className="w-4 h-4 text-accent" />
              <span>States ({states.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAddState}
              className="flex items-center gap-1 text-2xs font-semibold text-accent hover:text-accent-hover px-2.5 py-1 rounded-lg border border-accent/30 hover:bg-accent-light transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add State
            </button>
          </div>

          <div className="space-y-2">
            {states.map((state, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border border-surface-deep bg-surface-raised/20"
              >
                <div className="col-span-3">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">
                    ID
                  </label>
                  <input
                    type="text"
                    value={state.id}
                    onChange={(e) =>
                      handleStateChange(
                        idx,
                        "id",
                        e.target.value.toLowerCase().replace(/\s+/g, "_")
                      )
                    }
                    placeholder="e.g. in_progress"
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs font-mono text-text-primary focus:outline-hidden focus:border-accent transition-colors"
                  />
                </div>
                <div className="col-span-5">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={state.label}
                    onChange={(e) => handleStateChange(idx, "label", e.target.value)}
                    placeholder="e.g. In Progress"
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent transition-colors"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-2xs text-text-muted uppercase tracking-wider mb-1">
                    Type
                  </label>
                  <select
                    value={state.type}
                    onChange={(e) =>
                      handleStateChange(
                        idx,
                        "type",
                        e.target.value as "initial" | "active" | "terminal"
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-deep rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    {STATE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
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
            ))}
          </div>
          <p className="text-2xs text-text-muted">
            Exactly one state must have type <span className="font-mono">initial</span>. States with type{" "}
            <span className="font-mono">terminal</span> cannot be transitioned away from.
          </p>
        </div>

        {/* Transitions editor */}
        <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-surface-deep bg-surface-raised/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <GitBranch className="w-4 h-4 text-accent" />
              <span>Permitted Transitions &amp; Role Guards ({transitions.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAddTransition}
              className="flex items-center gap-1 text-2xs font-semibold text-accent hover:text-accent-hover px-2.5 py-1 rounded-lg border border-accent/30 hover:bg-accent-light transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Transition
            </button>
          </div>

          <div className="divide-y divide-surface-deep/60">
            {transitions.map((transition, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-2xs text-text-muted uppercase tracking-wider">From</label>
                    <select
                      value={transition.from_state}
                      onChange={(e) => handleTransitionChange(idx, "from_state", e.target.value)}
                      className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                    >
                      {validStateIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted" />
                  <div className="flex items-center gap-2">
                    <label className="text-2xs text-text-muted uppercase tracking-wider">To</label>
                    <select
                      value={transition.to_state}
                      onChange={(e) => handleTransitionChange(idx, "to_state", e.target.value)}
                      className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                    >
                      {validStateIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
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
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={createWorkflowMutation.isPending || !name.trim() || states.length === 0}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-60"
          >
            <span>{createWorkflowMutation.isPending ? "Creating..." : "Create Workflow"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
