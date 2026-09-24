"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Snapshot = {
  profile: Profile | null;
  loading: boolean;
};

let snapshot: Snapshot = { profile: null, loading: true };
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function loadProfile() {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    snapshot = { profile: null, loading: false };
    emit();
    return;
  }

  const { data, error } = await supabase
    .from("crm_profiles")
    .select("id, display_name, avatar_url, role, created_at, updated_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  snapshot = {
    profile: error || !data ? null : (data as Profile),
    loading: false,
  };
  emit();
}

function ensureStarted() {
  if (started) return;
  started = true;
  void loadProfile();
  createClient().auth.onAuthStateChange(() => {
    void loadProfile();
  });
}

export function useProfile() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    ensureStarted();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, []);

  return { profile: snapshot.profile, loading: snapshot.loading, refresh };
}
