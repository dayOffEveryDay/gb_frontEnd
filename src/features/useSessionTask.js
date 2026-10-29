import { useCallback, useEffect, useRef } from 'react';

// An asynchronous action may finish after logout, token replacement, or unmount.
// Call beginSessionTask before awaiting and check its result before updating UI.
export default function useSessionTask(token) {
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    return () => { generation.current += 1; };
  }, [token]);
  return useCallback(() => {
    const started = generation.current;
    return () => started === generation.current;
  }, []);
}
