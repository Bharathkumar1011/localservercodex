// Mock auth for standalone server
export function setupAuth(app: any) {
  // No-op for standalone server
}

export function isAuthenticated(req: any, res: any, next: any) {
  // For standalone server, always pass through
  next();
}