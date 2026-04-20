import React, { useState } from 'react';
import { api } from '../services/api';
import { Building2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth({ onLogin }: { onLogin: (user: any) => void }) {
  const [view, setView] = useState<'LOGIN' | 'SETUP' | 'REGISTER'>('LOGIN');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    api.auth.status().then(res => {
      setIsConfigured(res.isConfigured);
      if (!res.isConfigured) setView('REGISTER');
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (view === 'LOGIN') {
        const user = await api.auth.login({ email, password });
        onLogin(user);
      } else if (view === 'SETUP') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await api.auth.setupPassword({ email, password });
        setSuccess("Password setup successful! You can now sign in.");
        setView('LOGIN');
        setPassword('');
        setConfirmPassword('');
      } else if (view === 'REGISTER') {
        const user = await api.auth.register({ name, email, password, role: 'LANDLORD' });
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isConfigured === null) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100 font-sans">
      {/* Left Side - Branding */}
      <div className="hidden md:flex md:w-1/2 bg-zinc-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-400 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Building2 className="h-8 w-8 text-zinc-400" />
          <span>RentEase</span>
        </div>

        <div className="relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-light leading-tight mb-6"
          >
            Property management <br />
            <span className="font-semibold text-zinc-400">reimagined.</span>
          </motion.h1>
          <p className="text-zinc-500 max-w-md text-lg">
            Streamline your rental business with our all-in-one platform for landlords, agents, and tenants.
          </p>
        </div>

        <div className="relative z-10 text-sm text-zinc-600">
          © 2026 RentEase Inc. All rights reserved.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              {view === 'REGISTER' ? 'System Setup' : view === 'SETUP' ? 'Setup Your Password' : 'Welcome to RentEase'}
            </h2>
            <p className="text-zinc-500">
              {view === 'REGISTER' 
                ? 'Register the primary landlord account to get started.'
                : view === 'SETUP' 
                  ? 'Registered tenants can set their initial password here.' 
                  : 'Manage your property with precision and ease.'}
            </p>
          </div>

          <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
            {isConfigured ? (
              <>
                <button 
                  onClick={() => setView('LOGIN')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${view === 'LOGIN' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setView('SETUP')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${view === 'SETUP' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Setup Password
                </button>
              </>
            ) : (
              <div className="flex-1 py-2 text-sm font-medium text-center text-white bg-zinc-800 rounded-md">
                Initial Landlord Setup
              </div>
            )}
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {view === 'REGISTER' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                placeholder="m@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">
                {view === 'SETUP' ? 'New Password' : 'Password'}
              </label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                placeholder="••••••••"
              />
            </div>

            {view === 'SETUP' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Confirm Password</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}
            {success && <p className="text-green-500 text-xs">{success}</p>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-zinc-100 text-zinc-950 font-semibold py-3 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {view === 'REGISTER' ? 'Register Landlord' : view === 'SETUP' ? 'Set Password' : 'Sign In'}
            </button>
            
            {(view === 'LOGIN' || view === 'SETUP') && (
              <p className="text-[10px] text-zinc-600 italic text-center">
                Note: Accounts must be registered by property staff. 
                Tenants can set their passwords after registration.
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
