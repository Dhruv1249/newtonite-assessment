"use client";

/**
 * AI operational triage and intelligence card component.
 */

import React from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, UserCheck, Sparkles } from "lucide-react";
import { AIMetadata } from "@/types";

export interface AISuggestionsCardProps {
  metadata?: AIMetadata | null;
  onApplyAssignee?: (userId: string) => void;
  isLoading?: boolean;
}

/**
 * Display AI triage suggestions, duplicate warnings, and recommended assignees.
 *
 * @param props - AI metadata and assignment handler
 * @returns JSX Element
 */
export function AISuggestionsCard({
  metadata,
  onApplyAssignee,
  isLoading,
}: AISuggestionsCardProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="bg-white border border-surface-deep rounded-xl p-6 shadow-sm animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-surface-deep rounded-full" />
          <div className="h-4 bg-surface-deep rounded w-32" />
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-surface-deep rounded w-full" />
          <div className="h-3 bg-surface-deep rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="bg-white border border-surface-deep rounded-xl p-6 shadow-sm text-center">
        <Bot className="w-8 h-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm font-medium text-text-secondary">
          AI Triage In Progress
        </p>
        <p className="text-xs text-text-muted mt-1">
          Background embedding and duplicate evaluation running.
        </p>
      </div>
    );
  }

  const duplicates = metadata.potential_duplicates || [];
  const assignees = metadata.recommended_assignees || [];
  const nextSteps = metadata.suggested_next_steps || [];

  return (
    <div className="bg-white border border-surface-deep rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-surface-deep pb-3">
        <div className="flex items-center gap-2 text-accent font-semibold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Operational Intelligence</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-surface-raised text-text-secondary font-mono">
          Gemini 3.1 Flash Lite
        </span>
      </div>

      {metadata.summary && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Executive Summary
          </h4>
          <p className="text-sm text-text-primary leading-relaxed bg-surface-raised/60 p-3 rounded-lg border border-surface-deep/50">
            {metadata.summary}
          </p>
        </div>
      )}

      {duplicates.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-amber-700 font-medium text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Potential Duplicate Items Detected ({duplicates.length})</span>
          </div>
          <div className="space-y-2">
            {duplicates.map((dup) => (
              <Link
                key={dup.item_id}
                href={`/items/${dup.item_id}`}
                className="block p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition-colors text-xs"
              >
                <div className="flex items-center justify-between font-medium text-text-primary">
                  <span className="truncate flex-1 mr-2">{dup.title}</span>
                  <span className="text-amber-800 font-mono flex-shrink-0">
                    {Math.round(dup.similarity_score * 100)}% match
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {assignees.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-text-muted font-semibold text-xs uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Recommended Assignees</span>
          </div>
          <div className="space-y-2">
            {assignees.map((rec) => (
              <div
                key={rec.user_id}
                className="p-3 rounded-lg border border-surface-deep bg-surface-raised/40 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">
                    {rec.display_name}
                  </div>
                  <p className="text-text-secondary mt-0.5 leading-snug">
                    {rec.reasoning}
                  </p>
                </div>
                {onApplyAssignee && (
                  <button
                    type="button"
                    onClick={() => onApplyAssignee(rec.user_id)}
                    className="px-2.5 py-1 bg-white border border-surface-deep hover:border-accent hover:text-accent font-medium rounded text-xs transition-colors flex-shrink-0 shadow-2xs"
                  >
                    Assign
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-text-muted font-semibold text-xs uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Suggested Action Items</span>
          </div>
          <ul className="space-y-1.5 text-xs text-text-secondary">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
