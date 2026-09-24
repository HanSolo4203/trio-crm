"use client";

import { useEffect, useState } from "react";

export function initials(displayName: string | null | undefined, email?: string | null) {
  const name = displayName?.trim() ?? "";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }

  const mail = email?.trim() ?? "";
  if (mail) return mail.slice(0, 2).toUpperCase();
  return "?";
}

export function UserAvatar({
  displayName,
  email,
  avatarUrl,
  className,
  alt = "",
}: {
  displayName: string | null | undefined;
  email?: string | null;
  avatarUrl: string | null | undefined;
  className: string;
  alt?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(avatarUrl) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [avatarUrl]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl ?? undefined}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden={alt === "" ? true : undefined}>{initials(displayName, email)}</span>
      )}
    </span>
  );
}
