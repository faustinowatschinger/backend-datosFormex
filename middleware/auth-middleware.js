const jwt = require('jsonwebtoken');
const { getUserModel } = require('../auth/modelo-user');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ msg: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información actualizada del usuario
    const User = getUserModel();
    const user = await User.findById(decoded.uid);
    
    if (!user) {
      return res.status(401).json({ msg: 'Usuario no encontrado' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ msg: 'Usuario no autorizado' });
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status
    };
    
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expirado' });
    }
    return res.status(403).json({ msg: 'Token inválido' });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ msg: 'Usuario no autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        msg: `Acceso denegado. Roles permitidos: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};

const requireAdmin = (req, res, next) => {
  // Para efectos de este sistema, consideramos que solo 3W puede ser admin
  return requireRole(['3W'])(req, res, next);
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin
};