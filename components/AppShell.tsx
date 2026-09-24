"use client";

import { useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="min-h-screen min-w-0 max-w-full overflow-x-clip md:pl-[234px]">
        <main className="mx-auto min-w-0 max-w-[1600px] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-10 md:py-8">
          {children}
        </main>
      </div>
    </>
  );
}
