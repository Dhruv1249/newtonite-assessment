"use client";

/**
 * Filterable, paginated work items catalog page with hybrid and semantic search.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useItems, useSemanticSearch } from "@/hooks/use-items";
import { useTeams } from "@/hooks/use-teams";
import { StatusBadge, PriorityBadge } from "@/components/items/StatusBadge";
import {
  Filter,
  PlusCircle,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  User,
  Layers,
} from "lucide-react";

/**
 * Work items list view component.
 *
 * @returns JSX Element
 */
export default function WorkItemsPage(): React.JSX.Element {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSemanticMode, setIsSemanticMode] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const pageSize = 15;

  const { data: teamsData } = useTeams();

  const { data: standardItemsData, isLoading: itemsLoading } = useItems({
    teamId: selectedTeamId || undefined,
    status: selectedStatus || undefined,
    priority: selectedPriority || undefined,
    search: !isSemanticMode && searchQuery ? searchQuery : undefined,
    page: currentPage,
    pageSize,
  });

  const { data: semanticSearchData, isLoading: semanticLoading } = useSemanticSearch(
    isSemanticMode ? searchQuery : ""
  );

  const isSearchActive = isSemanticMode && searchQuery.trim().length >= 2;
  const currentItems = isSearchActive
    ? (semanticSearchData?.results || []).map((r) => r.item)
    : standardItemsData?.items || [];

  const totalCount = isSearchActive
    ? semanticSearchData?.total_results || 0
    : standardItemsData?.total_count || 0;

  const totalPages = isSearchActive ? 1 : standardItemsData?.total_pages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Work Items
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Operational issues, production incidents, and approval requests.
          </p>
        </div>
        <Link
          href="/items/new"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center gap-2 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Work Item</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-surface-deep p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isSemanticMode
                  ? "Describe issue by concept (e.g. 'gateway timeout under load')..."
                  : "Filter by title or keyword..."
              }
              className="w-full pl-9 pr-4 py-2 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsSemanticMode(!isSemanticMode)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
              isSemanticMode
                ? "bg-accent text-white border-accent shadow-2xs"
                : "bg-surface-raised text-text-secondary border-surface-deep hover:text-text-primary"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Semantic Vector Search</span>
          </button>
        </div>

        {!isSemanticMode && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-surface-deep/50 text-xs">
            <div className="flex items-center gap-1.5 text-text-muted">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setCurrentPage(0);
              }}
              className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-text-primary text-xs focus:outline-hidden"
            >
              <option value="">All Teams</option>
              {teamsData?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-text-primary text-xs focus:outline-hidden"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="blocked">Blocked</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(0);
              }}
              className="px-2.5 py-1.5 bg-surface-raised border border-surface-deep rounded-lg text-text-primary text-xs focus:outline-hidden"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {(selectedTeamId || selectedStatus || selectedPriority || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTeamId("");
                  setSelectedStatus("");
                  setSelectedPriority("");
                  setSearchQuery("");
                  setCurrentPage(0);
                }}
                className="text-2xs text-text-muted hover:text-rose-600 underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-surface-deep shadow-2xs overflow-hidden">
        {itemsLoading || semanticLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">
            Loading work items...
          </div>
        ) : currentItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-deep bg-surface-raised/50 text-text-muted text-2xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Title & Description</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-deep/60">
                {currentItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-raised/30 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-4 max-w-md">
                      <Link href={`/items/${item.id}`} className="block">
                        <div className="font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                          {item.title}
                        </div>
                        <div className="text-2xs text-text-muted line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-secondary whitespace-nowrap">
                      {item.team?.name || "Platform Engineering"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-secondary whitespace-nowrap">
                      {item.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-text-muted" />
                          <span>{item.assignee.display_name}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-2xs text-text-muted whitespace-nowrap">
                      v{item.version}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-text-muted">
            <Layers className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-60" />
            <p className="font-medium text-text-secondary">No work items found.</p>
            <p className="mt-1">Try adjusting your filters or search keywords.</p>
          </div>
        )}

        {!isSearchActive && totalPages > 1 && (
          <div className="px-4 py-3 bg-surface-raised/30 border-t border-surface-deep flex items-center justify-between text-xs text-text-secondary">
            <span>
              Page {currentPage + 1} of {totalPages} ({totalCount} total items)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-surface-deep bg-white hover:bg-surface-raised disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-surface-deep bg-white hover:bg-surface-raised disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
