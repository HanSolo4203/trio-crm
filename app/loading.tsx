"use client";

import { usePathname } from "next/navigation";

import {
  ContactSkeleton,
  ContractorSkeleton,
  ContractorsSkeleton,
  PropertiesSkeleton,
  ContactsSkeleton,
  DashboardSkeleton,
  FollowupsSkeleton,
  LoginSkeleton,
  PipelineSkeleton,
  SettingsSkeleton,
} from "@/components/RouteSkeletons";

export default function Loading() {
  const pathname = usePathname();

  if (pathname.startsWith("/dashboard")) return <DashboardSkeleton />;
  if (pathname.startsWith("/followups")) return <FollowupsSkeleton />;
  if (pathname.startsWith("/pipeline")) return <PipelineSkeleton />;
  if (pathname.startsWith("/contacts/")) return <ContactSkeleton />;
  if (/^\/contractors\/.+/.test(pathname)) return <ContractorSkeleton />;
  if (pathname.startsWith("/properties")) return <PropertiesSkeleton />;
  if (pathname.startsWith("/contractors")) return <ContractorsSkeleton />;
  if (pathname.startsWith("/settings")) return <SettingsSkeleton />;
  if (pathname.startsWith("/login")) return <LoginSkeleton />;
  return <ContactsSkeleton />;
}
