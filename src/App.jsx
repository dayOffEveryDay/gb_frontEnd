import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import LineCallbackPage from './LineCallbackPage';
import LoginPage from './LoginPage';
import UserProfilePage from './UserProfilePage';
import GuidePage from './GuidePage';
import OnboardingSetupPage from './OnboardingSetupPage';
import OnboardingWelcomePage from './OnboardingWelcomePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/callback" element={<LineCallbackPage />} />
        <Route path="/onboarding/setup" element={<OnboardingSetupPage />} />
        <Route path="/onboarding/welcome" element={<OnboardingWelcomePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/users/:id" element={<UserProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
