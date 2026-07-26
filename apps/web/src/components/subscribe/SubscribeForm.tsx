"use client";

import { useState } from "react";
import { CONFIG } from "@/site.config";

interface SubscribeFormProps {
  variant: "default" | "terminal";
}

type SubscribeStatus = "idle" | "pending" | "success" | "error";
type SubscribeErrorCode =
  | "invalid_email"
  | "rate_limited"
  | "server_error"
  | "network_error";

interface SubscribeResponseBody {
  ok: boolean;
  code?: string;
}

/**
 * Maps a machine code (D-21) to locale-correct copy (D-06). Server sends
 * codes, never prose, so every visitor-facing message is decided here. The
 * branching over `code` is written exactly once and shared by both variants
 * (per D-02) — only the returned wording differs by `variant`, never which
 * bucket a code falls into.
 */
function errorMessage(code: SubscribeErrorCode, variant: "default" | "terminal"): string {
  if (variant === "terminal") {
    if (code === "invalid_email") {
      return CONFIG.site.locale === "ko"
        ? "ERR: 올바른 이메일 형식이 아닙니다."
        : "ERR: invalid email format.";
    }

    if (code === "rate_limited") {
      return CONFIG.site.locale === "ko"
        ? "ERR: 요청 한도 초과. 잠시 후 다시 시도하세요."
        : "ERR: rate limit exceeded. retry later.";
    }

    // server_error, any unrecognized code, and the network-failure fallback —
    // this message must name no cause (D-07).
    return CONFIG.site.locale === "ko"
      ? "ERR: 처리할 수 없습니다. 잠시 후 다시 시도하세요."
      : "ERR: request failed. retry later.";
  }

  if (code === "invalid_email") {
    return CONFIG.site.locale === "ko"
      ? "올바른 이메일 주소를 입력해 주세요."
      : "Please enter a valid email address.";
  }

  if (code === "rate_limited") {
    return CONFIG.site.locale === "ko"
      ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
      : "Too many requests. Please try again shortly.";
  }

  // server_error, any unrecognized code, and the network-failure fallback —
  // this message must name no cause (D-07).
  return CONFIG.site.locale === "ko"
    ? "지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요."
    : "We couldn't process that right now. Please try again in a moment.";
}

/**
 * Client form island (D-04): email input, honeypot field, submit states,
 * locale copy. Performs no environment read of any kind — the only decision
 * this component makes is what to render for a given submit outcome.
 *
 * `variant` switches presentation only (D-02): the submit handler, every
 * `useState`, the honeypot block and the error-code mapping above are each
 * written exactly once and shared by the `default` and `terminal` render
 * branches below. Neither branch may touch the fetch call, the request
 * body, or the response handling.
 */
export function SubscribeForm({ variant }: SubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [errorCode, setErrorCode] = useState<SubscribeErrorCode>("server_error");

  const pending = status === "pending";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("pending");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company: honeypot }),
      });

      const body = (await res.json()) as SubscribeResponseBody;

      if (body.ok) {
        setStatus("success");
        return;
      }

      const code =
        body.code === "invalid_email" ||
        body.code === "rate_limited" ||
        body.code === "server_error"
          ? body.code
          : "server_error";
      setErrorCode(code);
      setStatus("error");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SubscribeForm] Submit failed: ${message}`);
      setErrorCode("network_error");
      setStatus("error");
    }
  }

  // Honeypot (D-13) — written once, shared by both variant branches below.
  // Off-screen positioning only, deliberately avoiding the two computed-style
  // CSS techniques trivially readable via getComputedStyle() by a bot worth
  // trapping. Field name deliberately plausible rather than named after the
  // trap. Never restyled per-variant — it is never visible to a human, and
  // any change to how it is hidden risks making it detectable.
  const honeypotField = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor="company">
        {CONFIG.site.locale === "ko"
          ? "회사명 (입력하지 마세요)"
          : "Company (leave blank)"}
      </label>
      <input
        id="company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
      />
    </div>
  );

  // ─── Terminal variant — CLI-prompt register ────────────────────────────
  if (variant === "terminal") {
    if (status === "success") {
      return (
        <div className="p-4 border border-terminal-border rounded-md bg-terminal-bg font-mono text-sm text-terminal-prompt">
          {CONFIG.site.locale === "ko"
            ? "OK: 구독이 완료되었습니다. 새 글이 올라오면 알려드릴게요."
            : "OK: subscribed. we'll email you when a new post goes up."}
        </div>
      );
    }

    return (
      <div className="p-4 border border-terminal-border rounded-md bg-terminal-bg font-mono text-sm">
        <div className="flex items-center gap-2 text-terminal-dim mb-3">
          <span className="text-terminal-prompt font-bold">$</span>
          <span className="text-terminal-text">
            {CONFIG.site.locale === "ko"
              ? "subscribe --new-posts"
              : "subscribe --new-posts"}
          </span>
        </div>

        <form
          data-testid="subscribe-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-2"
        >
          <label htmlFor="subscribe-email" className="text-xs text-terminal-dim">
            {CONFIG.site.locale === "ko" ? "인자: email" : "arg: email"}
          </label>

          <div className="flex items-center gap-2">
            <span className="text-terminal-prompt shrink-0">{">"}</span>
            <input
              id="subscribe-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                CONFIG.site.locale === "ko" ? "user@host" : "user@host"
              }
              disabled={pending}
              className="flex-1 bg-transparent border-0 border-b border-terminal-border text-terminal-text placeholder:text-terminal-dim focus:outline-none focus:border-terminal-accent py-1"
            />
          </div>

          {honeypotField}

          <button
            type="submit"
            disabled={pending}
            className="self-start mt-1 px-2 py-1 text-xs font-mono border border-terminal-border text-terminal-prompt hover:bg-terminal-border/30 disabled:opacity-60 transition-colors"
          >
            [
            {pending
              ? CONFIG.site.locale === "ko"
                ? "전송 중…"
                : "sending…"
              : CONFIG.site.locale === "ko"
                ? "실행"
                : "run"}
            ]
          </button>

          {status === "error" && (
            <p className="text-xs text-error font-mono">
              {errorMessage(errorCode, "terminal")}
            </p>
          )}
        </form>
      </div>
    );
  }

  // ─── Default variant — card treatment ───────────────────────────────────
  if (status === "success") {
    return (
      <div className="p-6 bg-surface border border-border rounded-2xl shadow-sm text-sm text-text-primary">
        {CONFIG.site.locale === "ko"
          ? "구독이 완료되었습니다. 새 글이 올라오면 알려드릴게요."
          : "You're subscribed. We'll email you when a new post goes up."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-surface border border-border rounded-2xl shadow-sm transition-colors">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          {CONFIG.site.locale === "ko" ? "새 글 알림 받기" : "Get new post alerts"}
        </h3>
      </div>

      <form
        data-testid="subscribe-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <label htmlFor="subscribe-email" className="text-sm text-text-secondary">
          {CONFIG.site.locale === "ko" ? "이메일 주소" : "Email address"}
        </label>
        <input
          id="subscribe-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={pending}
          className="px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
        />

        {honeypotField}

        <button
          type="submit"
          disabled={pending}
          className="px-3 py-2 text-sm font-medium bg-accent text-text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-60"
        >
          {pending
            ? CONFIG.site.locale === "ko"
              ? "구독 중…"
              : "Subscribing…"
            : CONFIG.site.locale === "ko"
              ? "구독"
              : "Subscribe"}
        </button>

        {status === "error" && (
          <p className="text-sm text-error">{errorMessage(errorCode, "default")}</p>
        )}
      </form>
    </div>
  );
}
