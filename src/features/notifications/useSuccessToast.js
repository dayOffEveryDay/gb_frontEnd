import { useState, useRef, useEffect } from 'react';

export default function useSuccessToast() {
  const [successToast, setSuccessToast] = useState(null);

  const successToastTimerRef = useRef(null);

  const showSuccessToast = (title, message) => {
    setSuccessToast({ title, message });

    if (successToastTimerRef.current) {
      window.clearTimeout(successToastTimerRef.current);
    }

    successToastTimerRef.current = window.setTimeout(() => {
      setSuccessToast(null);
      successToastTimerRef.current = null;
    }, 3600);
  };

  useEffect(() => () => {
    if (successToastTimerRef.current) window.clearTimeout(successToastTimerRef.current);
  }, []);

  return {
    successToast,
    setSuccessToast,
    successToastTimerRef,
    showSuccessToast
  };
}
