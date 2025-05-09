const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User     = require('./modelo-user');

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

    // ¿Existe?
    if (await User.findOne({ email })) {
      return res.status(409).json({ msg: 'Email ya registrado' });
    }

    // Hashear
    const passwordHash = await bcrypt.hash(password, saltRounds);
    await User.create({ email, passwordHash });

    res.status(201).json({ msg: 'Usuario creado' });
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
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

    // Firmar JWT
    const token = jwt.sign(
      { uid: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );
    res.json({ token });
  }
);

module.exports = router;
