const { getFormexConnection } = require('../db-server/db-formex');

/**
 * Middleware que resuelve el frigorificoId basado en X-API-Key
 * Lee la API Key del header y busca el frigorífico correspondiente
 */
const resolveFrigorifico = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({ 
                error: 'missing_api_key',
                message: 'X-API-Key header is required' 
            });
        }

        const conn = getFormexConnection();
        if (!conn || conn.readyState !== 1) {
            throw new Error('No hay conexión activa a MongoDB');
        }

        const db = conn.useDb('formex');
        
        // Buscar el frigorífico por API Key
        const frigorifico = await db.collection('frigorificos').findOne({ 
            apiKey: apiKey 
        });

        if (!frigorifico) {
            return res.status(401).json({ 
                error: 'invalid_api_key',
                message: 'Invalid API Key' 
            });
        }

        // Agregar el frigorificoId al request para uso posterior
        req.frigorificoId = frigorifico._id;
        req.frigorifico = frigorifico;

        next();
    } catch (error) {
        console.error('Error in frigorifico resolver:', error);
        res.status(500).json({ 
            error: 'internal_error',
            message: 'Error resolving frigorifico' 
        });
    }
};

module.exports = { resolveFrigorifico };