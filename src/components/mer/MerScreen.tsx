"use client";

import { useEffect } from "react";
import { ArrowLeftRight, Settings, Wallet } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  MerAvatar,
  MerListGroup,
  MerListLink,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { Icon } from "@/components/ui/Icon";
import { MerViewLoading } from "@/components/mer/MerViewLoading";
import {
  ensurePaintableMerSnapshot,
  lastMerSnapshot,
  rememberMerSnapshot,
} from "@/features/home/last-snapshot";
import { DestinationWarmup } from "@/lib/nav/prefetch-intent";

export const MER_WARM_HREFS = ["/konton", "/transaktioner", "/installningar"] as const;

export function MerScreen({
  data,
}: {
  data: { userId: string; displayName: string | null; isAdmin: boolean } | null;
}) {
  useEffect(() => {
    if (data) rememberMerSnapshot(data);
  }, [data]);

  const view = data ?? lastMerSnapshot() ?? ensurePaintableMerSnapshot();

  if (!view) return <MerViewLoading />;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6">
      <DestinationWarmup hrefs={MER_WARM_HREFS} />
      <MerPageHeader
        title="Mer"
        description={
          view.displayName ? `Inloggad som ${view.displayName}` : "Inloggad"
        }
      />

      <nav className="animate-rise-delay-1" aria-label="Mer-meny">
        <MerListGroup>
          <MerListLink
            href="/konton"
            label="Konton"
            icon={<Icon icon={Wallet} />}
          />
          <MerListLink
            href="/transaktioner"
            label="Rörelser"
            icon={<Icon icon={ArrowLeftRight} />}
          />
          <MerListLink
            href="/installningar"
            label="Inställningar"
            icon={<Icon icon={Settings} />}
          />
        </MerListGroup>

        <MerSection title="Konto" className="mt-6">
          <MerListGroup>
            <div className="flex min-h-11 items-center gap-3 border-b border-[var(--numa-border)] px-4 py-3">
              <MerAvatar
                initial={(view.displayName ?? "·").charAt(0).toUpperCase()}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
                {view.displayName ?? "Inloggad"}
              </span>
            </div>
            <div className="px-2 py-1">
              <SignOutButton />
            </div>
          </MerListGroup>
        </MerSection>
      </nav>
    </div>
  );
}
