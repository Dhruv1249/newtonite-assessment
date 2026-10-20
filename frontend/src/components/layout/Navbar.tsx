"use client";

/**
 * Global application navigation header with quick evaluator persona switcher.
 */

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  Layers,
  LayoutDashboard,
  PlusCircle,
  Users,
  LogOut,
  Radio,
  ChevronDown,
  Search,
  GitBranch,
} from "lucide-react";

const DEMO_PERSONAS = [
  { email: "admin@opflow.internal", name: "Alex Admin", role: "Admin" },
  { email: "lead@opflow.internal", name: "Devin Lead", role: "Lead" },
  { email: "engineer@opflow.internal", name: "Eli Engineer", role: "Member" },
  { email: "auditor@opflow.internal", name: "Val Viewer", role: "Viewer" },
];

/**
 * Global navigation header component.
 *
 * @returns JSX Element
 */
export function Navbar(): React.JSX.Element {
  const pathname = usePathname();
  const { user, logout, login } = useAuth();
  const [isPersonaOpen, setIsPersonaOpen] = useState<boolean>(false);

  const isActive = (path: string): boolean => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const handleSwitchPersona = async (email: string): Promise<void> => {
    try {
      await login(email, "password123");
      setIsPersonaOpen(false);
    } catch {
      setIsPersonaOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-surface-deep">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-text-primary tracking-tight">
                OpFlow
              </span>
              <span className="hidden sm:inline-block text-2xs text-text-muted font-medium ml-2 px-1.5 py-0.5 rounded bg-surface-raised border border-surface-deep">
                Newtonite
              </span>
            </div>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/items"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/items")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Work Items</span>
              </Link>
              <Link
                href="/items/new"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-accent" />
                <span>New Item</span>
              </Link>
              <Link
                href="/search"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/search")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                <Search className="w-4 h-4" />
                <span>AI Search</span>
              </Link>
              <Link
                href="/workflows"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/workflows")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                <GitBranch className="w-4 h-4" />
                <span>Workflows</span>
              </Link>
              <Link
                href="/users"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/users")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Users</span>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted px-2.5 py-1 rounded-full bg-surface-raised border border-surface-deep">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>SSE Live</span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPersonaOpen(!isPersonaOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-surface-deep hover:border-accent/40 text-xs text-text-primary font-medium transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span>{user.display_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                </button>

                {isPersonaOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-surface-deep p-2 z-50">
                    <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                      Switch Role for Testing
                    </div>
                    {DEMO_PERSONAS.map((p) => (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => handleSwitchPersona(p.email)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.email === p.email
                            ? "bg-accent/10 text-accent font-semibold"
                            : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-2xs text-text-muted">{p.email}</div>
                        </div>
                        <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-deep/50 text-text-secondary">
                          {p.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-lg text-text-muted hover:text-rose-600 hover:bg-surface-raised transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors shadow-2xs"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
