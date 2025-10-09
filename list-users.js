// Simple script to list users from the Users database
// Uses existing connection logic and User model

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { connectUsersDB, usersConnection } = require('./auth/db-users');
const getUserModel = require('./auth/modelo-user');

async function main() {
  try {
    if (!process.env.MONGODB_URI_USERS) {
      throw new Error('Falta la variable MONGODB_URI_USERS en backend-app/.env');
    }

    await connectUsersDB();

    const User = getUserModel();

    const total = await User.countDocuments();
    console.log(`Usuarios totales: ${total}`);

    const users = await User.find({}).sort({ createdAt: 1 }).lean();

    if (!users.length) {
      console.log('No hay usuarios en la colección.');
    } else {
      console.log('Listado de usuarios (sin passwordHash):');
      for (const u of users) {
        const out = {
          _id: u._id,
          email: u.email,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        };
        console.log(out);
      }
    }
  } catch (err) {
    console.error('Error listando usuarios:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (usersConnection) {
        await usersConnection.close();
      }
    } catch (e) {
      // ignore close errors
    }
  }
}

main();
