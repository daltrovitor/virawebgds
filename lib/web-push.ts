import webPush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:example@yourdomain.com';

if (publicKey && privateKey) {
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export default webPush;
