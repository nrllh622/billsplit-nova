import { useEffect, useRef, useState } from "react";

/**
 * Tween a numeric value smoothly to `target` whenever it changes.
 * Uses requestAnimationFrame + easeOutCubic.
 */
export function useAnimatedNumber(target: number, duration = 450): number {
  const [value, setValue] = useState<number>(target);
  const fromRef = useRef<number>(target);
  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<number>(target);

  useEffect(() => {
    const safeTarget = isFinite(target) ? target : 0;
    targetRef.current = safeTarget;
    fromRef.current = isFinite(value) ? value : 0;
    startedAtRef.current = Date.now();

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next =
        fromRef.current + (targetRef.current - fromRef.current) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
