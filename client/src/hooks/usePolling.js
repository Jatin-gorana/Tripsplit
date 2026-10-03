import { useEffect, useRef } from 'react';

/**
 * Custom hook that polls a callback every intervalMs (default 5000ms).
 * Pauses when document is hidden OR when isPaused is true (e.g. when a modal is open).
 */
export function usePolling(callback, intervalMs = 5000, isPaused = false) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (isPaused) return;

    let timerId = null;

    const executeCallback = () => {
      if (document.visibilityState === 'visible' && !isPaused && savedCallback.current) {
        savedCallback.current();
      }
    };

    // Setup interval
    timerId = setInterval(() => {
      executeCallback();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isPaused) {
        executeCallback();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (timerId) clearInterval(timerId);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [intervalMs, isPaused]);
}
