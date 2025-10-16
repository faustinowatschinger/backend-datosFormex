// Intentar cargar nodemailer, si no está disponible usar versión mock
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  console.warn('⚠️  nodemailer no está instalado. Emails se simularán en consola.');
  nodemailer = null;
}

// Configuración del transporter de email
const createTransporter = () => {
  if (!nodemailer) {
    // Mock transporter cuando nodemailer no está disponible
    return {
      sendMail: async (mailOptions) => {
        console.log('📧 [EMAIL SIMULADO]');
        console.log('De:', mailOptions.from);
        console.log('Para:', mailOptions.to);
        console.log('Asunto:', mailOptions.subject);
        console.log('Texto:', mailOptions.text || '[sin texto]');
        console.log('HTML:', mailOptions.html ? '[html enviado]' : '[sin html]');
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }
  
  // Usar variables de entorno para configuración SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Emails de administradores desde variable de entorno (coma-separado)
const getAdminEmails = () => {
  const envList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (envList.length > 0) return envList;
  // Fallback a lista legacy si no viene por env
  return [
    'alejandro@3wsrl.com.ar',
    'esteban@3wsrl.com.ar',
    'adolfo@3wsrl.com.ar',
    'fatiwatschinger@gmail.com'
  ];
};

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const DASHBOARD_URL = process.env.APP_DASHBOARD_URL || process.env.BASE_URL || 'http://localhost:4000';

// Templates simples para nuevo usuario pendiente
function newUserPendingHtml(user, dashboardUrl) {
  const rows = Object.entries(user)
    .filter(([k]) => k !== 'password' && k !== 'passwordHash')
    .map(([key, val]) => `<tr><td style="padding:6px 8px"><b>${key}</b></td><td style="padding:6px 8px">${String(val ?? '')}</td></tr>`)
    .join('');

  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <h2>Nuevo usuario pendiente de verificación</h2>
    <p>Hay un nuevo registro en estado <b>PENDIENTE</b>. Detalles:</p>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${rows}
    </table>
  </div>`;
}

function newUserPendingText(user, dashboardUrl) {
  const lines = Object.entries(user)
    .filter(([k]) => k !== 'password' && k !== 'passwordHash')
    .map(([k, v]) => `${k}: ${v ?? ''}`)
    .join('\n');
  return `Nuevo usuario pendiente de verificación\n\n${lines}\n\nPanel: ${dashboardUrl}`;
}

// Enviar aviso a administradores al registrarse un usuario pendiente
// userInfo: { id, email, name?, phone?, company?, status?, createdAt? }
const sendAuthorizationRequest = async (userInfo) => {
  const transporter = createTransporter();
  const admins = getAdminEmails();

  const safeInfo = {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    phone: userInfo.phone,
    company: userInfo.company,
    status: userInfo.status,
    createdAt: userInfo.createdAt || new Date().toISOString()
  };

  const html = newUserPendingHtml(safeInfo, DASHBOARD_URL);
  const text = newUserPendingText(safeInfo, DASHBOARD_URL);

  const mailOptions = {
    from: FROM_EMAIL,
    to: admins,
    subject: '🔔 Nuevo usuario pendiente de verificación',
    html,
    text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de autorización enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando email de autorización:', error);
    return { success: false, error: error.message };
  }
};

const sendAuthorizationResult = async (userEmail, authorized, role, authorizedBy) => {
  const transporter = createTransporter();
  const approvedBy = authorizedBy || 'Administrador';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${authorized ? 'Acceso autorizado' : 'Solicitud rechazada'} - 3W PLC</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { 
          background: ${authorized ? '#4caf50' : '#f44336'}; 
          color: white; 
          padding: 20px; 
          text-align: center; 
          border-radius: 8px 8px 0 0; 
        }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${authorized ? '✅ Acceso autorizado' : '❌ Solicitud rechazada'}</h1>
          <p>Sistema 3W PLC</p>
        </div>
        <div class="content">
          ${authorized ? `
            <p>¡Felicitaciones! Tu solicitud de acceso ha sido autorizada.</p>
            <div class="info">
              <strong>Nivel de acceso otorgado:</strong> ${role}<br>
              <strong>Autorizado por:</strong> ${approvedBy}<br>
              <strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}
            </div>
            <p>Ya puedes iniciar sesión en la aplicación 3W PLC con tu email y contraseña.</p>
          ` : `
            <p>Lamentablemente, tu solicitud de acceso ha sido rechazada.</p>
            <div class="info">
              <strong>Rechazado por:</strong> ${approvedBy}<br>
              <strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}
            </div>
            <p>Si crees que esto es un error, por favor contacta al administrador del sistema.</p>
          `}
          
          <div class="footer">
            <p>Este email fue enviado automáticamente por el sistema 3W PLC.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: userEmail,
    subject: `3W PLC - ${authorized ? 'Acceso autorizado' : 'Solicitud rechazada'}`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de resultado enviado a ${userEmail}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando email de resultado:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendAuthorizationRequest,
  sendAuthorizationResult
};