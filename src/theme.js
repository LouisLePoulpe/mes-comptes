export function themePreference() {
  try { const value = localStorage.getItem('mes-comptes-theme'); return ['light','dark','system'].includes(value) ? value : 'system' } catch { return 'system' }
}
export function applyTheme(preference = themePreference()) {
  const value = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference
  document.documentElement.dataset.theme = value
  document.documentElement.style.colorScheme = value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#f2f8ee' : '#071c14')
}
export function initializeTheme() {
  applyTheme()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themePreference() === 'system') applyTheme() })
  window.addEventListener('storage', event => { if (event.key === 'mes-comptes-theme') applyTheme() })
}
