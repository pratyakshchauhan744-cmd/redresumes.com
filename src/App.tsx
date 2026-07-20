import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Seo } from './components/Seo';
import { readStoredUser } from './lib/auth';
import type { AuthUser } from './lib/backendApi';

import { templates } from './data/templates';
import { blogArticles } from './data/blogArticles';
import type { BlogArticle, TemplateItem } from './types';

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ResumeBuilderPage = lazy(() => import('./pages/BuilderPage').then(m => ({ default: m.ResumeBuilderPage })));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const CoverLetterPage = lazy(() => import('./pages/CoverLetterPage').then(m => ({ default: m.CoverLetterPage })));
const ExamplesPage = lazy(() => import('./pages/ExamplesPage').then(m => ({ default: m.ExamplesPage })));
const JobFinderPage = lazy(() => import('./pages/JobFinderPage').then(m => ({ default: m.JobFinderPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then(m => ({ default: m.BlogPage })));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage').then(m => ({ default: m.BlogPostPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const PublicResumePage = lazy(() => import('./pages/PublicResumePage').then(m => ({ default: m.PublicResumePage })));
const InterviewSetupPage = lazy(() => import('./pages/InterviewSetupPage').then(m => ({ default: m.InterviewSetupPage })));
const InterviewSessionPage = lazy(() => import('./pages/InterviewSessionPage').then(m => ({ default: m.InterviewSessionPage })));
const InterviewReportPage = lazy(() => import('./pages/InterviewReportPage').then(m => ({ default: m.InterviewReportPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));

const RouteUiEffects = () => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setIsTransitioning(true);
    const timer = window.setTimeout(() => setIsTransitioning(false), 280);
    document.dispatchEvent(new Event('prerender-ready'));
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      {isTransitioning && <div className="fixed left-0 top-0 z-[90] h-1 w-full animate-pulse bg-primary/80" />}
      {isTransitioning && (
        <div className="pointer-events-none fixed right-4 top-[78px] z-[90] rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200">
          Loading...
        </div>
      )}
    </>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem>(() => {
    if (typeof window === 'undefined') return templates[0];
    const storedTemplateId = window.localStorage.getItem('redresumes_selected_template_id');
    const storedTemplate = templates.find((item) => item.id === storedTemplateId);
    return storedTemplate ?? templates[0];
  });
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [selectedBlogArticle, setSelectedBlogArticle] = useState<BlogArticle>(blogArticles[0]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('redresumes_theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    setCurrentUser(readStoredUser());
  }, []);

  useEffect(() => {
    window.localStorage.setItem('redresumes_selected_template_id', selectedTemplate.id);
  }, [selectedTemplate.id]);

  useEffect(() => {
    const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
    if (!gaMeasurementId || window.document.getElementById('ga-script')) return;

    const script = window.document.createElement('script');
    script.id = 'ga-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
    window.document.head.appendChild(script);

    const inlineScript = window.document.createElement('script');
    inlineScript.id = 'ga-inline-script';
    inlineScript.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaMeasurementId}');
    `;
    window.document.head.appendChild(inlineScript);
  }, []);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      window.localStorage.setItem('redresumes_theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('redresumes_theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = () => {
    window.sessionStorage.removeItem('redresumes_access_token');
    window.localStorage.removeItem('redresumes_access_token');
    window.localStorage.removeItem('redresumes_user');
    setCurrentUser(null);
  };

  const isAuthenticated = Boolean(currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const handleUseTemplate = (template: TemplateItem) => {
    setSelectedTemplate(template);
    setSelectedExample(null);
  };

  return (
    <BrowserRouter>
      <Seo />
      <RouteUiEffects />
      <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-primary focus:p-4 focus:border focus:border-primary focus:rounded focus:m-4"
        >
          Skip to main content
        </a>
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        />
        
        <main id="main-content" className="flex-1">
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-zinc-500">Loading...</div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={
                <HomePage 
                  onUseTemplate={handleUseTemplate} 
                />
              } />
              <Route path="/templates" element={
                <TemplatesPage onUseTemplate={handleUseTemplate} />
              } />
              
              {/* Note: Builder is now fully public */}
              <Route path="/builder" element={
                <ResumeBuilderPage 
                  selectedTemplate={selectedTemplate} 
                  selectedExample={selectedExample} 
                  onSelectTemplate={setSelectedTemplate} 
                  currentUser={currentUser} 
                />
              } />
              
              <Route path="/cover-letter" element={<CoverLetterPage />} />
              <Route path="/pricing" element={<Navigate to="/" replace />} />
              <Route path="/examples" element={
                <ExamplesPage onViewExample={(r) => setSelectedExample(r)} />
              } />
              <Route path="/job-finder" element={<JobFinderPage currentUser={currentUser} />} />
              <Route path="/blog" element={
                <BlogPage onReadArticle={(a) => setSelectedBlogArticle(a)} />
              } />
              <Route path="/blog/post" element={
                <BlogPostPage article={selectedBlogArticle} onBack={() => window.location.assign('/blog')} />
              } />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/r/:resumeId" element={<PublicResumePage />} />
              <Route path="/privacy" element={<LegalPage title="Privacy Policy" />} />
              <Route path="/terms" element={<LegalPage title="Terms of Service" />} />
              
              {/* Auth Routes */}
              <Route path="/login" element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : 
                <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />
              } />

              {/* Protected Routes */}
              <Route path="/dashboard" element={
                isAuthenticated ? 
                  <DashboardPage 
                    currentUser={currentUser!} 
                    onLogout={handleLogout} 
                    onUserUpdated={setCurrentUser} 
                  /> : 
                  <Navigate to="/login" replace />
              } />
              
              <Route path="/interview/setup" element={
                isAuthenticated ? 
                  <InterviewSetupPage currentUser={currentUser} onUserUpdated={setCurrentUser} /> : 
                  <Navigate to="/login" replace />
              } />
              <Route path="/interview/session/:id" element={
                isAuthenticated ? 
                  <InterviewSessionPage currentUser={currentUser} /> : 
                  <Navigate to="/login" replace />
              } />
              <Route path="/interview/report/:id" element={
                isAuthenticated ? 
                  <InterviewReportPage /> : 
                  <Navigate to="/login" replace />
              } />
              
              {/* Admin Route */}
              <Route path="/admin" element={
                isAdmin ? <AdminPage /> : <Navigate to="/" replace />
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        
        <Footer currentUser={currentUser} />
      </div>
    </BrowserRouter>
  );
};

export default App;
