import admin from 'firebase-admin';

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseAdminConfig),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error: any) {
    console.error('Firebase Admin initialization error', error.stack);
  }
}

export const messaging = admin.messaging();
export default admin;
