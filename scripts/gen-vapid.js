const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();

console.log("=========================================");
console.log("VAPID Keys Generated successfully!");
console.log("=========================================");
console.log("");
console.log("Public Key:");
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + vapidKeys.publicKey);
console.log("");
console.log("Private Key:");
console.log("VAPID_PRIVATE_KEY=" + vapidKeys.privateKey);
console.log("");
console.log("=========================================");
console.log("Save these in your .env file!");
