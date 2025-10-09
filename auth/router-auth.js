const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const getUserModel = require('./modelo-user');
const { sendAuthorizationRequest, sendAuthorizationResult } = require('./email-service');
const { authenticateToken, requireAdmin } = require('../middleware/auth-middleware');

const router = express.Router();
const saltRounds = 12;

/* ── Registro ───────────────────────── */
router.post('/register',
  // Validaciones
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const User = getUserModel();

    // ¿Existe?
    if (await User.findOne({ email })) {
      return res.status(409).json({ msg: 'Email ya registrado' });
    }

    // Hashear
    const passwordHash = await bcrypt.hash(password, saltRounds);
    // Por ahora hacer usuarios directamente activos hasta configurar emails
    const newUser = await User.create({ 
      email, 
      passwordHash, 
      status: 'active', // Cambiar a 'pending' cuando emails estén configurados
      role: 'Global Fresh' // Rol por defecto
    });

    // Enviar email de autorización a administradores (opcional)
    try {
      await sendAuthorizationRequest(email, newUser._id);
      console.log(`📧 Email de autorización enviado para usuario: ${email}`);
    } catch (error) {
      console.warn('⚠️  Error enviando email de autorización:', error.message);
      // No fallar el registro si el email falla
    }

    res.status(201).json({ 
      msg: 'Usuario registrado exitosamente.',
      status: 'active'
    });
  }
);

/* ── Login ──────────────────────────── */
router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const User = getUserModel();
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

    // Verificar estado del usuario
    if (user.status === 'pending') {
      return res.status(403).json({ 
        msg: 'Tu cuenta está pendiente de autorización. Espera a que 3W apruebe tu acceso.',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ 
        msg: 'Tu cuenta ha sido rechazada. Contacta al administrador.',
        status: 'rejected'
      });
    }

    // Solo usuarios con status 'active' pueden hacer login
    if (user.status !== 'active') {
      return res.status(403).json({ msg: 'Cuenta no autorizada' });
    }

    // Firmar JWT con rol incluido
    const token = jwt.sign(
      { uid: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        status: user.status 
      } 
    });
  }
);

// Endpoint para listar users pendientes de autorización (solo admin)
router.get('/pending-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const User = getUserModel();
    const pendingUsers = await User.find({ status: 'pending' })
      .select('email createdAt authorizedBy requestDate')
      .sort({ createdAt: -1 });
    
    res.json(pendingUsers);
  } catch (error) {
    console.error('Error obteniendo usuarios pendientes:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Endpoint para autorizar usuario
router.post('/authorize-user', authenticateToken, requireAdmin, [
  body('userId').notEmpty(),
  body('action').isIn(['approve', 'reject']),
  body('role').optional().isIn(['3W', 'Global Fresh', 'Formex'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId, action, role } = req.body;
    const User = getUserModel();
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({ msg: 'El usuario ya fue procesado' });
    }

    let updateData = {
      status: action === 'approve' ? 'active' : 'rejected',
      authorizedBy: req.user.email, // Usar el email del admin autenticado
      authorizationDate: new Date()
    };

    if (action === 'approve' && role) {
      updateData.role = role;
    }

    await User.findByIdAndUpdate(userId, updateData);

    // Enviar email de notificación al usuario
    try {
      await sendAuthorizationResult(
        user.email, 
        action === 'approve', 
        action === 'approve' ? role : null
      );
      console.log(`Email de ${action === 'approve' ? 'aprobación' : 'rechazo'} enviado a: ${user.email}`);
    } catch (error) {
      console.error('Error enviando email de resultado:', error);
    }

    res.json({ 
      msg: `Usuario ${action === 'approve' ? 'aprobado' : 'rechazado'} exitosamente`,
      user: { id: user._id, email: user.email, status: updateData.status, role: updateData.role }
    });

  } catch (error) {
    console.error('Error autorizando usuario:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Endpoint para obtener todos los usuarios (admin)
router.get('/all-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const User = getUserModel();
    const users = await User.find({})
      .select('email status role createdAt authorizedBy authorizationDate')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});
 
 module.exports = router;
