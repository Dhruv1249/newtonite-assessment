"use client";

/**
 * Platform user directory and account creation page.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useUsers, useCreateUser } from "@/hooks/use-teams";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  KeyRound,
  Mail,
  Plus,
  Shield,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react";

/**
 * Platform user directory and registration page component.
 *
 * @returns JSX Element
 */
export default function UsersDirectoryPage(): React.JSX.Element {
  const { data: users, isLoading } = useUsers();
  const createUserMutation = useCreateUser();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await createUserMutation.mutateAsync({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      setSuccessMessage(`User account for ${displayName} created successfully.`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setIsCreating(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      // error surfaced via createUserMutation.error
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            User Directory
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            All registered users across the operational platform. Add team members or provision accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreating ? "Close Form" : "Create New User"}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {isCreating && (
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-text-primary pb-3 border-b border-surface-deep/60">
            <UserIcon className="w-4 h-4 text-accent" />
            <span>Register New User Profile</span>
          </div>

          {createUserMutation.isError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{createUserMutation.error?.message || "Failed to create user."}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jordan River"
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan@opflow.internal"
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Initial Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
                className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-50"
              >
                <span>{createUserMutation.isPending ? "Creating..." : "Save User Account"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-surface-deep bg-surface-raised/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <UsersIcon className="w-4 h-4 text-accent" />
            <span>Registered Accounts ({users?.length || 0})</span>
          </div>
          <span className="text-2xs text-text-muted font-mono">Platform Roster</span>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
          </div>
        ) : users && users.length > 0 ? (
          <div className="divide-y divide-surface-deep/60">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-surface-raised/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {u.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-text-primary truncate">
                      {u.display_name}
                    </div>
                    <div className="text-xs text-text-muted flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  <div className="hidden sm:block">
                    <div className="text-2xs text-text-muted font-mono">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-3xs text-text-muted font-mono truncate max-w-[150px]">
                      {u.id}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-text-muted">
            No registered users found.
          </div>
        )}
      </div>
    </div>
  );
}
