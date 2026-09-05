import * as Sentry from "@sentry/nextjs";
import { getSentryInitOptions } from "./lib/observe/sentry-options";

Sentry.init(getSentryInitOptions());
