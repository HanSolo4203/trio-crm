"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";

import { UserAvatar } from "@/components/UserAvatar";
import type { AdminUser, Role } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

const secondaryButtonClass =
  "btn-compact inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";

function personLabel(user: AdminUser) {
  return user.display_name?.trim() || user.email || "this user";
}

async function apiError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `Request failed (${response.status}).`;
}

export function SettingsUsers() {
  const emailId = useId();
  const roleId = useId();
  const { refresh } = useProfile();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    if (!response.ok) {
      throw new Error(await apiError(response));
    }
    const body = (await response.json()) as { users: AdminUser[] };
    setUsers(body.users);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadUsers()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load users.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadUsers]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      setEmail("");
      setRole("member");
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRole(user: AdminUser) {
    const next: Role = user.role === "admin" ? "member" : "admin";
    setBusyId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      await Promise.all([loadUsers(), refresh()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(user: AdminUser) {
    const label = personLabel(user);
    if (!window.confirm(`Remove ${label}? Their login is deleted. Contacts and notes stay in the CRM.`)) {
      return;
    }

    setBusyId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that user.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold text-navy">Users</h2>
      <form onSubmit={handleInvite} className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div>
          <label htmlFor={emailId} className="text-sm font-medium text-ink">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={controlClass}
          />
        </div>
        <div>
          <label htmlFor={roleId} className="text-sm font-medium text-ink">
            Role
          </label>
          <select
            id={roleId}
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className={controlClass}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={inviting}
          className="btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inviting ? "Inviting…" : "Invite user"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading users…</p>
      ) : (
        <div className="-mx-6 mt-6 overflow-x-auto px-6">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const busy = busyId === user.id;
                const name = user.display_name?.trim() || "No name yet";
                return (
                  <tr key={user.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          displayName={user.display_name}
                          email={user.email}
                          avatarUrl={user.avatar_url}
                          alt=""
                          className="h-8 w-8 bg-navy text-xs text-mint"
                        />
                        <span className="font-medium text-ink">{name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-ink">{user.email ?? "—"}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={
                          user.role === "admin"
                            ? "inline-flex rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white"
                            : "inline-flex rounded-full bg-[#e8edf4] px-2.5 py-1 text-xs font-semibold text-muted"
                        }
                      >
                        {user.role === "admin" ? "Admin" : user.role === "member" ? "Member" : "No profile"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy || !user.role}
                          onClick={() => {
                            void handleRole(user);
                          }}
                          className={secondaryButtonClass}
                        >
                          {user.role === "admin" ? "Make member" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void handleRemove(user);
                          }}
                          className="btn-compact inline-flex items-center justify-center rounded-lg border border-danger/30 bg-white px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 ? <p className="mt-4 text-sm text-muted">No users yet.</p> : null}
        </div>
      )}
    </section>
  );
}
