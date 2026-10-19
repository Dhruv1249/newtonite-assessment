"use client";

/**
 * Main operational dashboard page.
 */

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useDashboardStats, useTeams } from "@/hooks/use-teams";
import { useItems } from "@/hooks/use-items";
import { StatusBadge, PriorityBadge } from "@/components/items/StatusBadge";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  PlusCircle,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

/**
 * Operational dashboard page component.
 *
 * @returns JSX Element
 */
export default function DashboardPage(): React.JSX.Element {
  const { user, isLoading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: teamsData, isLoading: teamsLoading } = useTeams();

  const { data: myItemsData, isLoading: myItemsLoading } = useItems({
    assigneeId: user?.id,
    pageSize: 5,
  });

  const { data: urgentItemsData, isLoading: urgentItemsLoading } = useItems({
    priority: "critical",
    pageSize: 5,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-surface-deep shadow-sm p-8 max-w-2xl mx-auto">
        <Layers className="w-12 h-12 text-accent mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-text-primary">Welcome to OpFlow</h1>
        <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
          Operational work management and coordination under pressure.
          Sign in with one of the pre-seeded evaluator accounts to begin.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            Sign In with Demo Persona
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Operational Overview
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Coordination and workflow intelligence across your active teams.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/items/new"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Work Item</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-surface-deep rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Items</span>
            <Layers className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-3xl font-extrabold text-text-primary font-mono">
            {statsLoading ? "..." : stats?.total_active_items || 0}
          </div>
          <p className="text-2xs text-text-secondary mt-1">Open or in-progress</p>
        </div>

        <div className="bg-white border border-surface-deep rounded-2xl p-5 shadow-2xs border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Needs Attention</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-rose-700 font-mono">
            {statsLoading ? "..." : stats?.critical_items_count || 0}
          </div>
          <p className="text-2xs text-text-secondary mt-1">Critical severity</p>
        </div>

        <div className="bg-white border border-surface-deep rounded-2xl p-5 shadow-2xs border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between text-purple-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Awaiting Review</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-extrabold text-purple-700 font-mono">
            {statsLoading ? "..." : stats?.in_review_items_count || 0}
          </div>
          <p className="text-2xs text-text-secondary mt-1">Review gates pending</p>
        </div>

        <div className="bg-white border border-surface-deep rounded-2xl p-5 shadow-2xs border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Unassigned</span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-700 font-mono">
            {statsLoading ? "..." : stats?.unassigned_items_count || 0}
          </div>
          <p className="text-2xs text-text-secondary mt-1">Ready for triage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Requires Urgent Attention</span>
            </h2>
            <Link
              href="/items?priority=critical"
              className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentItemsLoading ? (
            <div className="py-8 text-center text-xs text-text-muted">Loading urgent work...</div>
          ) : urgentItemsData && urgentItemsData.items.length > 0 ? (
            <div className="space-y-3">
              {urgentItemsData.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="block p-3.5 rounded-xl border border-surface-deep bg-surface-raised/40 hover:bg-surface-raised transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-text-primary group-hover:text-accent transition-colors truncate mr-2">
                      {item.title}
                    </span>
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="truncate max-w-[200px]">
                      {item.team?.name || "Platform Engineering"}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-text-muted border border-dashed border-surface-deep rounded-xl">
              No critical priority items pending.
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              <span>Assigned to You</span>
            </h2>
            <Link
              href={`/items?assignee_id=${user.id}`}
              className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {myItemsLoading ? (
            <div className="py-8 text-center text-xs text-text-muted">Loading your work...</div>
          ) : myItemsData && myItemsData.items.length > 0 ? (
            <div className="space-y-3">
              {myItemsData.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="block p-3.5 rounded-xl border border-surface-deep bg-surface-raised/40 hover:bg-surface-raised transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-text-primary group-hover:text-accent transition-colors truncate mr-2">
                      {item.title}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="truncate max-w-[200px]">
                      {item.team?.name || "Platform Engineering"}
                    </span>
                    <PriorityBadge priority={item.priority} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-text-muted border border-dashed border-surface-deep rounded-xl">
              You have no active work items assigned.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-deep p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-text-primary font-bold text-base">
            <Users className="w-5 h-5 text-accent" />
            <span>Your Operational Teams</span>
          </div>
          <span className="text-xs text-text-muted">
            {teamsData?.length || 0} teams enrolled
          </span>
        </div>

        {teamsLoading ? (
          <div className="py-6 text-center text-xs text-text-muted">Loading teams...</div>
        ) : teamsData && teamsData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teamsData.map((team) => (
              <div
                key={team.id}
                className="p-4 rounded-xl border border-surface-deep bg-surface-raised/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-sm text-text-primary">{team.name}</h3>
                    <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-raised border border-surface-deep text-text-secondary uppercase">
                      {team.user_role}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                    {team.description}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-deep/60 text-2xs">
                  <span className="text-text-muted">{team.member_count} members</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/teams/${team.id}`}
                      className="text-accent hover:underline font-medium"
                    >
                      Roster
                    </Link>
                    <span className="text-surface-deep">•</span>
                    <Link
                      href={`/teams/${team.id}/workflow`}
                      className="text-text-secondary hover:text-text-primary font-medium"
                    >
                      Workflow
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-text-muted">
            You are not enrolled in any teams yet.
          </div>
        )}
      </div>
    </div>
  );
}
