"use client";

import {
  Building2,
  CalendarClock,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { UserAvatar } from "@/components/UserAvatar";
import { localDate } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { fetchTasks } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";

const NAV: readonly {
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Contacts", icon: Users },
  { href: "/followups", label: "Follow-ups", icon: CalendarClock },
  { href: "/pipeline", label: "Leads", icon: GitBranch },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/contractors", label: "Contractors", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/contacts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const { data: tasks } = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: fetchTasks,
  });

  const today = localDate();
  const dueCount =
    tasks == null
      ? null
      : tasks.filter((task) => {
          if (task.assigned_to !== profile?.id) return false;
        if (task.done_at != null) return false;
          const date = task.date?.trim() ?? "";
          return date !== "" && date <= today;
        }).length;

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
  const displayName = profile?.display_name?.trim() || "Account";

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-ink md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar
            displayName={profile?.display_name}
            avatarUrl={profile?.avatar_url}
            className="h-8 w-8 bg-navy text-xs text-mint"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">Trio CRM</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-ink"
          >
            <Search aria-hidden="true" size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={signingOut ? "Signing out" : "Sign out"}
            className="btn-compact inline-flex shrink-0 items-center rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white md:hidden"
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
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <span
                  className={`relative rounded-lg px-2 py-0.5 ${active ? "bg-line" : ""}`}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                  {item.href === "/followups" && showDue ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold tabular-nums leading-none text-white">
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

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[234px] flex-col border-r border-line bg-white text-ink md:flex">
        <div className="flex items-center gap-2.5 px-4 pt-5">
          <UserAvatar
            displayName={profile?.display_name}
            avatarUrl={profile?.avatar_url}
            className="h-8 w-8 bg-navy text-xs text-mint"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">Trio CRM</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out" : "Sign out"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-3 pt-5">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-keyshortcuts="Meta+K Control+K"
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-page px-3 py-2 text-left text-sm text-muted transition-colors hover:text-ink"
          >
            <Search aria-hidden="true" size={16} strokeWidth={1.75} />
            <span className="flex-1">Search</span>
            <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px] font-medium text-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav aria-label="Primary" className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-line text-ink" : "text-muted hover:bg-page hover:text-ink"
                }`}
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.href === "/followups" && showDue ? (
                  <span className="ml-auto min-w-5 rounded-full bg-navy px-1.5 text-center text-xs font-semibold tabular-nums text-white">
                    {dueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
