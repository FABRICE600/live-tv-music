import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

// Google Maps Demo Key Quota Hook (dispatches 'gmp-quota-exceeded' without modifying SDK behavior)
const emitGmpQuota = () => window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));

(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  emitGmpQuota();
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    args.some(
      (a) =>
        typeof a === 'string' &&
        (a.includes('OverQuotaMapError') || a.includes('QuotaExceededError')),
    )
  ) {
    emitGmpQuota();
  }
  origConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
