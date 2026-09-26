"use client";

import { RecorderProvider } from "@/context/RecorderContext";
import { RequestProvider } from "@/context/RequestContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RequestProvider>
      <RecorderProvider>{children}</RecorderProvider>
    </RequestProvider>
  );
}
