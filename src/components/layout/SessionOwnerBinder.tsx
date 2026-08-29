"use client";

import { useEffect } from "react";
import { bindSessionOwner } from "@/features/home/last-snapshot";

export function SessionOwnerBinder({ userId }: { userId: string }) {
  useEffect(() => {
    bindSessionOwner(userId);
  }, [userId]);
  return null;
}
