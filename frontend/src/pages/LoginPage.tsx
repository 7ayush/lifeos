import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Target, Activity, BookOpen, Droplets, Flame,
  FolderOpen, Archive, Layers,
} from 'lucide-react';

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

const HEATMAP = [
  {c:'#34d399',o:0.8}, {c:'#f59e0b',o:0.4}, {c:'#f59e0b',o:0.9}, {c:'#34d399',o:0.6}, {c:'#ef4444',o:0.3}, {c:'#f59e0b',o:0.7}, {c:'#34d399',o:0.5},
  {c:'#f59e0b',o:0.3}, {c:'#34d399',o:0.9}, {c:'#f59e0b',o:0.6}, {c:'#34d399',o:0.7}, {c:'#ef4444',o:0.4}, {c:'#f59e0b',o:0.2}, {c:'#34d399',o:0.8},
  {c:'#34d399',o:0.5}, {c:'#f59e0b',o:0.2}, {c:'#f59e0b',o:0.8}, {c:'#34d399',o:0.9}, {c:'#f59e0b',o:0.5}, {c:'#ef4444',o:0.3}, {c:'#34d399',o:0.7},
  {c:'#f59e0b',o:0.9}, {c:'#34d399',o:0.7}, {c:'#ef4444',o:0.4}, {c:'#f59e0b',o:0.6}, {c:'#34d399',o:0.9}, {c:'#f59e0b',o:0.2}, {c:'#34d399',o:0.5},
];

/* ------------------------------------------------------------------ */
/* The entire left-panel diagram as a single scaled SVG                */
/* This locks all spatial relationships regardless of viewport size    */
/* ------------------------------------------------------------------ */
function DiagramSVG() {
  // Design canvas: 580 x 520 — matches the reference proportions
  return (
    <svg
      viewBox="0 0 580 520"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ga" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(245,158,11,0.5)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0.04)" />
        </linearGradient>
        <linearGradient id="gt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(20,184,166,0.45)" />
          <stop offset="100%" stopColor="rgba(20,184,166,0.04)" />
        </linearGradient>
      </defs>

      {/* ── Flow lines from center (290,260) to each card ── */}
      {/* → Projects */}
      <path d="M 270,245 C 210,220 170,150 120,115" fill="none" stroke="url(#ga)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite'}} />
      {/* → Areas */}
      <path d="M 265,265 C 200,275 140,290 85,295" fill="none" stroke="url(#ga)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite .5s'}} />
      {/* → Resources */}
      <path d="M 270,280 C 210,330 150,380 100,400" fill="none" stroke="url(#ga)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite 1s'}} />
      {/* → Archive */}
      <path d="M 290,290 C 285,340 270,400 255,430" fill="none" stroke="url(#ga)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite 1.5s'}} />
      {/* → Goals */}
      <path d="M 315,240 C 370,210 420,140 455,105" fill="none" stroke="url(#gt)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite .3s'}} />
      {/* → Habits */}
      <path d="M 320,258 C 380,250 430,235 455,225" fill="none" stroke="url(#gt)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite .8s'}} />
      {/* → Journal */}
      <path d="M 318,275 C 380,300 430,340 455,350" fill="none" stroke="url(#gt)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite 1.3s'}} />
      {/* → Hydration */}
      <path d="M 310,285 C 370,330 430,390 455,410" fill="none" stroke="url(#gt)" strokeWidth="1.3" strokeDasharray="5 4" style={{animation:'dash 4s linear infinite 1.8s'}} />

      {/* ── Central hex node ── */}
      <g transform="translate(290,260)">
        {/* Glow */}
        <circle r="50" fill="rgba(245,158,11,0.06)" filter="url(#blur)" />
        {/* Hex shape */}
        <polygon
          points="0,-42 36,-21 36,21 0,42 -36,21 -36,-21"
          fill="hsl(var(--card) / 0.8)"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
        {/* Logo square */}
        <rect x="-14" y="-24" width="28" height="28" rx="6" fill="url(#logo-grad)" />
        <text x="0" y="-6" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="Outfit" fontStyle="italic">L</text>
        <text x="0" y="14" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="9" fontWeight="700" fontFamily="Outfit">LifeOS</text>
        <text x="0" y="24" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="7" fontFamily="Jost">Workspace</text>
      </g>
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>

      {/* ── foreignObject cards ── */}
      {/* Projects */}
      <foreignObject x="15" y="80" width="175" height="105">
        <div className="glass-panel rounded-lg p-2" style={{fontSize:0}}>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center"><Target className="w-2.5 h-2.5 text-emerald-400" /></div>
            <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Projects</span>
          </div>
          <div className="flex justify-between mb-1" style={{fontSize:9}}><span className="text-muted-foreground">Goal Progress</span><span className="text-muted-foreground">14 Days Due</span></div>
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeDasharray="88" strokeDashoffset="22" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-bold text-emerald-400" style={{fontSize:7}}>75%</span>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground" style={{fontSize:8}}>Title:</p>
              <p className="font-medium text-foreground truncate" style={{fontSize:9}}>Half Marathon Plan</p>
            </div>
          </div>
        </div>
      </foreignObject>

      {/* Areas */}
      <foreignObject x="10" y="260" width="155" height="72">
        <div className="glass-panel rounded-lg p-2" style={{fontSize:0}}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-5 h-5 rounded bg-cyan-500/10 flex items-center justify-center"><Layers className="w-2.5 h-2.5 text-cyan-400" /></div>
            <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Areas</span>
          </div>
          <div className="flex justify-between" style={{fontSize:9}}><span className="text-muted-foreground">Habit Adherence</span><span className="font-semibold text-foreground">89%</span></div>
          <p className="text-muted-foreground mt-0.5" style={{fontSize:9}}>Physical Health</p>
        </div>
      </foreignObject>

      {/* Resources */}
      <foreignObject x="15" y="375" width="155" height="72">
        <div className="glass-panel rounded-lg p-2" style={{fontSize:0}}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center"><FolderOpen className="w-2.5 h-2.5 text-amber-400" /></div>
            <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Resources</span>
          </div>
          <div className="flex justify-between" style={{fontSize:9}}><span className="text-muted-foreground">Vault Notes</span><span className="font-semibold text-foreground">42</span></div>
          <p className="text-muted-foreground mt-0.5" style={{fontSize:9}}>Photography Skills</p>
        </div>
      </foreignObject>

      {/* Archive */}
      <foreignObject x="210" y="420" width="150" height="48">
        <div className="glass-panel rounded-lg px-2.5 py-1.5 flex items-center gap-1.5" style={{fontSize:0}}>
          <div className="w-5 h-5 rounded bg-muted flex items-center justify-center"><Archive className="w-2.5 h-2.5 text-muted-foreground" /></div>
          <div>
            <span style={{fontSize:10}} className="font-bold text-foreground font-['Outfit']">Archive</span>
            <p className="text-muted-foreground" style={{fontSize:8}}>Completed Goals</p>
          </div>
        </div>
      </foreignObject>

      {/* Goals */}
      <foreignObject x="400" y="70" width="170" height="105">
        <div className="glass-panel rounded-lg p-2" style={{fontSize:0}}>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center"><Target className="w-2.5 h-2.5 text-emerald-400" /></div>
            <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Goals</span>
          </div>
          <div className="flex gap-1 mb-1">
            <div className="flex-1 bg-secondary/50 rounded px-1 py-0.5"><p style={{fontSize:7}} className="font-bold text-muted-foreground uppercase">Milestones</p></div>
            <div className="flex-1 bg-secondary/50 rounded px-1 py-0.5"><p style={{fontSize:7}} className="font-bold text-muted-foreground uppercase">Kanban</p></div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-emerald-400" /><span style={{fontSize:8}} className="text-muted-foreground">Milestones</span></div>
            <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-cyan-400" /><span style={{fontSize:8}} className="text-muted-foreground">2 day</span></div>
            <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-amber-400" /><span style={{fontSize:8}} className="text-muted-foreground">1 day</span></div>
          </div>
        </div>
      </foreignObject>

      {/* Habits */}
      <foreignObject x="395" y="195" width="180" height="100">
        <div className="glass-panel rounded-lg p-2" style={{fontSize:0}}>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center"><Activity className="w-2.5 h-2.5 text-amber-400" /></div>
            <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Habits</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <Flame className="w-2.5 h-2.5 text-orange-400" />
            <span style={{fontSize:9}} className="font-semibold text-orange-400">12-day streak</span>
          </div>
          <div className="grid grid-cols-7 gap-[2px]">
            {HEATMAP.map((h, i) => (
              <div key={i} className="rounded-[1px]" style={{ width:9, height:9, backgroundColor: h.c, opacity: h.o }} />
            ))}
          </div>
        </div>
      </foreignObject>

      {/* Journal */}
      <foreignObject x="405" y="325" width="145" height="38">
        <div className="glass-panel rounded-lg p-2 flex items-center gap-1.5" style={{fontSize:0}}>
          <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center"><BookOpen className="w-2.5 h-2.5 text-indigo-400" /></div>
          <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Journal</span>
          <span className="ml-auto" style={{fontSize:12}}>😊</span>
        </div>
      </foreignObject>

      {/* Hydration */}
      <foreignObject x="405" y="390" width="145" height="38">
        <div className="glass-panel rounded-lg p-2 flex items-center gap-1.5" style={{fontSize:0}}>
          <div className="w-5 h-5 rounded bg-cyan-500/10 flex items-center justify-center"><Droplets className="w-2.5 h-2.5 text-cyan-400" /></div>
          <span style={{fontSize:11}} className="font-bold text-foreground font-['Outfit']">Hydration</span>
          <span className="ml-auto font-semibold text-muted-foreground" style={{fontSize:9}}>900ml</span>
        </div>
      </foreignObject>

      {/* ── Labels ── */}
      <text x="30" y="75" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" fontFamily="Jost" letterSpacing="1.2" style={{textTransform:'uppercase'}}>P.A.R.A. Methodology</text>
      <text x="400" y="65" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" fontFamily="Jost" letterSpacing="1.2">Goals → Tasks → Habits</text>
      <text x="30" y="500" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" fontFamily="Jost" letterSpacing="1.2" style={{textTransform:'uppercase'}}>LifeOS Dashboard</text>
      <text x="240" y="500" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" fontFamily="Jost" letterSpacing="0.5">Connected Productivity</text>
      <text x="410" y="500" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" fontFamily="Jost" letterSpacing="1.2">Goals → Tasks → Habits</text>
    </svg>
  );
}


/* ------------------------------------------------------------------ */
/* Left Panel wrapper                                                  */
/* ------------------------------------------------------------------ */
function ValueDiagram() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none" aria-hidden="true">
      {/* Ambient glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] left-[45%] w-48 h-48 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Header — in flow on mobile to avoid overlap, overlaid on desktop */}
      <div className="relative lg:absolute lg:top-0 lg:left-0 lg:right-0 z-20 px-[5%] pt-4 lg:pt-5">
        <div className="flex items-center gap-2.5 mb-2 lg:mb-5">
          <div className="w-7 h-7 lg:w-8 lg:h-8 bg-linear-to-br from-amber-400 to-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <span className="text-xs lg:text-sm font-bold text-white font-['Outfit'] italic">L</span>
          </div>
          <span className="text-base lg:text-lg font-bold text-foreground font-['Outfit'] tracking-tight">LifeOS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-[2.6rem] xl:text-5xl font-bold text-foreground font-['Outfit'] tracking-tight leading-[1.05] text-center lg:mt-6">
          Your Life, <span className="text-gradient">Organized.</span>
        </h1>
      </div>

      {/* Diagram SVG — fills remaining space on mobile, full area on desktop */}
      <div className="relative lg:absolute lg:inset-0 w-full h-full min-h-[300px] z-10">
        <DiagramSVG />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login Page                                                          */
/* ------------------------------------------------------------------ */
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
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-background relative overflow-hidden font-['Jost']">

      {/* ===== Left Panel — visible on all screens ===== */}
      {/* On mobile/tablet: stacked on top, fixed height. On desktop: side-by-side. */}
      <div className="w-full h-[55vh] sm:h-[50vh] lg:h-full lg:w-1/2 xl:w-[55%] relative bg-background shrink-0 overflow-hidden">
        <ValueDiagram />
      </div>

      {/* ===== Right Panel ===== */}
      <div className="flex-1 flex flex-col relative min-h-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/6 via-transparent to-transparent" />

        {/* Card — absolutely centered */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative z-10 w-full max-w-none lg:max-w-[520px] mx-0 lg:mx-6 px-3 sm:px-4 lg:px-0 animate-fade-up">
          <div
            className="rounded-2xl sm:rounded-3xl p-6 sm:p-10 xl:p-14 relative overflow-hidden"
            style={{
              background: 'hsl(var(--card) / 0.45)',
              backdropFilter: 'blur(48px) saturate(140%)',
              WebkitBackdropFilter: 'blur(48px) saturate(140%)',
              border: '1px solid hsl(var(--border) / 0.3)',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37), inset 0 0 0 1px hsl(var(--border) / 0.08)',
            }}
          >
            {/* Glass rim */}
            <div
              className="absolute inset-0 rounded-2xl sm:rounded-3xl pointer-events-none"
              style={{
                padding: '1px',
                background: 'linear-gradient(135deg, var(--glass-rim-from), var(--glass-rim-to))',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />

            {/* Logo — dark square with amber L */}
            <div className="flex flex-col items-center relative z-10">
              <div className="flex items-center gap-3 mb-6 sm:mb-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-linear-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center shadow-lg border border-border/30">
                  <span className="text-xl sm:text-2xl font-bold text-amber-400 font-['Outfit'] italic">L</span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold text-foreground font-['Outfit'] tracking-tight">LifeOS</span>
              </div>

              {/* Heading */}
              <h2 className="text-2xl sm:text-4xl font-bold font-['Outfit'] tracking-tight text-center mb-2 sm:mb-3">
                <span className="text-gradient">Welcome to LifeOS</span>
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base font-medium tracking-wide text-center mb-6 sm:mb-10">
                The definitive reference for personal<br />productivity.
              </p>

              {/* Google Sign-In */}
              <div className="w-full flex justify-center relative z-10">
                <div ref={googleButtonRef} aria-label="Sign in with Google" />
              </div>

              <p className="text-muted-foreground text-xs text-center mt-5 tracking-wide">
                Secure, passwordless access.
              </p>
            </div>
          </div>
          </div>
        </div>

        {/* Footer — pinned to bottom, doesn't affect card centering */}
        <div className="relative z-10 pb-6 sm:pb-8 pt-4 text-center w-full shrink-0">
          <p className="text-muted-foreground text-xs leading-relaxed mb-2">
            Don't have an account?{' '}
            <span className="text-foreground underline underline-offset-2 cursor-pointer hover:text-primary transition-colors font-medium">Sign in</span>{' '}
            to get started.
          </p>
          <p className="text-muted-foreground/50 text-[10px] tracking-wide">
            LifeOS &copy; {new Date().getFullYear()}
          </p>
        </div>

        {/* Decorative star — larger */}
        <div className="absolute bottom-6 right-6 z-10" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 0 L18 14 L32 16 L18 18 L16 32 L14 18 L0 16 L14 14 Z" fill="hsl(var(--primary))" opacity="0.4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
