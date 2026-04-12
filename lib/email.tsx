// Email notification utilities
// This is a placeholder implementation that logs emails
// In production, integrate with services like Resend, SendGrid, or AWS SES

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Re-export sendEmail from our SMTP implementation
export { sendEmail } from './email-sender';


export function generateAppointmentConfirmationEmail(data: {
  patientName: string
  professionalName: string
  date: string
  time: string
  clinicName: string
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; color: #6b7280; }
          .detail-value { color: #111827; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmação de Agendamento</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${data.patientName}</strong>,</p>
            <p>Seu agendamento foi confirmado com sucesso!</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Profissional:</span>
                <span class="detail-value">${data.professionalName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${new Date(data.date).toLocaleDateString("pt-BR")}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário:</span>
                <span class="detail-value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Local:</span>
                <span class="detail-value">${data.clinicName}</span>
              </div>
            </div>
            
            <p>Por favor, chegue com 10 minutos de antecedência.</p>
            <p>Se precisar remarcar ou cancelar, entre em contato conosco com pelo menos 24 horas de antecedência.</p>
            
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; 2026 ${data.clinicName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Confirmação de Agendamento

Olá ${data.patientName},

Seu agendamento foi confirmado com sucesso!

Detalhes:
- Profissional: ${data.professionalName}
- Data: ${new Date(data.date).toLocaleDateString("pt-BR")}
- Horário: ${data.time}
- Local: ${data.clinicName}

Por favor, chegue com 10 minutos de antecedência.
Se precisar remarcar ou cancelar, entre em contato conosco com pelo menos 24 horas de antecedência.

Este é um email automático, por favor não responda.
© 2026 ${data.clinicName}. Todos os direitos reservados.
  `

  return { html, text }
}

export function generateAppointmentReminderEmail(data: {
  patientName: string
  professionalName: string
  date: string
  time: string
  clinicName: string
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; color: #6b7280; }
          .detail-value { color: #111827; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lembrete de Consulta</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${data.patientName}</strong>,</p>
            
            <div class="alert">
              <strong>⏰ Lembrete:</strong> Você tem uma consulta agendada para amanhã!
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Profissional:</span>
                <span class="detail-value">${data.professionalName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${new Date(data.date).toLocaleDateString("pt-BR")}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário:</span>
                <span class="detail-value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Local:</span>
                <span class="detail-value">${data.clinicName}</span>
              </div>
            </div>
            
            <p>Não esqueça de chegar com 10 minutos de antecedência.</p>
            <p>Caso não possa comparecer, por favor nos avise com antecedência.</p>
            
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; 2026 ${data.clinicName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Lembrete de Consulta

Olá ${data.patientName},

⏰ Lembrete: Você tem uma consulta agendada para amanhã!

Detalhes:
- Profissional: ${data.professionalName}
- Data: ${new Date(data.date).toLocaleDateString("pt-BR")}
- Horário: ${data.time}
- Local: ${data.clinicName}

Não esqueça de chegar com 10 minutos de antecedência.
Caso não possa comparecer, por favor nos avise com antecedência.

Este é um email automático, por favor não responda.
© 2026 ${data.clinicName}. Todos os direitos reservados.
  `

  return { html, text }
}

export function generatePaymentReminderEmail(data: {
  patientName: string
  amount: number
  dueDate: string
  clinicName: string
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .amount { font-size: 32px; font-weight: bold; color: #ef4444; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lembrete de Pagamento</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${data.patientName}</strong>,</p>
            
            <div class="alert">
              <strong>💳 Atenção:</strong> Você possui um pagamento pendente.
            </div>
            
            <div class="amount">
              R$ ${data.amount.toFixed(2).replace(".", ",")}
            </div>
            
            <p><strong>Vencimento:</strong> ${new Date(data.dueDate).toLocaleDateString("pt-BR")}</p>
            
            <p>Por favor, regularize sua situação o quanto antes para continuar recebendo nossos serviços.</p>
            <p>Se você já realizou o pagamento, por favor desconsidere este email.</p>
            
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; 2026 ${data.clinicName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Lembrete de Pagamento

Olá ${data.patientName},

💳 Atenção: Você possui um pagamento pendente.

Valor: R$ ${data.amount.toFixed(2).replace(".", ",")}
Vencimento: ${new Date(data.dueDate).toLocaleDateString("pt-BR")}

Por favor, regularize sua situação o quanto antes para continuar recebendo nossos serviços.
Se você já realizou o pagamento, por favor desconsidere este email.

Este é um email automático, por favor não responda.
© 2026 ${data.clinicName}. Todos os direitos reservados.
  `

  return { html, text }
}

export function generateWelcomeEmail(data: { userName: string; userEmail: string; clinicName: string }) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .feature { padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .feature:last-child { border-bottom: none; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo ao ${data.clinicName}!</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${data.userName}</strong>,</p>
            <p>Estamos muito felizes em tê-lo(a) conosco! Sua conta foi criada com sucesso.</p>
            
            <div class="features">
              <div class="feature">
                <strong>📅 Agendamentos</strong><br>
                Gerencie seus agendamentos de forma fácil e rápida
              </div>
              <div class="feature">
                <strong>👥 clientes</strong><br>
                Mantenha o histórico completo de seus clientes
              </div>
              <div class="feature">
                <strong>📊 Relatórios</strong><br>
                Acompanhe o desempenho da sua clínica
              </div>
              <div class="feature">
                <strong>🔔 Notificações</strong><br>
                Receba lembretes automáticos de consultas
              </div>
            </div>
            
            <p>Comece agora mesmo a explorar todas as funcionalidades da plataforma!</p>
            
            <div class="footer">
              <p>Se você tiver alguma dúvida, não hesite em nos contatar.</p>
              <p>&copy; 2026 ${data.clinicName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Bem-vindo ao ${data.clinicName}!

Olá ${data.userName},

Estamos muito felizes em tê-lo(a) conosco! Sua conta foi criada com sucesso.

Recursos disponíveis:
- 📅 Agendamentos: Gerencie seus agendamentos de forma fácil e rápida
- 👥 clientes: Mantenha o histórico completo de seus clientes
- 📊 Relatórios: Acompanhe o desempenho da sua clínica
- 🔔 Notificações: Receba lembretes automáticos de consultas

Comece agora mesmo a explorar todas as funcionalidades da plataforma!

Se você tiver alguma dúvida, não hesite em nos contatar.
© 2026 ${data.clinicName}. Todos os direitos reservados.
  `

  return { html, text }
}

export function generateSupportTicketEmail(data: {
  ticketId: string
  subject: string
  message: string
  userEmail: string
  priority: string
}) {
  const priorityColors = {
    low: "#6b7280",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  }

  const priorityColor = priorityColors[data.priority as keyof typeof priorityColors] || priorityColors.medium

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-label { font-weight: bold; color: #6b7280; }
          .info-value { color: #111827; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; background: ${priorityColor}; }
          .message-box { background: #f3f4f6; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Novo Ticket de Suporte</h1>
          </div>
          <div class="content">
            <p>Um novo ticket de suporte foi criado:</p>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="info-label">ID do Ticket:</span>
                <span class="info-value">#${data.ticketId.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Usuário:</span>
                <span class="info-value">${data.userEmail}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Assunto:</span>
                <span class="info-value">${data.subject}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Prioridade:</span>
                <span class="priority-badge">${data.priority.toUpperCase()}</span>
              </div>
            </div>
            
            <h3>Mensagem:</h3>
            <div class="message-box">
              ${data.message}
            </div>
            
            <p><strong>Ação necessária:</strong> Por favor, responda este ticket o mais rápido possível através do painel administrativo.</p>
            
            <div class="footer">
              <p>Este é um email automático do sistema de suporte ViraWeb.</p>
              <p>&copy; 2026 ViraWeb. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Novo Ticket de Suporte

ID do Ticket: #${data.ticketId.substring(0, 8)}
Usuário: ${data.userEmail}
Assunto: ${data.subject}
Prioridade: ${data.priority.toUpperCase()}

Mensagem:
${data.message}

Ação necessária: Por favor, responda este ticket o mais rápido possível através do painel administrativo.

Este é um email automático do sistema de suporte ViraWeb.
© 2026 ViraWeb. Todos os direitos reservados.
  `

  return { html, text }
}

export function generateSupportReplyEmail(data: {
  ticketId: string
  ticketSubject: string
  message: string
  userEmail: string
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-label { font-weight: bold; color: #6b7280; }
          .info-value { color: #111827; }
          .message-box { background: #dbeafe; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Nova Resposta no Ticket</h1>
          </div>
          <div class="content">
            <p>O usuário respondeu ao ticket de suporte:</p>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="info-label">ID do Ticket:</span>
                <span class="info-value">#${data.ticketId.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Usuário:</span>
                <span class="info-value">${data.userEmail}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Assunto:</span>
                <span class="info-value">${data.ticketSubject}</span>
              </div>
            </div>
            
            <h3>Nova Mensagem:</h3>
            <div class="message-box">
              ${data.message}
            </div>
            
            <p><strong>Ação necessária:</strong> Por favor, responda esta mensagem através do painel administrativo.</p>
            
            <div class="footer">
              <p>Este é um email automático do sistema de suporte ViraWeb.</p>
              <p>&copy; 2026 ViraWeb. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Nova Resposta no Ticket

ID do Ticket: #${data.ticketId.substring(0, 8)}
Usuário: ${data.userEmail}
Assunto: ${data.ticketSubject}

Nova Mensagem:
${data.message}

Ação necessária: Por favor, responda esta mensagem através do painel administrativo.

Este é um email automático do sistema de suporte ViraWeb.
© 2026 ViraWeb. Todos os rights reserved.
  `

  return { html, text }
}
