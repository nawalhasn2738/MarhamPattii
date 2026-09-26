"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRequest } from "@/context/RequestContext";
import type { UserRole } from "@/lib/session";

export function RoleGuard({ children, role }: { children: React.ReactNode; role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, hydrated } = useRequest();

  useEffect(() => {
    if (!hydrated) return;
    if (state.role === role) return;
    router.replace(`/?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, pathname, role, router, state.role]);

  if (!hydrated || state.role !== role) return null;
  return <>{children}</>;
}