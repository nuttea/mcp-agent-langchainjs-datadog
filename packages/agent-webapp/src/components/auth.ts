import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { getUserInfo, AuthDetails, setUserId, clearUserId } from '../services/auth.service.js';
import { clearUserSession } from '../services/user.service.js';
import personSvg from '../../assets/icons/person.svg?raw';
import logoutSvg from '../../assets/icons/logout.svg?raw';
import microsoftSvg from '../../assets/providers/microsoft.svg?inline';
import githubSvg from '../../assets/providers/github.svg?inline';

// Removed Azure-specific auth routes

export type AuthComponentOptions = {
  strings: {
    logoutButton: string;
  };
  providers: AuthProvider[];
};

export type AuthProvider = {
  id: string;
  label: string;
  icon: string;
  color: string;
  textColor: string;
};

export const authDefaultOptions: AuthComponentOptions = {
  strings: {
    logoutButton: 'Log out',
  },
  providers: [
    { id: 'aad', label: 'Log in with Microsoft', icon: microsoftSvg, color: '#00A4EF', textColor: '#fff' },
    { id: 'github', label: 'Log in with GitHub', icon: githubSvg, color: '#181717', textColor: '#fff' },
    /* {
      id: 'google',
      label: 'Log in with Google',
      icon: 'https://cdn.simpleicons.org/google/white',
      color: '#4285f4',
      textColor: '#fff',
    },
    {
      id: 'facebook',
      label: 'Log in with Facebook',
      icon: 'https://cdn.simpleicons.org/facebook/white',
      color: '#0866ff',
      textColor: '#fff',
    },
    {
      id: 'apple',
      label: 'Log in with Apple',
      icon: 'https://cdn.simpleicons.org/apple/white',
      color: '#000',
      textColor: '#fff',
    },
    {
      id: 'twitter',
      label: 'Log in with X',
      icon: 'https://cdn.simpleicons.org/x/white',
      color: '#000',
      textColor: '#fff',
    },
    {
      id: 'oidc',
      label: 'Log in with OpenID Connect',
      icon: 'https://cdn.simpleicons.org/openid/white',
      color: '#333',
      textColor: '#fff',
    }, */
  ],
};

export type AuthButtonType = 'status' | 'login' | 'logout' | 'guard';

@customElement('azc-auth')
export class AuthComponent extends LitElement {
  @property({
    type: Object,
    converter: (value) => ({ ...authDefaultOptions, ...JSON.parse(value || '{}') }),
  })
  options: AuthComponentOptions = authDefaultOptions;

  @property() type: AuthButtonType = 'login';
  @property() loginRedirect = '/';
  @property() logoutRedirect = '/';
  @state() protected _userDetails: AuthDetails | undefined;
  @state() protected loaded = false;
  @state() protected _userIdInput = '';

  get userDetails() {
    return this._userDetails;
  }

  async onLoginSubmit(e: Event) {
    e.preventDefault();
    if (this._userIdInput.trim()) {
      setUserId(this._userIdInput.trim());
      this._userDetails = await getUserInfo(true);
      this._userIdInput = '';
      this.requestUpdate();
      // Dispatch custom event to notify other auth components
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { userDetails: this._userDetails } }));
    }
  }

  async onLogoutClicked() {
    clearUserId();
    clearUserSession(); // Clear cached user ID so next login gets fresh data
    localStorage.removeItem('auth_token'); // Clear Google OAuth token
    this._userDetails = undefined;
    this.requestUpdate();
    // Dispatch custom event to notify other auth components
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { userDetails: undefined } }));
  }

  // Google OAuth callback handler
  async handleGoogleCallback(response: any) {
    try {
      // Send credential to backend for verification
      const result = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!result.ok) {
        throw new Error('Authentication failed');
      }

      const data = await result.json();

      // Store session token and user ID
      localStorage.setItem('auth_token', data.token);
      setUserId(data.user.userId);

      // Update UI
      this._userDetails = await getUserInfo(true);
      this.requestUpdate();

      // Notify other components
      window.dispatchEvent(new CustomEvent('auth-state-changed', {
        detail: { userDetails: this._userDetails },
      }));

      console.log('Google OAuth login successful:', data.user.email);

      // Reload the page to initialize user session properly
      // This ensures all components (member card, chat, history) are initialized
      window.location.reload();
    } catch (error) {
      console.error('Google OAuth authentication error:', error);
      alert('Authentication failed. Please try again.');
    }
  }

  protected renderStatus = () =>
    html`<section class="auth-status">
      <span class="login-icon">${unsafeSVG(personSvg)}</span>
      ${this._userDetails
        ? html`<span>Logged in as ${this._userDetails.userDetails}</span>
            <slot name="logout"> ${this.renderLogout()} </slot>`
        : nothing}
    </section>`;

  protected renderGuard = () => (this.loaded && this._userDetails ? html`<slot></slot>` : nothing);

  protected renderLogin = () =>
    this.loaded
      ? this.userDetails
        ? html`<slot></slot>`
        : this.renderLoginOptions()
      : html`<slot name="loader"></slot>`;

  protected renderLoginOptions = () =>
    html`<section class="auth-login">
      <!-- Google Sign-In Button -->
      <div id="google-signin-button" class="google-signin-container"></div>
    </section>`;

  protected renderLogout = () =>
    html`<button
      class="logout"
      @click=${() => {
        this.onLogoutClicked();
      }}
      title="log out"
    >
      ${unsafeSVG(logoutSvg)}
    </button>`;

  override async connectedCallback() {
    super.connectedCallback();
    const userDetails = await getUserInfo();
    this._userDetails = userDetails;
    this.loaded = true;

    // Listen for auth state changes from other auth components
    window.addEventListener('auth-state-changed', this.handleAuthStateChanged);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('auth-state-changed', this.handleAuthStateChanged);
  }

  private handleAuthStateChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    this._userDetails = customEvent.detail.userDetails;
    this.requestUpdate();
  };

  protected override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);

    if (this._userDetails) {
      this.classList.add('authenticated');
    } else {
      this.classList.remove('authenticated');
    }

    // Initialize Google Sign-In button after render
    if (!this._userDetails && this.shadowRoot) {
      this.initializeGoogleSignIn();
    }
  }

  private initializeGoogleSignIn() {
    // Check if Google Identity Services is loaded
    if (typeof (window as any).google === 'undefined') {
      console.warn('Google Identity Services not loaded yet');
      return;
    }

    const buttonContainer = this.shadowRoot?.querySelector('#google-signin-button');
    if (!buttonContainer) {
      return;
    }

    // Initialize Google Sign-In
    try {
      (window as any).google.accounts.id.initialize({
        client_id: '449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com',
        callback: this.handleGoogleCallback.bind(this),
        auto_select: false,
      });

      // Render the button
      (window as any).google.accounts.id.renderButton(
        buttonContainer,
        {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        }
      );
    } catch (error) {
      console.error('Failed to initialize Google Sign-In:', error);
    }
  }

  protected override render() {
    switch (this.type) {
      case 'status': {
        return this.renderStatus();
      }

      case 'guard': {
        return this.renderGuard();
      }

      case 'logout': {
        return this.renderLogout();
      }

      default: {
        return this.renderLogin();
      }
    }
  }

  static override styles = css`
    :host {
      /* Base properties - Datadog Theme */
      --primary: var(--azc-primary, #632CA6); /* Datadog Purple */
      --secondary: var(--azc-secondary, #F653A6); /* Datadog Pink */
      --accent: var(--azc-accent, #00B9E4); /* Datadog Teal */
      --error: var(--azc-error, #e30);
      --text-color: var(--azc-text-color, #1E1433);
      --text-invert-color: var(--azc--text-invert-color, #fff);
      --disabled-color: var(--azc-disabled-color, #ccc);
      --bg: var(--azc-bg, #F5F5F5);
      --space-md: var(--azc-space-md, 12px);
      --space-xl: var(--azc-space-xl, calc(var(--space-md) * 2));
      --space-xs: var(--azc-space-xs, calc(var(--space-md) / 2));
      --space-xxs: var(--azc-space-xs, calc(var(--space-md) / 4));
      --border-radius: var(--azc-border-radius, 16px);
      --focus-outline: var(--azc-focus-outline, 2px solid);
      --overlay-color: var(--azc-overlay-color, rgba(99, 44, 166, 0.4));
      --button-border: var(--azc-button-border, none);
      --logout-button-bg: var(--azc-logout-button-bg, transparent);
      --logout-button-bg-hover: var(--azc-logout-button-bg-hover, rgba(255 255 255 / 10%));
    }
    *:focus-visible {
      outline: var(--focus-outline) var(--primary);
    }
    .animation {
      animation: 0.3s ease;
    }
    svg {
      fill: currentColor;
      width: 100%;
    }
    button {
      --button-bg-hover: var(--azc-button-bg-hover, color-mix(in srgb, var(--button-bg) 85%, white 15%));

      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-xs) var(--space-md);
      border: var(--button-border);
      background: var(--button-bg);
      color: var(--button-color);
      font-size: 1rem;
      border-radius: calc(var(--border-radius) / 2);
      outline: var(--focus-outline) transparent;
      transition: outline 0.3s ease;

      &:not(:disabled) {
        cursor: pointer;
      }
      &:disabled {
        color: var(--disabled-color);
      }
      &:hover:not(:disabled) {
        background: var(--button-bg-hover);
      }
    }
    .auth-status {
      display: flex;
      gap: var(--space-xs);
      align-items: center;
    }
    .container {
      display: flex;
      align-items: center;
    }
    .auth-login {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      gap: var(--space-xl);
    }
    .google-signin-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 44px;
    }
    .divider {
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 400px;
      margin: var(--space-md) 0;
      color: var(--disabled-color);
      font-size: 0.9rem;

      &::before,
      &::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--disabled-color);
      }

      span {
        padding: 0 var(--space-md);
      }
    }
    .login-form {
      padding: var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      width: 100%;
      max-width: 400px;

      label {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--text-color);
      }

      input[type="text"] {
        padding: var(--space-md);
        font-size: 1rem;
        border: 2px solid var(--bg);
        border-radius: calc(var(--border-radius) / 2);
        outline: none;
        transition: border-color 0.3s ease;

        &:focus {
          border-color: var(--primary);
        }
      }

      .login-button {
        --button-bg: var(--primary);
        --button-color: var(--text-invert-color);
        padding: var(--space-md);
        font-size: 1.1rem;
        font-weight: 500;
      }
    }
    .logout {
      background: var(--logout-button-bg);
      &:hover:not(:disabled) {
        background: var(--logout-button-bg-hover);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'azc-auth': AuthComponent;
  }
}
