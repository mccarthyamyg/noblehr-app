import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import InviteAccept from './pages/InviteAccept';
import SuperAdmin from './pages/SuperAdmin';
import ApproveOrg from './pages/ApproveOrg';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import RequestApprovalAgain from './pages/RequestApprovalAgain';
import ForgotEmail from './pages/ForgotEmail';
import Launch from './pages/Launch';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, superAdmin, superAdminImpersonating } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/Login" element={<Login />} />
      <Route path="/Setup" element={<Pages.Setup />} />
      <Route path="/InviteAccept" element={<InviteAccept />} />
      <Route path="/ApproveOrg" element={<ApproveOrg />} />
      <Route path="/ForgotPassword" element={<ForgotPassword />} />
      <Route path="/ResetPassword" element={<ResetPassword />} />
      <Route path="/VerifyEmail" element={<VerifyEmail />} />
      <Route path="/RequestApprovalAgain" element={<RequestApprovalAgain />} />
      <Route path="/ForgotEmail" element={<ForgotEmail />} />
      <Route path="/Launch" element={<Launch />} />
      {!isAuthenticated ? (
        <Route path="*" element={<Navigate to="/Login" replace />} />
      ) : superAdmin && !superAdminImpersonating ? (
        <>
          <Route path="/" element={<Navigate to="/SuperAdmin" replace />} />
          <Route path="/SuperAdmin" element={<SuperAdmin />} />
          <Route path="/Profile" element={<Pages.Profile />} />
          <Route path="*" element={<Navigate to="/SuperAdmin" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          } />
          {Object.entries(Pages).filter(([k]) => k !== 'Setup').map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </>
      )}
    </Routes>
  );
};


function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const content = (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename={import.meta.env?.BASE_URL || '/'}>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider>
  ) : (
    content
  );
}

export default App
