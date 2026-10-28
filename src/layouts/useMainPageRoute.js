import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mainPath, mainTab, pageType, transitionDirection } from './mainRoutes';

// The URL is the only source of truth, including browser back/forward navigation.
export default function useMainPageRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeType = pageType(location.pathname);
  const [transition, setTransition] = useState({ type: activeType, direction: 'forward' });
  const pageTransitionDirection = transition.type === activeType
    ? transition.direction : transitionDirection(transition.type, activeType);
  if (transition.type !== activeType) {
    setTransition({ type: activeType, direction: pageTransitionDirection });
  }

  const setActiveType = useCallback((next, options = {}) => {
    const requested = typeof next === 'function' ? next(mainTab(activeType)) : next;
    if (!requested) return;
    const pathname = mainPath(requested);
    if (pathname !== mainPath(activeType)) navigate(pathname, options);
  }, [activeType, navigate]);

  return { activeType, setActiveType, pageTransitionDirection };
}
