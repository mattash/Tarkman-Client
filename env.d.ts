/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEFAULT_CHURCH_ID?: string;
  readonly VITE_ACTIONCABLE_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_TEST_EMAIL?: string;
  readonly VITE_TEST_PASSWORD?: string;
  readonly VITE_TEST_SESSION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
