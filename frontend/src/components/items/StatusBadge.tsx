"use client";

/**
 * Status and priority badge components styled with the OpFlow palette.
 */

import React from "react";

export interface StatusBadgeProps {
  status: string;
}

/**
 * Render a color-coded status badge for work item states.
 *
 * @param props - Status identifier
 * @returns JSX Element
 */
export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const normalized = status.toLowerCase();

  let colorClasses = "bg-surface-raised text-text-primary border-surface-deep";
  if (normalized === "open") {
    colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (normalized === "in_progress") {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (normalized === "in_review") {
    colorClasses = "bg-purple-50 text-purple-700 border-purple-200";
  } else if (normalized === "blocked") {
    colorClasses = "bg-red-50 text-red-700 border-red-200";
  } else if (normalized === "resolved") {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (normalized === "closed") {
    colorClasses = "bg-gray-100 text-gray-700 border-gray-200";
  } else if (normalized === "cancelled") {
    colorClasses = "bg-zinc-100 text-zinc-600 border-zinc-200";
  }

  const formatted = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
    >
      {formatted}
    </span>
  );
}

export interface PriorityBadgeProps {
  priority: string;
}

/**
 * Render a color-coded badge indicating work item priority.
 *
 * @param props - Priority identifier
 * @returns JSX Element
 */
export function PriorityBadge({ priority }: PriorityBadgeProps): React.JSX.Element {
  const normalized = priority.toLowerCase();

  let colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
  if (normalized === "critical") {
    colorClasses = "bg-rose-100 text-rose-800 border-rose-300 font-semibold";
  } else if (normalized === "high") {
    colorClasses = "bg-orange-50 text-orange-700 border-orange-200";
  } else if (normalized === "medium") {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (normalized === "low") {
    colorClasses = "bg-slate-50 text-slate-600 border-slate-200";
  }

  const formatted = priority.toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses}`}
    >
      {formatted}
    </span>
  );
}
