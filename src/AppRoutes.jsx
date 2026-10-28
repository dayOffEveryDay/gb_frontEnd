import HomePage from './HomePage';
import HomeRedirect from './layouts/HomeRedirect';
import RequestsPage from './pages/requests/RequestsPage';
import InquiriesPage from './pages/inquiries/InquiriesPage';
import MinePage from './pages/mine/MinePage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import LineCallbackPage from './LineCallbackPage';
import LoginPage from './LoginPage';
import UserProfilePage from './UserProfilePage';
import GuidePage from './GuidePage';
import OnboardingSetupPage from './OnboardingSetupPage';
import OnboardingWelcomePage from './OnboardingWelcomePage';
import ShareCampaignPage from './ShareCampaignPage';
import InquiryPage from './pages/inquiries/InquiryPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<HomePage />}>
        <Route path="mine" element={<MinePage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="inquiries" element={<InquiriesPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/callback" element={<LineCallbackPage />} />
      <Route path="/onboarding/setup" element={<OnboardingSetupPage />} />
      <Route path="/onboarding/welcome" element={<OnboardingWelcomePage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/users/:id" element={<UserProfilePage />} />
      <Route path="/campaigns/:campaignId" element={<ShareCampaignPage />} />
      <Route path="/share/campaigns/:campaignId" element={<ShareCampaignPage />} />
      <Route path="/inquiries/new" element={<InquiryPage />} />
      <Route path="/inquiries/:inquiryId" element={<InquiryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
