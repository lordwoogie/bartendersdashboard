import * as Sentry from "@sentry/nextjs";
import { SENTRY_BASE_OPTIONS } from "@/lib/sentry";

Sentry.init(SENTRY_BASE_OPTIONS);
