"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { localDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Contacts" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/pipeline", label: "Leads" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/contacts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDueCount() {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("crm_tasks")
        .select("*", { count: "exact", head: true })
        .is("done_at", null)
        .lte("date", localDate());

      if (cancelled || error) return;
      setDueCount(count ?? 0);
    }

    loadDueCount();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[234px] flex-col bg-navy text-white">
      <div className="px-4 pt-6">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold tracking-wide text-mint"
        >
          DH
        </div>
      </div>

      <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/followups" && dueCount != null && dueCount > 0 ? (
                <span className="ml-auto min-w-5 rounded-full bg-mint px-1.5 text-center text-xs font-semibold tabular-nums text-navy">
                  {dueCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
