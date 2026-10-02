import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = getApps().length ? getApp() : initializeApp(config);
if (typeof window !== 'undefined' && import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
export const db = getFirestore(app);
if (typeof window !== 'undefined' && import.meta.env.PUBLIC_USE_FIREBASE_EMULATORS === 'true' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
}

export async function currentUser() {
  const auth = getAuth(app);
  await auth.authStateReady();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}
