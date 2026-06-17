import { useCallback, useEffect, useState } from "react";

/**
 * Whole seconds left until `untilMs`, clamped at 0. Pure so it can be unit
 * tested without a DOM. Exported separately from the hook for that reason.
 */
export function cooldownRemaining(untilMs: number | null, nowMs: number): number {
  if (untilMs === null) return 0;
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

/**
 * Cooldown timer for actions that must not be spammed — sending password-reset
 * and email-verification messages. Call `start()` after a send succeeds; while
 * `active`, the caller disables its button and shows `remaining` ("Resend in
 * Ns"). This is the UX guard against repeated clicks; the /api/auth/* routes
 * keep their own per-IP+email rate limits as the real protection.
 */
export function useCooldown(seconds: number) {
  const [until, setUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const left = cooldownRemaining(until, Date.now());
      setRemaining(left);
      if (left === 0) setUntil(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback(() => {
    setUntil(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, [seconds]);

  return { remaining, active: remaining > 0, start };
}
