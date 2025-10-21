const admin = require('firebase-admin');
const prisma = require('../config/database');

// Initialize Firebase Admin
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (!firebaseInitialized && process.env.FIREBASE_PROJECT_ID) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      firebaseInitialized = true;
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization error:', error.message);
    }
  }
};

const sendPushNotification = async (fcmToken, notification) => {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return null;
  }

  const message = {
    token: fcmToken,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Send to multiple devices
const sendToMultipleDevices = async (userId, notification) => {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notifications');
    return [];
  }

  const tokens = await prisma.fcmToken.findMany({
    where: { user_id: userId },
    select: { token: true },
  });

  const promises = tokens.map((t) =>
    sendPushNotification(t.token, notification)
  );

  return Promise.allSettled(promises);
};

module.exports = { initializeFirebase, sendPushNotification, sendToMultipleDevices };
