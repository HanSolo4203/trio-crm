import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AppShell>
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </AppShell>
  );
}

function PageHeading({ titleWidth, controls }: { titleWidth: string; controls: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        <div className={`mt-3 h-9 animate-pulse rounded bg-gray-200 ${titleWidth}`} />
      </div>
      {controls}
    </div>
  );
}

export function ContactsSkeleton() {
  return (
    <Frame label="Loading contacts">
      <PageHeading
        titleWidth="w-36"
        controls={
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-52" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-32" />
          </div>
        }
      />
      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line/60 bg-white shadow-card">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="border-b border-line px-4 py-4 last:border-b-0">
            <div className="h-4 w-2/5 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function DashboardSkeleton() {
  return (
    <Frame label="Loading dashboard">
      <PageHeading
        titleWidth="w-44"
        controls={<div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-52" />}
      />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 md:h-80" />
        ))}
      </div>
    </Frame>
  );
}

export function FollowupsSkeleton() {
  return (
    <Frame label="Loading follow-ups">
      <PageHeading
        titleWidth="w-40"
        controls={<div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-52" />}
      />
      <div className="mt-8 flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="mt-8 hidden overflow-hidden rounded-2xl border border-line/60 bg-white shadow-card md:block">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-5 items-center gap-4 border-b border-line px-4 py-4 last:border-b-0"
          >
            <div className="h-4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 animate-pulse rounded bg-gray-200" />
            <div className="col-span-2 h-4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="mt-8 h-14 animate-pulse rounded-2xl bg-gray-200" />
    </Frame>
  );
}

export function PipelineSkeleton() {
  return (
    <Frame label="Loading leads">
      <PageHeading
        titleWidth="w-28"
        controls={<div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-52" />}
      />
      <div className="mt-8 flex gap-4 overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, lane) => (
          <div key={lane} className="min-w-[85vw] shrink-0 rounded-2xl bg-gray-100 p-3 md:min-w-0">
            <div className="mx-1 h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, card) => (
                <div key={card} className="h-24 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function ContactSkeleton() {
  return (
    <Frame label="Loading contact">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="mt-4 h-8 w-3/5 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index}>
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
          <div className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
            <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-48 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      </div>
    </Frame>
  );
}

export function ContractorsSkeleton() {
  return (
    <Frame label="Loading contractors">
      <PageHeading
        titleWidth="w-44"
        controls={<div className="h-10 w-full animate-pulse rounded-lg bg-gray-200 md:w-36" />}
      />
      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="h-32 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </ul>
    </Frame>
  );
}

export function ContractorSkeleton() {
  return (
    <Frame label="Loading contractor">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <div className="h-8 w-3/5 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function SettingsSkeleton() {
  return (
    <Frame label="Loading settings">
      <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-9 w-36 animate-pulse rounded bg-gray-200" />
      <div className="mt-6 flex gap-3 border-b border-line pb-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6">
        <div className="space-y-5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-10 animate-pulse rounded-lg bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function LoginSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section
        aria-busy="true"
        aria-live="polite"
        className="w-full max-w-md rounded-2xl border border-line/60 bg-white shadow-card p-6 md:p-8"
      >
        <span className="sr-only">Loading sign in</span>
        <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
        <div className="mt-6 h-8 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded bg-gray-200" />
        <div className="mt-8 space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-11 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </section>
    </main>
  );
}
