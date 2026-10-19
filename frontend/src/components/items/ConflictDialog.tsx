"use client";

/**
 * Modal dialog for alerting users to optimistic concurrency update collisions.
 */

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  errorMessage?: string;
}

/**
 * Modal prompt presented when a 409 Conflict error occurs due to concurrent updates.
 *
 * @param props - Dialog controls and callback handlers
 * @returns JSX Element or null if closed
 */
export function ConflictDialog({
  isOpen,
  onClose,
  onRefresh,
  errorMessage,
}: ConflictDialogProps): React.JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-red-200 p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600 flex-shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary">
              Concurrent Modification Conflict
            </h3>
            <p className="text-sm text-text-secondary mt-2">
              {errorMessage ||
                "Another team member modified this work item while you were working on it. To prevent overwriting their changes, the server rejected this update."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Latest State
          </button>
        </div>
      </div>
    </div>
  );
}
