export function registerTagOnceServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is progressive enhancement and must never block the product.
    });
  });
}
