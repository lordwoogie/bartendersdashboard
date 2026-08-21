import * as Sentry from "@sentry/nextjs";
import { SENTRY_BASE_OPTIONS } from "@/lib/sentry";

Sentry.init(SENTRY_BASE_OPTIONS);

// Breadcrumbs for client-side navigations, so an error report shows which
// pages the tablet visited before it broke.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
