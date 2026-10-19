"use client";

/**
 * Top-level application providers wrapping React Query and AuthContext.
 */

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { initializeEventSource } from "@/lib/sse";

export interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Composite provider establishing TanStack Query caching and real-time SSE listener.
 *
 * @param props - Component properties wrapping child DOM nodes
 * @returns JSX Element
 */
export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const [queryClient] = useState<QueryClient>(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const cleanup = initializeEventSource(queryClient);
    return () => {
      cleanup();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
