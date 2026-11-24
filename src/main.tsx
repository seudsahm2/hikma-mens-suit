import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initTelegram } from './lib/telegram';
import './store/auth'; // wires the API client to the auth stores
import { applyTheme, useTheme } from './store/theme';
import App from './App';
import './index.css';

initTelegram();
applyTheme(useTheme.getState().theme); // after Telegram setup, so its header follows the theme

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
