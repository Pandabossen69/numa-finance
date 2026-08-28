"use client";

import { useLayoutEffect } from "react";
import { rememberSessionIdentity } from "@/features/home/last-snapshot";

/** Sync the signed-in profile into last-known so Hem cannot greet the previous user. */
export function BindLastKnownUser({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  useLayoutEffect(() => {
    rememberSessionIdentity(userId, displayName);
  }, [userId, displayName]);
  return null;
}
