import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RegisterMedicine from './pages/RegisterMedicine';
import BatchQRCodes from './pages/BatchQRCodes';
import Verify from './pages/Verify';
import AdminUsers from './pages/AdminUsers';

const PrivateRoute = ({ children, roles }: { children: React.ReactElement; roles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="verify" element={<Verify />} />

            <Route path="dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />

            <Route path="register-medicine" element={
              <PrivateRoute roles={['admin', 'distributor']}>
                <RegisterMedicine />
              </PrivateRoute>
            } />

            <Route path="batch/:batchId/qrcodes" element={
              <PrivateRoute roles={['admin', 'distributor']}>
                <BatchQRCodes />
              </PrivateRoute>
            } />

            <Route path="admin/users" element={
              <PrivateRoute roles={['admin']}>
                <AdminUsers />
              </PrivateRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
