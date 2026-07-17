const PROFILE_KEY = 'tagonce.profile.v1';
const LEGACY_DEMO_COMPANIES = new Set(['aion ehr', 'aion equity', 'aion equity inc', 'aion equity, inc.']);

function migrateLegacyCompany() {
  try {
    const profile = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}') as {
      displayName?: string;
      company?: string;
    };
    const company = profile.company?.trim().toLowerCase() || '';
    const isPatrickDemo = profile.displayName?.trim().toLowerCase() === 'patrick tran';
    if (!isPatrickDemo || !LEGACY_DEMO_COMPANIES.has(company)) return;
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, company: '' }));
  } catch {
    // A malformed or unavailable local profile should not block the app.
  }
}

function replaceLegacyCompanyPlaceholder() {
  document.querySelectorAll<HTMLInputElement>('input[placeholder="AION EHR"], input[placeholder="AION Equity"]')
    .forEach((input) => input.setAttribute('placeholder', 'Company name'));
}

export function prepareProductPolish() {
  migrateLegacyCompany();
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(replaceLegacyCompanyPlaceholder);
  const start = () => {
    replaceLegacyCompanyPlaceholder();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
