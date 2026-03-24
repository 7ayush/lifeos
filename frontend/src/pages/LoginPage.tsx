import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    try {
      await login(response.credential);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [login, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // Bypass Google OAuth for local dev
    if (import.meta.env.VITE_BYPASS_GOOGLE_AUTH === 'true') {
      login('bypass-token').then(() => navigate('/', { replace: true })).catch(console.error);
      return;
    }

    const initializeGoogle = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        });
      }
    };

    // Wait for Google script to load
    if (window.google) {
      initializeGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, navigate, handleCredentialResponse]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden font-['Inter']">
      {/* Ambient background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
      <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-secondary/50 backdrop-blur-2xl border border-border rounded-3xl p-10 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
          {/* Brand */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.3)] mb-5">
              <span className="text-3xl font-bold text-white font-['Outfit']">L</span>
            </div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground font-['Outfit'] tracking-tight">
              Life OS
            </h1>
            <p className="text-muted-foreground text-sm mt-2 font-medium">
              Your personal management system
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-muted-foreground text-xs uppercase tracking-widest font-medium">Sign in to continue</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Google Sign-In Button */}
          <div className="flex justify-center">
            <div ref={googleButtonRef} />
          </div>

          {/* Footer */}
          <p className="text-muted-foreground text-xs text-center mt-10 leading-relaxed">
            By signing in, you agree to allow Life OS to manage your personal data securely.
          </p>
        </div>
      </div>
    </div>
  );
}
