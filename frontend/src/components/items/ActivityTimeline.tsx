"use client";

/**
 * Historical activity timeline component rendering immutable audit trail entries.
 */

import React from "react";
import { ActivityLog } from "@/types";
import { StatusBadge } from "@/components/items/StatusBadge";
import { Clock, User } from "lucide-react";

export interface ActivityTimelineProps {
  logs: ActivityLog[];
  isLoading?: boolean;
}

/**
 * Render chronological activity log entries for a work item.
 *
 * @param props - Activity log entries and loading state
 * @returns JSX Element
 */
export function ActivityTimeline({
  logs,
  isLoading,
}: ActivityTimelineProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-deep flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-deep rounded w-1/3" />
              <div className="h-3 bg-surface-deep rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No recorded activity yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-deep">
      {logs.map((log) => {
        const date = new Date(log.created_at);
        const formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={log.id} className="relative group">
            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-white shadow-2xs" />
            <div className="bg-white border border-surface-deep rounded-lg p-3 shadow-2xs hover:border-surface-raised transition-colors">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                <div className="flex items-center gap-1.5 font-medium text-text-primary">
                  <User className="w-3.5 h-3.5 text-text-muted" />
                  <span>{log.actor?.display_name || "System"}</span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{formattedDate}</span>
                </div>
              </div>

              {log.action_type === "created" && (
                <p className="text-xs text-text-secondary">
                  Created work item in status{" "}
                  <StatusBadge status={(log.new_value?.status as string) || "open"} />
                </p>
              )}

              {log.action_type === "status_transition" && (
                <div className="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
                  <span>Transitioned state from</span>
                  <StatusBadge status={(log.old_value?.status as string) || "unknown"} />
                  <span>to</span>
                  <StatusBadge status={(log.new_value?.status as string) || "unknown"} />
                </div>
              )}

              {log.action_type === "reassigned" && (
                <p className="text-xs text-text-secondary">
                  Reassigned responsibility
                </p>
              )}

              {log.action_type === "updated" && (
                <p className="text-xs text-text-secondary">
                  Updated work item details
                </p>
              )}

              {log.action_type === "comment_added" && (
                <p className="text-xs text-text-secondary italic">
                  Added a discussion comment
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
