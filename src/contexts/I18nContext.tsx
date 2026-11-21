import React from 'react';
import { t, getLocale, type Locale } from '../lib/i18n';

// Shim — t() is now a plain global function initialized from localStorage.
// All existing useT() / const { t } = useT() calls continue to work unchanged.
export function useT() {
  return { t, locale: getLocale() };
}

export function I18nProvider({ children }: { children: React.ReactNode; locale?: Locale }) {
  return <>{children}</>;
}