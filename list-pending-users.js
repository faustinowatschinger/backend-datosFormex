// Script para listar usuarios pendientes y todos los usuarios
require('dotenv').config();

async function listPendingUsers() {
  try {
    console.log('\n🔍 Buscando usuarios pendientes de autorización...\n');

    // Conectar a la base de datos
    const { connectUsersDB } = require('./auth/db-users');
    await connectUsersDB();
    
    const getUserModel = require('./auth/modelo-user');
    const User = getUserModel();

    // Obtener usuarios pendientes
    const pendingUsers = await User.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    if (pendingUsers.length === 0) {
      console.log('✅ No hay usuarios pendientes de autorización\n');
      return;
    }

    console.log(`📋 Usuarios pendientes (${pendingUsers.length}):\n`);
    console.log('━'.repeat(80));

    pendingUsers.forEach((user, index) => {
      const fecha = user.createdAt ? new Date(user.createdAt).toLocaleString('es-ES') : 'No disponible';
      console.log(`${index + 1}. 📧 ${user.email}`);
      console.log(`   📅 Registrado: ${fecha}`);
      console.log(`   🆔 ID: ${user._id}`);
      console.log('   ─'.repeat(40));
    });

    console.log('\n📝 Para autorizar un usuario, use:');
    console.log('   node authorize-user.js <email> approve "<rol>"');
    console.log('   node authorize-user.js <email> reject');
    
    console.log('\n🎭 Roles disponibles: "3W", "Global Fresh", "Formex", "Valletana", "PIN"');
    console.log('\n💡 Ejemplo:');
    console.log(`   node authorize-user.js ${pendingUsers[0]?.email || 'user@example.com'} approve "3W"`);

  } catch (error) {
    console.error('❌ Error obteniendo usuarios pendientes:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

async function listAllUsers() {
  try {
    console.log('\n👥 Lista de todos los usuarios:\n');

    // Conectar a la base de datos
    const { connectUsersDB } = require('./auth/db-users');
    await connectUsersDB();
    
    const getUserModel = require('./auth/modelo-user');
    const User = getUserModel();

    // Obtener todos los usuarios
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .lean();

    if (users.length === 0) {
      console.log('📭 No hay usuarios registrados\n');
      return;
    }

    console.log(`📊 Total de usuarios: ${users.length}\n`);
    console.log('━'.repeat(100));

    const statusIcons = {
      'pending': '⏳',
      'active': '✅',
      'rejected': '❌'
    };

    users.forEach((user, index) => {
      const fecha = user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : 'N/A';
      const authDate = user.authorizationDate ? new Date(user.authorizationDate).toLocaleDateString('es-ES') : 'N/A';
      const icon = statusIcons[user.status] || '❓';
      
      console.log(`${index + 1}. ${icon} ${user.email}`);
      console.log(`   📊 Estado: ${user.status || 'indefinido'}`);
      console.log(`   👤 Rol: ${user.role || 'sin asignar'}`);
      console.log(`   📅 Registro: ${fecha}`);
      if (user.authorizationDate) {
        console.log(`   ✓ Autorizado: ${authDate} por ${user.authorizedBy || 'N/A'}`);
      }
      console.log('   ─'.repeat(50));
    });

    // Estadísticas
    const stats = users.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📈 Estadísticas:');
    Object.entries(stats).forEach(([status, count]) => {
      const icon = statusIcons[status] || '❓';
      console.log(`   ${icon} ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Determinar qué función ejecutar según argumentos
const command = process.argv[2];

if (command === 'all') {
  listAllUsers();
} else {
  listPendingUsers();
}

module.exports = { listPendingUsers, listAllUsers };
