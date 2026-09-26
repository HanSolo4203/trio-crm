"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/lib/queryKeys";
import { fetchProfiles } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function profileName(profile: Profile | null | undefined) {
  const name = profile?.display_name?.trim();
  return name || "Unnamed teammate";
}

export function useProfilesMap() {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.profiles,
    queryFn: fetchProfiles,
  });

  const profiles = data ?? [];
  const profilesMap = useMemo(() => {
    return new Map((data ?? []).map((profile) => [profile.id, profile]));
  }, [data]);

  return { profiles, profilesMap, loading: isPending };
}
