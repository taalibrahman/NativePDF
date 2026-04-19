import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import {
  Shield,
  Sun,
  Moon,
  Code,
  Menu,
  X,
  Scissors,
  Minimize2,
  ScanText,
  Edit3,
  FileText,
  Loader2
} from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [sharedFile, setSharedFile] = useState(null);

  const {
    offlineReady: [offlineReady],
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (sharedFile && window.innerWidth < 768) {
      setMenuOpen(true);
    }
  }, [sharedFile]);

  useEffect(() => {
    // Simulate an initial load to mask PWA offline caching of 30MB WASM layers
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };
  
  // ── History & Scroll Lock ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state || {};
      setActiveTool(state.tool || null);
      setMenuOpen(!!state.menu);
      // Safety: always ensure scroll is unlocked on history change
      document.body.style.overflow = '';
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = '';
    };
  }, []);

  // Force unlock when returning to dashboard
  useEffect(() => {
    if (!activeTool && !menuOpen) {
      document.body.style.overflow = '';
    }
  }, [activeTool, menuOpen]);

  const handleSetActiveTool = (tool) => {
    if (activeTool === tool) return;
    setActiveTool(tool);
    // Push new state if opening a tool, or back to null if closing
    window.history.pushState({ tool, menu: false }, '');
  };

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next) {
      window.history.pushState({ tool: activeTool, menu: true }, '');
    } else if (!next && window.history.state?.menu) {
      window.history.back();
    }
  };

  if (!isReady) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'} flex flex-col items-center justify-center p-4 transition-colors`}>
        <div className={`p-8 rounded-3xl flex flex-col items-center max-w-sm w-full animate-pulse transition-all duration-700 ${isDark ? 'bg-[#2a2a2a]' : 'bg-white shadow-xl'}`}>
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-2xl rounded-full opacity-20"></div>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
          </div>
          <h2 className="mt-8 text-2xl font-bold tracking-tight bg-gradient-to-br from-blue-400 to-purple-600 bg-clip-text text-transparent">
            NativePDF
          </h2>
          <p className={`mt-2 text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Initializing secure offline environment...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'} transition-colors`}>
      {/* Header */}
      <header className={`border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} px-8 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Shield className={`w-8 h-8 ${isDark ? 'text-blue-500' : 'text-blue-600'}`} />
            <span className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              NativePDF
            </span>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {offlineReady && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                Ready Offline
              </span>
            )}
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* GitHub Link - Hidden on mobile */}
            <a
              href="https://github.com/taalibrahman/NativePDF"
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'text-gray-300 hover:bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>View Source</span>
            </a>

            {/* Hamburger Menu - Visible only on mobile */}
            <button
              onClick={toggleMenu}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isDark
                  ? 'text-gray-300 hover:bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className={`md:hidden fixed inset-0 top-[73px] z-50 ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'} overflow-y-auto`}>
          <div className="px-8 py-6">
            <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              What do you want to do?
            </h2>
            <div className="space-y-4">
              {/* Feature Card 1: Merge & Split */}
              <div
                className={`p-6 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#2a2a2a]'
                    : 'bg-white shadow-sm'
                }`}
                onClick={() => { handleSetActiveTool('merge'); toggleMenu(); }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center relative">
                    <div className="relative w-20 h-20">
                      <div className="absolute left-0 top-0 w-10 h-14 bg-gradient-to-br from-pink-500 to-rose-500 rounded shadow-lg transform -rotate-12"></div>
                      <div className="absolute right-0 top-2 w-10 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded shadow-lg transform rotate-12"></div>
                      <Scissors className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-yellow-400 z-10" />
                    </div>
                  </div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Merge & Split
                  </h3>
                </div>
              </div>

              {/* Feature Card 2: Compress PDF */}
              <div
                className={`p-6 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#2a2a2a]'
                    : 'bg-white shadow-sm'
                }`}
                onClick={() => { handleSetActiveTool('compress'); toggleMenu(); }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-12 h-16 bg-white rounded shadow-lg flex items-center justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded"></div>
                      </div>
                      <Minimize2 className="absolute -right-2 -bottom-1 w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Compress PDF
                  </h3>
                </div>
              </div>

              {/* Feature Card 3: Extract Text / OCR */}
              <div
                className={`p-6 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#2a2a2a]'
                    : 'bg-white shadow-sm'
                }`}
                onClick={() => { handleSetActiveTool('extract'); toggleMenu(); }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                    <ScanText className={`w-12 h-12 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Extract Text (OCR)
                  </h3>
                </div>
              </div>

              {/* Feature Card 4: Edit PDF */}
              <div
                className={`p-6 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#2a2a2a]'
                    : 'bg-white shadow-sm'
                }`}
                onClick={() => { handleSetActiveTool('edit'); toggleMenu(); }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-12 h-16 bg-white rounded shadow-lg"></div>
                      <Edit3 className={`absolute -top-1 -right-1 w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                  </div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Edit PDF
                  </h3>
                </div>
              </div>

              {/* Feature Card 5: Scan to PDF - Mobile */}
              <div
                className={`p-6 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#2a2a2a]'
                    : 'bg-white shadow-sm'
                }`}
                onClick={() => { handleSetActiveTool('scan-to-pdf'); toggleMenu(); }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-12 h-16 bg-white rounded shadow-lg flex items-center justify-center">
                        <Camera className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white rounded-full px-1 text-[9px] font-bold">PDF</div>
                    </div>
                  </div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Scan to PDF
                  </h3>
                </div>
              </div>

              {/* GitHub Link in mobile menu */}
              <a
                href="https://github.com/taalibrahman/NativePDF"
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] text-gray-300'
                  : 'bg-white text-gray-700 shadow-sm'
                }`}
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="text-lg font-medium">View Source</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Render Main Dashboard directly */}
      <Dashboard 
        isDark={isDark} 
        activeTool={activeTool} 
        setActiveTool={handleSetActiveTool} 
        sharedFile={sharedFile} 
        setSharedFile={setSharedFile} 
      />

    </div>
  );
}
