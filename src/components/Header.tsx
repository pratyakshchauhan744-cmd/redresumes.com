import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Moon, Sun, X } from 'lucide-react';
import type { AuthUser } from '../lib/backendApi';
import { PrimaryButton, SecondaryButton } from './Buttons';

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
    { path: '/templates', label: 'Templates' },
    { path: '/job-finder', label: 'Job Finder' },
    { path: '/examples', label: 'Examples' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/blog', label: 'Blog' },
    { path: currentUser ? '/dashboard' : '/login', label: currentUser ? 'Profile' : 'Login' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          RedResumes
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {navLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? 'text-zinc-900 dark:text-zinc-100' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <SecondaryButton label="View Templates" onClick={() => navigate('/templates')} />
          {currentUser ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
              >
                {currentUser.photoDataUrl ? (
                  <img src={currentUser.photoDataUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover border border-zinc-200" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {currentUser.name.split(' ')[0]}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    onLogout();
                  }
                }}
                className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
              >
                Logout
              </button>
            </>
          ) : (
            <PrimaryButton label="Create Resume" onClick={() => navigate('/builder')} />
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-full border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full flex max-h-[80vh] flex-col gap-4 overflow-y-auto border-b border-zinc-100 bg-white px-6 py-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-fit rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-100"
          >
            {darkMode ? 'Use Light Mode' : 'Use Dark Mode'}
          </button>
          {navLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`text-lg font-semibold ${location.pathname === item.path ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {currentUser ? (
              <button
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
              <PrimaryButton label="Create Resume" onClick={() => { setMobileMenuOpen(false); navigate('/builder'); }} />
            )}
          </div>
        </div>
      )}
    </header>
  );
};
