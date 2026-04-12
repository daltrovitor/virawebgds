require('@next/env').loadEnvConfig(process.cwd());
const { sendNotification } = require('../lib/notifications.ts');

async function testPush() {
  console.log('Sending notification...');
  const userId = '028663d4-7929-49fa-bd46-b0ce52c0c339'; // Admin id
  const result1 = await sendNotification(userId, {
    title: '🎫 Novo Ticket Criado: TESTE',
    body: 'Teste de debug\nPrioridade: BAIXA',
    url: 'https://admin.viraweb.online/admin?tab=support'
  });
  console.log('Result 1:', result1);

  const userId2 = '734f20f8-b9b5-4024-834e-86b85820fec7'; // Other admin id
  const result2 = await sendNotification(userId2, {
    title: '🎫 Novo Ticket Criado: TESTE 2',
    body: 'Teste de debug\nPrioridade: BAIXA',
    url: 'https://admin.viraweb.online/admin?tab=support'
  });
  console.log('Result 2:', result2);
}

testPush();
