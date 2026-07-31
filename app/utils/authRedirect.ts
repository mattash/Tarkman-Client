export function getSafeRedirectPath(redirect?: string): string {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/'
  }

  try {
    const destination = new URL(redirect, window.location.origin)
    if (destination.origin !== window.location.origin || destination.pathname === '/login') {
      return '/'
    }

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return '/'
  }
}
