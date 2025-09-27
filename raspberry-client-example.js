/**
 * Script de ejemplo para Raspberry Pi
 * Envía mediciones a la nueva API unificada
 */

const fetch = require('node-fetch'); // npm install node-fetch

const API_URL = 'http://your-server:4000/api';
const API_KEY = 'your-api-key-here'; // Reemplazar con la API Key del frigorífico

/**
 * Envía una medición al servidor
 * @param {string} camaraId - ID de la cámara (ej: "17", "18", "19", "20")
 * @param {number} temp - Temperatura medida
 * @param {Date|number} ts - Timestamp opcional (si no se proporciona, usa la fecha actual)
 */
async function enviarMedicion(camaraId, temp, ts = null) {
    const payload = {
        camaraId,
        temp
    };

    // Agregar timestamp si se proporciona
    if (ts) {
        payload.ts = ts instanceof Date ? ts.toISOString() : ts;
    }

    try {
        console.log(`📤 Enviando medición: Cámara ${camaraId}, Temp: ${temp}°C`);
        
        const response = await fetch(`${API_URL}/mediciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Medición enviada exitosamente:', data);
            return true;
        } else if (response.status === 409 && data.error === 'duplicate_ts') {
            console.log('⚠️ Timestamp duplicado, reintentando sin timestamp...');
            
            // Reintentar sin timestamp (usará fecha del servidor)
            const payloadSinTs = { camaraId, temp };
            
            const retryResponse = await fetch(`${API_URL}/mediciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(payloadSinTs)
            });

            const retryData = await retryResponse.json();
            
            if (retryResponse.ok) {
                console.log('✅ Medición enviada exitosamente (reintento):', retryData);
                return true;
            } else {
                console.error('❌ Error en reintento:', retryData);
                return false;
            }
        } else {
            console.error('❌ Error enviando medición:', data);
            return false;
        }

    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
}

/**
 * Consulta mediciones del servidor
 * @param {string} camaraId - ID de la cámara (opcional)
 * @param {string} from - Fecha desde (ISO string, opcional)
 * @param {string} to - Fecha hasta (ISO string, opcional)
 * @param {number} limit - Límite de registros (opcional, default: 10)
 */
async function consultarMediciones(camaraId = null, from = null, to = null, limit = 10) {
    try {
        const params = new URLSearchParams();
        if (camaraId) params.append('camaraId', camaraId);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        if (limit) params.append('limit', limit.toString());

        const response = await fetch(`${API_URL}/mediciones?${params}`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('📊 Mediciones obtenidas:', data);
            return data;
        } else {
            console.error('❌ Error consultando mediciones:', data);
            return null;
        }

    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return null;
    }
}

/**
 * Función principal de ejemplo
 */
async function main() {
    console.log('🚀 Iniciando script de ejemplo para Raspberry Pi');

    // Ejemplo: Enviar mediciones de diferentes cámaras
    await enviarMedicion('17', 2.5);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
    
    await enviarMedicion('18', 3.2);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await enviarMedicion('19', -1.8);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await enviarMedicion('20', 0.5);

    // Ejemplo: Consultar las últimas mediciones
    console.log('\n📊 Consultando últimas mediciones...');
    await consultarMediciones(null, null, null, 5);

    // Ejemplo: Consultar mediciones de una cámara específica
    console.log('\n📊 Consultando mediciones de cámara 17...');
    await consultarMediciones('17', null, null, 3);
}

// Exportar funciones para uso en otros scripts
module.exports = {
    enviarMedicion,
    consultarMediciones
};

// Ejecutar ejemplo si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}