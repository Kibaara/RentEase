import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';
import Auth from './components/Auth';
import TenantDashboard from './components/TenantDashboard';
import AgentDashboard from './components/AgentDashboard';
import LandlordDashboard from './components/LandlordDashboard';
import UserManual from './components/UserManual';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const role = user?.role;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Auth onLogin={setUser} /> : <Navigate to="/dashboard" />} />
        
        <Route path="/dashboard" element={
          user ? (
            role === 'TENANT' ? <Navigate to="/dashboard/tenant" /> :
            role === 'AGENT' ? <Navigate to="/dashboard/agent" /> :
            role === 'LANDLORD' ? <Navigate to="/dashboard/landlord" /> :
            <div className="p-8 text-white">Role not assigned. Please contact admin.</div>
          ) : <Navigate to="/" />
        } />

        <Route path="/dashboard/tenant" element={user && role === 'TENANT' ? <TenantDashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/" />} />
        <Route path="/dashboard/agent" element={user && role === 'AGENT' ? <AgentDashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/" />} />
        <Route path="/dashboard/landlord" element={user && role === 'LANDLORD' ? <LandlordDashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/" />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
