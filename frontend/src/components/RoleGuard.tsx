"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRequest } from "@/context/RequestContext";
import { currentProviderSession } from "@/lib/supabaseBrowser";
import type { UserRole } from "@/lib/session";

export function RoleGuard({ children, role }: { children: React.ReactNode; role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, hydrated, logout } = useRequest();
  const [providerVerified, setProviderVerified] = useState(role !== "provider");

  useEffect(() => {
    if (!hydrated) return;
    if (state.role !== role) {
      router.replace(`/?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (role !== "provider") return;

    let active = true;
    void currentProviderSession()
      .then((session) => {
        if (!active) return;
        if (session) setProviderVerified(true);
      })
      .catch(() => {
        if (!active) return;
        logout();
        router.replace(`/?next=${encodeURIComponent(pathname)}`);
      });

    return () => {
      active = false;
    };
  }, [hydrated, logout, pathname, role, router, state.role]);

  if (!hydrated || state.role !== role || (role === "provider" && !providerVerified)) return null;
  return <>{children}</>;
}
