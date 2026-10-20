"use client";

/**
 * Semantic vector search page for finding similar work items using AI-powered embeddings.
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSemanticSearch } from "@/hooks/use-items";
import { StatusBadge, PriorityBadge } from "@/components/items/StatusBadge";
import { Search, Sparkles, ArrowRight, Clock } from "lucide-react";

/**
 * AI-powered semantic search page component.
 *
 * Executes natural language queries against work item embeddings using
 * cosine vector similarity, returning ranked results by relevance score.
 *
 * @returns JSX Element
 */
export default function SearchPage(): React.JSX.Element {
  const [inputValue, setInputValue] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: searchResults, isFetching, isError } = useSemanticSearch(debouncedQuery);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Semantic Search
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Natural language search across all work items using AI vector embeddings. Results ranked by semantic similarity.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="text"
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe the work you are looking for... (e.g. payment gateway timeout, customer refund escalation)"
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-surface-deep rounded-2xl text-sm text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent transition-colors shadow-2xs"
        />
        {isFetching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        )}
      </div>

      {debouncedQuery.trim().length >= 2 && !isFetching && !isError && searchResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>
                {searchResults.total_results} result{searchResults.total_results !== 1 ? "s" : ""} for
                <span className="font-semibold text-text-primary ml-1">
                  &quot;{searchResults.query}&quot;
                </span>
              </span>
            </div>
            <span className="text-2xs text-text-muted font-mono">cosine similarity</span>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-surface-deep shadow-2xs">
              <Search className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-text-primary">No matching work items found</p>
              <p className="text-xs text-text-secondary mt-1">
                Try rephrasing your query or searching for different terms.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.results.map((result) => {
                const similarityPercent = Math.round(result.similarity_score * 100);
                return (
                  <Link
                    key={result.item.id}
                    href={`/items/${result.item.id}`}
                    className="block bg-white rounded-xl border border-surface-deep p-4 hover:border-accent/40 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={result.item.status} />
                          <PriorityBadge priority={result.item.priority} />
                          {result.item.team_name && (
                            <span className="text-2xs text-text-muted font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-surface-deep">
                              {result.item.team_name}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-text-primary group-hover:text-accent transition-colors truncate">
                          {result.item.title}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-2">
                          {result.item.description}
                        </p>
                        <div className="flex items-center gap-3 text-2xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(result.item.updated_at).toLocaleDateString()}
                          </span>
                          {result.item.assignee && (
                            <span>Assignee: {result.item.assignee.display_name}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-surface-deep overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{ width: `${similarityPercent}%` }}
                            />
                          </div>
                          <span className="text-2xs font-mono font-semibold text-accent">
                            {similarityPercent}%
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {debouncedQuery.trim().length === 0 && (
        <div className="py-20 text-center">
          <Sparkles className="w-12 h-12 text-accent/40 mx-auto mb-4" />
          <p className="text-sm font-medium text-text-secondary">
            Enter a natural language query to search across all work items.
          </p>
          <p className="text-xs text-text-muted mt-1.5 max-w-sm mx-auto">
            Semantic search understands meaning, not just keywords. Try describing the problem, not the exact title.
          </p>
        </div>
      )}

      {isError && debouncedQuery.length >= 2 && (
        <div className="py-10 text-center text-xs text-red-600 bg-red-50 rounded-2xl border border-red-200">
          Search request failed. Check your connection and try again.
        </div>
      )}
    </div>
  );
}
