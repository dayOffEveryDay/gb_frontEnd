import { Navigate, useLocation } from 'react-router-dom';
import { homeRedirect } from './mainRoutes';

export default function HomeRedirect() {
  const location = useLocation();
  return <Navigate to={`${homeRedirect(location.state)}${location.search}${location.hash}`} state={location.state} replace />;
}
