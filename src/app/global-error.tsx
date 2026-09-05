"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: "100%",
          fontFamily: "system-ui, sans-serif",
          background: "#ece4d6",
          color: "#1f1a14",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32 }}>
          <p style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>NUMA</p>
          <h1 style={{ fontSize: 20, margin: "16px 0 8px" }}>Något gick fel</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6b6358" }}>
            Skärmen kunde inte laddas. Det är oftast en tillfällig störning — prova igen.
          </p>
          {error?.digest ? (
            <p style={{ fontSize: 12, color: "#8a8276" }}>Kod: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
