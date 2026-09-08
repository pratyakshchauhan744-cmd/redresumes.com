import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import type { AuthUser } from '../lib/backendApi';

export const Header = ({
  currentUser,
  onLogout,
  darkMode,
  onToggleDarkMode,
}: {
  currentUser: AuthUser | null;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/resume-examples', label: 'Resume Examples' },
    { path: '/job-finder', label: 'Job Finder' },
    { path: '/interview/setup', label: 'Interview Practice' },
    { path: currentUser ? '/dashboard' : (location.pathname === '/builder' ? '/login?redirect=/builder' : '/login'), label: currentUser ? 'Profile' : 'Login' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 md:py-3.5">
        {/* Brand Logo */}
        <Link to="/" className="shrink-0 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-xl">
          RedResumes
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-3 xl:gap-6 text-xs xl:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {navLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`whitespace-nowrap transition-colors ${
                location.pathname === item.path
                  ? 'font-bold text-zinc-900 dark:text-zinc-100'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 whitespace-nowrap"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 whitespace-nowrap xl:px-4 xl:py-2"
          >
            View Templates
          </button>

          {currentUser ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 whitespace-nowrap xl:px-4 xl:py-2"
              >
                {currentUser.photoDataUrl ? (
                  <img src={currentUser.photoDataUrl} alt="Profile" className="h-5 w-5 rounded-full object-cover border border-zinc-200" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{currentUser.name.split(' ')[0]}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    onLogout();
                  }
                }}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 whitespace-nowrap xl:px-4 xl:py-2"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/builder')}
              className="inline-flex items-center rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-red-700 active:scale-98 whitespace-nowrap xl:px-5 xl:py-2 xl:text-sm"
            >
              Create Resume
            </button>
          )}
        </div>

        {/* Mobile / Tablet Menu Button */}
        <button 
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-full border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile / Tablet Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full flex max-h-[80vh] flex-col gap-3 overflow-y-auto border-b border-zinc-100 bg-white px-4 py-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-100"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); navigate('/templates'); }}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-100"
            >
              View Templates
            </button>
          </div>

          {navLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`rounded-xl px-3 py-2 text-base font-semibold transition-colors ${
                location.pathname === item.path
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/60'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (window.confirm('Are you sure you want to logout?')) {
                    onLogout();
                  }
                }}
                className="w-full rounded-full border border-zinc-200 px-5 py-3 text-center text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              >
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); navigate('/builder'); }}
                className="w-full rounded-full bg-primary px-5 py-3 text-center text-sm font-bold text-white shadow-xs hover:bg-red-700"
              >
                Create Resume
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
