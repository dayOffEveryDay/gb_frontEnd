import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function usePageScroll(isLoading, hasExplicitTarget = false) {
  const { pathname } = useLocation();
  const pending = useRef(true);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    pending.current = true;
    const save = () => {
      if (pending.current) return;
      try { sessionStorage.setItem(`main-scroll:${pathname}`, String(window.scrollY)); } catch { /* Optional persistence. */ }
    };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
    };
  }, [pathname]);

  useEffect(() => {
    if (hasExplicitTarget) {
      pending.current = false;
      return;
    }
    if (isLoading || !pending.current) return;
    let top = 0;
    try { top = Math.max(0, Number(sessionStorage.getItem(`main-scroll:${pathname}`)) || 0); } catch { /* Default to the top. */ }
    const restore = () => {
      if (!pending.current) return;
      window.scrollTo({ top, behavior: 'instant' });
      // Requests and inquiries load inside the child route. Retry as their DOM grows.
      if (Math.abs(window.scrollY - top) <= 1) pending.current = false;
    };
    const stop = () => {
      pending.current = false;
    };
    const observer = new ResizeObserver(restore);
    observer.observe(document.body);
    const frame = window.requestAnimationFrame(restore);
    const timeout = window.setTimeout(stop, 5000);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [hasExplicitTarget, isLoading, pathname]);
}
