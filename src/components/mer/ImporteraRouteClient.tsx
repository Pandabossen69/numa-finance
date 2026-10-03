"use client";

import { useEffect } from "react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { ImporteraScreen } from "@/components/mer/ImporteraScreen";
import { loadImporteraRowsAction } from "@/features/imports/importera-rows-action";
import { rememberImporteraRows } from "@/features/home/last-snapshot";
import { spaTabKey } from "@/lib/nav/spa-tabs";

/**
 * Client-first Tidigare bilder. The keep-alive panel paints the store in
 * the same tick as the tap. A fresh read fills in afterwards; handled mail
 * ids still win if that read is older than the confirm or reject.
 */
export function ImporteraRouteClient() {
  const { pathname } = useNavIntent();
  const active = spaTabKey(pathname) === "/importera";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void loadImporteraRowsAction()
      .then((rows) => {
        if (!cancelled) rememberImporteraRows(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  return <ImporteraScreen data={null} />;
}
