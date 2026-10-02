import nodemailer from 'nodemailer';

// Validar que temos a senha do SMTP configurada
if (!process.env.TITAN_EMAIL_PASSWORD) {
  console.error("❌ ERRO: Variável de ambiente TITAN_EMAIL_PASSWORD não configurada!");
}

const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",
  port: 587,
  secure: false, // usar STARTTLS
  auth: {
    user: "suporte@viraweb.online",
    pass: process.env.TITAN_EMAIL_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions) {
  // Validar campos obrigatórios
  if (!options.to || !options.subject || !options.html) {
    const error = new Error("Campos obrigatórios ausentes no envio de email");
    console.error("❌ Erro de validação:", {
      to: !!options.to,
      subject: !!options.subject,
      htmlLength: options.html?.length,
      textLength: options.text?.length,
      error
    });
    throw error;
  }

  try {
    // Log dos dados que serão enviados (sem informações sensíveis)
    console.log("📧 Tentando enviar email:", {
      to: options.to,
      subject: options.subject,
      htmlLength: options.html.length,
      textLength: options.text?.length
    });

    const info = await transporter.sendMail({
      from: '"Vira Web Odonto Suporte" <suporte@viraweb.online>',
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    });

    console.log("✅ Email enviado com sucesso:", {
      messageId: info.messageId,
      response: info.response,
      to: options.to
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Log detalhado do erro
    console.error("❌ Erro ao enviar email:", {
      error,
      to: options.to,
      subject: options.subject,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Converter erros do Nodemailer em mensagens amigáveis
    if (error instanceof Error) {
      if (error.message.includes('EAUTH')) {
        throw new Error('Falha na autenticação do email. Verifique as credenciais SMTP.');
      }
      if (error.message.includes('ETIMEDOUT')) {
        throw new Error('Tempo esgotado ao tentar enviar email. Verifique sua conexão com o servidor SMTP.');
      }
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Conexão recusada pelo servidor SMTP. Verifique as configurações de host e porta.');
      }
    }
    
    throw new Error('Erro ao enviar email. Por favor, tente novamente mais tarde.');
  }
}
