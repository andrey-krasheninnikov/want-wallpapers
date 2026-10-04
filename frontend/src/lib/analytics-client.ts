import { getApps, initializeApp } from 'firebase/app';
export const app = getApps()[0] ?? initializeApp({
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
});
