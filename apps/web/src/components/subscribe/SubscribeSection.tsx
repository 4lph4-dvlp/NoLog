import { SubscribeForm } from "./SubscribeForm";

interface SubscribeSectionProps {
  variant: "default" | "terminal";
}

/**
 * The one and only env gate for the subscribe feature (D-04, SEC-03, SUB-02).
 * Server Component — no client directive, so the presence check for the two
 * Resend env vars never enters client JS. An unconfigured fork stays
 * invisible rather than falling back to anything shared.
 */
export function SubscribeSection({ variant }: SubscribeSectionProps) {
  const configured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID
  );

  if (!configured) {
    return null;
  }

  return <SubscribeForm variant={variant} />;
}
