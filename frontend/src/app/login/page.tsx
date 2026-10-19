"use client";

/**
 * Authentication login page with one-click evaluator persona presets.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Lock, Mail, User, Shield, AlertCircle, ArrowRight } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@opflow.internal",
    name: "Alex Admin",
    description: "Full access across all teams, workflows, and settings.",
  },
  {
    role: "Lead",
    email: "lead@opflow.internal",
    name: "Devin Lead",
    description: "Can assign tasks, approve workflow reviews, and triage.",
  },
  {
    role: "Member",
    email: "engineer@opflow.internal",
    name: "Eli Engineer",
    description: "Can create items, edit assigned work, submit reviews.",
  },
  {
    role: "Viewer",
    email: "auditor@opflow.internal",
    name: "Val Viewer",
    description: "Read-only access across items and activity logs.",
  },
];

/**
 * Login page component.
 *
 * @returns JSX Element
 */
export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Authentication failed. Please verify credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string): Promise<void> => {
    setEmail(demoEmail);
    setPassword("password123");
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await login(demoEmail, "password123");
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="bg-white rounded-2xl border border-surface-deep p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">Sign in to OpFlow</h1>
            <p className="text-sm text-text-secondary mt-1">
              Operational work coordination and management.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface/50 border border-surface-deep rounded-xl text-sm text-text-primary focus:outline-hidden focus:border-accent focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-text-secondary">
            Need an account?{" "}
            <Link href="/register" className="text-accent font-semibold hover:underline">
              Register here
            </Link>
          </div>
        </div>

        <div className="bg-surface-raised/60 border border-surface-deep rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
            <Shield className="w-4 h-4 text-accent" />
            <span>One-Click Evaluator Personas</span>
          </div>
          <p className="text-xs text-text-secondary">
            Quickly test authorization boundaries, role-gated approvals, and team isolation.
          </p>

          <div className="space-y-2.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleQuickLogin(account.email)}
                className="w-full text-left p-3.5 bg-white border border-surface-deep hover:border-accent rounded-xl transition-all shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm text-text-primary group-hover:text-accent transition-colors flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-text-muted" />
                    <span>{account.name}</span>
                  </div>
                  <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded-full bg-accent-light text-accent">
                    {account.role}
                  </span>
                </div>
                <p className="text-2xs text-text-secondary line-clamp-1">
                  {account.description}
                </p>
                <span className="text-2xs text-text-muted font-mono mt-1 block">
                  {account.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
