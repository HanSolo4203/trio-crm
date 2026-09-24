"use client";

import { CalendarClock, GitBranch, LayoutDashboard, Search, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { localDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

const NAV: readonly {
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Contacts", icon: Users },
  { href: "/followups", label: "Follow-ups", icon: CalendarClock },
  { href: "/pipeline", label: "Leads", icon: GitBranch },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/contacts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
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

  const showDue = dueCount != null && dueCount > 0;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold tracking-wide text-mint"
          >
            DH
          </div>
          <p className="truncate text-sm font-semibold">Dylan&apos;s CRM</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Search aria-hidden="true" size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-compact inline-flex shrink-0 items-center rounded-lg px-2 text-sm font-medium text-white/80 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-navy md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-tight ${
                  active ? "text-mint" : "text-white/70"
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                  {item.href === "/followups" && showDue ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mint px-1 text-[10px] font-semibold tabular-nums leading-none text-navy">
                      {dueCount > 9 ? "9+" : dueCount}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[234px] flex-col bg-navy text-white md:flex">
        <div className="px-4 pt-6">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold tracking-wide text-mint"
          >
            DH
          </div>
        </div>

        <div className="px-3 pt-6">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-keyshortcuts="Meta+K Control+K"
            className="flex w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Search aria-hidden="true" size={16} strokeWidth={1.75} />
            <span className="flex-1">Search</span>
            <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white/50">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav aria-label="Primary" className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
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
                {item.href === "/followups" && showDue ? (
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
    </>
  );
}
