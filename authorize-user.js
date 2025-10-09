const { getUsersConnection } = require('./db-server/db-config');
const { sendAuthorizationResult } = require('./auth/email-service');

async function authorizeUser() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('\nUso: node authorize-user.js <email> <action> [role]');
      console.log('Acciones: approve, reject');
      console.log('Roles (solo para approve): "3W", "Global Fresh", "Formex"');
      console.log('\nEjemplos:');
      console.log('node authorize-user.js user@example.com approve "3W"');
      console.log('node authorize-user.js user@example.com reject');
      process.exit(1);
    }

    const [email, action, role] = args;
    
    if (!['approve', 'reject'].includes(action)) {
      console.error('❌ Acción inválida. Use: approve o reject');
      process.exit(1);
    }

    if (action === 'approve' && !role) {
      console.error('❌ Debe especificar un rol para aprobar usuario');
      console.error('Roles disponibles: "3W", "Global Fresh", "Formex"');
      process.exit(1);
    }

    if (role && !['3W', 'Global Fresh', 'Formex'].includes(role)) {
      console.error('❌ Rol inválido. Roles disponibles: "3W", "Global Fresh", "Formex"');
      process.exit(1);
    }

    console.log(`\n🔄 Procesando autorización...`);
    console.log(`Email: ${email}`);
    console.log(`Acción: ${action}`);
    if (role) console.log(`Rol: ${role}`);

    // Conectar a la base de datos
    const db = await getUsersConnection();
    const User = db.collection('Users');

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ Usuario no encontrado: ${email}`);
      process.exit(1);
    }

    if (user.status !== 'pending') {
      console.error(`❌ El usuario ya fue procesado. Estado actual: ${user.status}`);
      process.exit(1);
    }

    // Actualizar usuario
    const updateData = {
      status: action === 'approve' ? 'active' : 'rejected',
      authorizedBy: 'admin-script',
      authorizationDate: new Date()
    };

    if (action === 'approve' && role) {
      updateData.role = role;
    }

    await User.updateOne({ _id: user._id }, { $set: updateData });

    // Enviar email de notificación
    try {
      await sendAuthorizationResult(
        email,
        action === 'approve',
        action === 'approve' ? role : null
      );
      console.log(`📧 Email de ${action === 'approve' ? 'aprobación' : 'rechazo'} enviado`);
    } catch (emailError) {
      console.warn(`⚠️  Usuario actualizado pero error enviando email:`, emailError.message);
    }

    console.log(`\n✅ Usuario ${action === 'approve' ? 'aprobado' : 'rechazado'} exitosamente`);
    console.log(`📧 ${email}`);
    console.log(`📊 Estado: ${updateData.status}`);
    if (updateData.role) console.log(`👤 Rol: ${updateData.role}`);
    console.log(`📅 Fecha: ${updateData.authorizationDate.toISOString()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  authorizeUser();
}

module.exports = { authorizeUser };