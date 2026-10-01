import admin from 'firebase-admin';

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    if (firebaseAdminConfig.projectId && firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(firebaseAdminConfig),
        });
        console.log('Firebase Admin initialized successfully');
      } catch (error: any) {
        console.error('Firebase Admin initialization error', error.stack);
      }
    }
  }
  return admin;
}

export const messaging = {
  sendEachForMulticast: async (...args: any[]) => {
    const fb = getFirebaseAdmin();
    if (!fb.apps.length) {
      console.warn('Firebase Admin not initialized, skipping push notifications.');
      return { responses: [], successCount: 0, failureCount: 0 };
    }
    return (fb.messaging() as any).sendEachForMulticast(...args);
  },
  send: async (...args: any[]) => {
    const fb = getFirebaseAdmin();
    if (!fb.apps.length) {
      console.warn('Firebase Admin not initialized, skipping push notifications.');
      return null;
    }
    return (fb.messaging() as any).send(...args);
  }
};

export default admin;
