import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LocationFormPage } from './pages/LocationFormPage.jsx';
import { MapPage } from './pages/MapPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

export default function App() {
  return (
    // AuthProvider ≈ like an EnvironmentObject/singleton service (a AuthManager.shared you'd inject via @EnvironmentObject in SwiftUI). It wraps the whole tree so any child can call useAuth()
    <AuthProvider>
      <Routes>
        {/* <Route path="..." element={<X />} /> ≈ a case in a switch/router that says "if the URL path matches this, show this View." Instead of pushing/popping view controllers */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ProtectedRoute / AdminRoute ≈ these are guard components, not screens themselves. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/locations/new" element={<LocationFormPage />} />
            {/* /locations/:id/edit ≈ a route parameter, like a path segment you'd parse from a deep link URL (myapp://locations/42/edit) */}
            <Route path="/locations/:id/edit" element={<LocationFormPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
