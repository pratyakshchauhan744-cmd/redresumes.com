import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

const reportWebVitals = () => {
  const handler = (metric: { name: string; value: number; id: string }) => {
    // Console logging is useful in development and can be replaced by analytics transport.
    console.info(`[WebVitals] ${metric.name}:`, metric.value, metric.id);
  };
  onCLS(handler);
  onINP(handler);
  onLCP(handler);
  onFCP(handler);
  onTTFB(handler);
};

reportWebVitals();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
