"use client";

/**
 * Platform user directory and account administration page.
 * Supports provisioning, updating credentials, and safely deleting user accounts.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "@/hooks/use-teams";
import { User } from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Edit2,
  KeyRound,
  Mail,
  Plus,
  Shield,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
  X,
} from "lucide-react";

/**
 * Platform user directory and administration page component.
 *
 * @returns JSX Element
 */
export default function UsersDirectoryPage(): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editPassword, setEditPassword] = useState<string>("");

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    isError?: boolean;
  } | null>(null);

  const showNotification = (message: string, isError = false): void => {
    setNotification({ message, isError });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await createUserMutation.mutateAsync({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      showNotification(`User account for ${displayName} created successfully.`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setIsCreating(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create user.";
      showNotification(errorMsg, true);
    }
  };

  const handleStartEdit = (targetUser: User): void => {
    setEditingUser(targetUser);
    setEditDisplayName(targetUser.display_name);
    setEditEmail(targetUser.email);
    setEditPassword("");
  };

  const handleUpdateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUserMutation.mutateAsync({
        userId: editingUser.id,
        display_name: editDisplayName.trim() || undefined,
        email: editEmail.trim() || undefined,
        password: editPassword.trim() || undefined,
      });
      showNotification(
        `User account for ${editDisplayName} updated successfully.`
      );
      setEditingUser(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update user.";
      showNotification(errorMsg, true);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingUser) return;
    try {
      await deleteUserMutation.mutateAsync(deletingUser.id);
      showNotification(`User ${deletingUser.display_name} deleted successfully.`);
      setDeletingUser(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete user.";
      showNotification(errorMsg, true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            User Directory & Administration
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Registered accounts across OpFlow. Manage account credentials, edit profiles, or remove obsolete accounts.
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

      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            notification.isError
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {notification.isError ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {isCreating && (
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-text-primary pb-3 border-b border-surface-deep/60">
            <UserIcon className="w-4 h-4 text-accent" />
            <span>Register New User Profile</span>
          </div>

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
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div
                  key={u.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-raised/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text-primary truncate">
                          {u.display_name}
                        </span>
                        {isSelf && (
                          <span className="text-3xs px-2 py-0.5 rounded-full bg-accent-light text-accent font-bold border border-accent/20 uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                    <div className="hidden md:block text-right pr-2">
                      <div className="text-2xs text-text-muted font-mono">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-3xs text-text-muted font-mono truncate max-w-[130px]">
                        {u.id}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(u)}
                        className="px-3 py-1.5 rounded-lg border border-surface-deep bg-white hover:bg-surface-raised hover:text-accent text-text-secondary text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setDeletingUser(u)}
                        title={isSelf ? "You cannot delete your own active account" : "Delete user account"}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-text-muted">
            No registered users found.
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl border border-surface-deep p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-deep">
              <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                <Edit2 className="w-4 h-4 text-accent" />
                <span>Edit User: {editingUser.display_name}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
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
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  New Password (Optional)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave empty to retain existing password..."
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs disabled:opacity-50"
                >
                  {updateUserMutation.isPending ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl border border-surface-deep p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-primary">Confirm User Account Deletion</h3>
                <p className="text-xs text-text-secondary">This operational action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed bg-surface/50 p-3 rounded-xl border border-surface-deep">
              Are you sure you want to delete user account <strong className="text-text-primary">{deletingUser.display_name}</strong> (<span className="font-mono text-2xs">{deletingUser.email}</span>)? Authored work items, comments, and audit logs will be reassigned to the administrator to maintain platform auditability.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteUserMutation.isPending}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
