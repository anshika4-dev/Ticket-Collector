import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import EventListPage from './pages/EventListPage';
import EventDetailPage from './pages/EventDetailPage';
import SeatSelectionPage from './pages/SeatSelectionPage';
import CheckoutPage from './pages/CheckoutPage';
import MyBookingsPage from './pages/MyBookingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import OrganiserDashboard from './pages/OrganiserDashboard';
import CreateEventPage from './pages/CreateEventPage';
import WaitlistClaimPage from './pages/WaitlistClaimPage';
import BookingDetailPage from './pages/BookingDetailPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventListPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/seats" element={<ProtectedRoute><SeatSelectionPage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailPage /></ProtectedRoute>} />
        <Route path="/waitlist/claim/:token" element={<ProtectedRoute><WaitlistClaimPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/organiser" element={<ProtectedRoute roles={['organiser', 'admin']}><OrganiserDashboard /></ProtectedRoute>} />
        <Route path="/organiser/create-event" element={<ProtectedRoute roles={['organiser', 'admin']}><CreateEventPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a2e',
                color: '#f0f0ff',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#00d97e', secondary: '#0a0a0f' } },
              error: { iconTheme: { primary: '#ff4757', secondary: '#0a0a0f' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
