const { getUsersConnection } = require('./db-server/db-config');
const bcrypt = require('bcryptjs');

async function createInitialAdmin() {
  try {
    const email = 'fatiwatschinger@gmail.com'; // Cambiar por tu email
    const password = 'TuPassword123!'; // Cambiar por tu contraseña
    
    console.log('🔧 Creando usuario administrador inicial...');
    
    // Conectar a la base de datos
    const db = await getUsersConnection();
    const User = db.collection('Users');
    
    // Verificar si ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('✅ El usuario admin ya existe:', email);
      console.log('📊 Estado:', existingUser.status);
      console.log('👤 Rol:', existingUser.role);
      return;
    }
    
    // Hash de la contraseña
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Crear usuario admin
    const adminUser = {
      email,
      passwordHash,
      status: 'active',
      role: '3W',
      createdAt: new Date(),
      authorizationDate: new Date(),
      authorizedBy: 'system-init'
    };
    
    await User.insertOne(adminUser);
    
    console.log('✅ Usuario administrador creado exitosamente:');
    console.log('📧 Email:', email);
    console.log('👤 Rol: 3W (Administrador completo)');
    console.log('📊 Estado: active');
    console.log('');
    console.log('🔑 Credenciales de login:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
    
  } catch (error) {
    console.error('❌ Error creando admin inicial:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createInitialAdmin();
}

module.exports = { createInitialAdmin };