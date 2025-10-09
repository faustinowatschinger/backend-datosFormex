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
        console.log('Para:', mailOptions.to);
        console.log('Asunto:', mailOptions.subject);
        console.log('Contenido:', mailOptions.text || 'HTML content');
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }
  
  // Usar variables de entorno para configuración SMTP
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const adminEmails = [
  'alejandro@3wsrl.com.ar',
  'esteban@3wsrl.com.ar',
  'adolfo@3wsrl.com.ar',
  'fatiwatschinger@gmail.com'
];

const sendAuthorizationRequest = async (userEmail, userId) => {
  const transporter = createTransporter();
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Nueva solicitud de autorización - 3W PLC</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0087a9; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .user-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .buttons { margin: 20px 0; }
        .btn { 
          display: inline-block; 
          padding: 12px 24px; 
          margin: 8px 4px; 
          text-decoration: none; 
          border-radius: 5px;
          font-weight: bold;
          text-align: center;
        }
        .btn-reject { background: #f44336; color: white; }
        .btn-3w { background: #2196f3; color: white; }
        .btn-global { background: #4caf50; color: white; }
        .btn-formex { background: #ff9800; color: white; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nueva solicitud de autorización</h1>
          <p>Sistema 3W PLC</p>
        </div>
        <div class="content">
          <p>Se ha registrado un nuevo usuario que requiere autorización:</p>
          
          <div class="user-info">
            <strong>Email del solicitante:</strong> ${userEmail}<br>
            <strong>Fecha de registro:</strong> ${new Date().toLocaleString('es-AR')}
          </div>
          
          <p>Selecciona el nivel de autorización que deseas otorgar:</p>
          
          <div class="buttons">
            <a href="${baseUrl}/api/auth/authorize/${userId}?action=reject" class="btn btn-reject">
              ❌ No autorizar
            </a>
            <a href="${baseUrl}/api/auth/authorize/${userId}?action=authorize&role=3W" class="btn btn-3w">
              🔧 Autorizar 3W
            </a>
            <a href="${baseUrl}/api/auth/authorize/${userId}?action=authorize&role=Global Fresh" class="btn btn-global">
              🏢 Autorizar Global Fresh
            </a>
            <a href="${baseUrl}/api/auth/authorize/${userId}?action=authorize&role=Formex" class="btn btn-formex">
              🧊 Autorizar Formex
            </a>
          </div>
          
          <div class="footer">
            <p>Este email fue enviado automáticamente por el sistema 3W PLC.</p>
            <p>Si no reconoces esta solicitud, puedes ignorar este email o contactar al administrador.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: adminEmails.join(','),
    subject: `Nueva solicitud de autorización - ${userEmail}`,
    html: htmlContent
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
              <strong>Autorizado por:</strong> ${authorizedBy}<br>
              <strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}
            </div>
            <p>Ya puedes iniciar sesión en la aplicación 3W PLC con tu email y contraseña.</p>
          ` : `
            <p>Lamentablemente, tu solicitud de acceso ha sido rechazada.</p>
            <div class="info">
              <strong>Rechazado por:</strong> ${authorizedBy}<br>
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