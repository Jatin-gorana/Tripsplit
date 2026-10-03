import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import OfflineBanner from './components/OfflineBanner';
import InstallPromptBanner from './components/InstallPromptBanner';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import TripListPage from './pages/TripListPage';
import JoinTripPage from './pages/JoinTripPage';
import TripDetailPage from './pages/TripDetailPage';
import LoadingSkeleton from './components/LoadingSkeleton';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4 pt-12">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4 pt-12">
        <LoadingSkeleton />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/trips" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
          <OfflineBanner />
          <InstallPromptBanner />

          <div className="flex-1">
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
              
              <Route path="/trips" element={<ProtectedRoute><TripListPage /></ProtectedRoute>} />
              <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
              <Route path="/join/:inviteCode" element={<ProtectedRoute><JoinTripPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/trips" replace />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
