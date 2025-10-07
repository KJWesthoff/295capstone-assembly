// Scanner Service Authentication
// Handles JWT authentication with the Python scanner service

const SCANNER_SERVICE_URL = process.env.NEXT_PUBLIC_SCANNER_SERVICE_URL || 'http://localhost:8000';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

class ScannerAuth {
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    // Try to load token from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('scanner_token');
      const expiry = localStorage.getItem('scanner_token_expiry');
      this.tokenExpiry = expiry ? parseInt(expiry) : null;
    }
  }

  /**
   * Check if we have a valid token
   */
  isAuthenticated(): boolean {
    if (!this.token || !this.tokenExpiry) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    return this.tokenExpiry > now + (5 * 60 * 1000);
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    if (this.isAuthenticated()) {
      return this.token;
    }
    return null;
  }

  /**
   * Login to scanner service
   */
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${SCANNER_SERVICE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        console.error('Login failed:', response.status, response.statusText);
        return false;
      }

      const data: LoginResponse = await response.json();
      this.token = data.access_token;
      
      // JWT tokens typically expire in 24 hours
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);

      // Store in localStorage (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.setItem('scanner_token', this.token);
        localStorage.setItem('scanner_token_expiry', this.tokenExpiry.toString());
      }

      console.log('✅ Scanner service authentication successful');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * Auto-login with default credentials (for development)
   */
  async autoLogin(): Promise<boolean> {
    // Try default credentials from environment or fallback
    const defaultUsername = process.env.NEXT_PUBLIC_SCANNER_USERNAME || 'scanner_admin';
    const defaultPassword = process.env.NEXT_PUBLIC_SCANNER_PASSWORD || 'SecureP@ssw0rd2024!';
    
    console.log(`🔑 Attempting auto-login to scanner service...`);
    return await this.login(defaultUsername, defaultPassword);
  }

  /**
   * Logout and clear token
   */
  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('scanner_token');
      localStorage.removeItem('scanner_token_expiry');
    }
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
      };
    }
    return {};
  }
}

// Export singleton instance
export const scannerAuth = new ScannerAuth();

// Export for use in API client
export const getScannerAuthHeader = () => scannerAuth.getAuthHeader();
export const ensureScannerAuth = async (): Promise<boolean> => {
  if (scannerAuth.isAuthenticated()) {
    return true;
  }
  return await scannerAuth.autoLogin();
};

