import { Suspense } from "react";

import { AppShell } from "@/components/AppShell";
import { Settings } from "@/components/Settings";

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-muted">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </AppShell>
  );
}
