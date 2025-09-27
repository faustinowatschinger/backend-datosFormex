const fetch = require('node-fetch'); // npm install node-fetch

const API_URL = 'http://localhost:4001/api';
const API_KEY = 'test-api-key-12345';

async function testAPI() {
    console.log('🚀 Iniciando pruebas de la API de Mediciones\n');

    // Prueba 1: Insertar mediciones
    console.log('📤 PRUEBA 1: Insertar mediciones');
    
    const mediciones = [
        { camaraId: '17', temp: 2.5 },
        { camaraId: '18', temp: 3.2 },
        { camaraId: '19', temp: -1.8, ts: new Date().toISOString() },
        { camaraId: '20', temp: 0.5 }
    ];

    for (const medicion of mediciones) {
        try {
            const response = await fetch(`${API_URL}/mediciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(medicion)
            });

            const data = await response.json();
            
            if (response.ok) {
                console.log(`  ✅ Cámara ${medicion.camaraId}: ${medicion.temp}°C`);
            } else {
                console.log(`  ❌ Error Cámara ${medicion.camaraId}:`, data.error);
            }
        } catch (error) {
            console.log(`  ❌ Error de conexión Cámara ${medicion.camaraId}:`, error.message);
        }
    }

    // Prueba 2: Consultar todas las mediciones
    console.log('\n📊 PRUEBA 2: Consultar todas las mediciones');
    try {
        const response = await fetch(`${API_URL}/mediciones`, {
            headers: { 'X-API-Key': API_KEY }
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log(`  ✅ Total mediciones: ${data.data.length}`);
            console.log('  📋 Últimas mediciones:');
            data.data.forEach(m => {
                console.log(`    - Cámara ${m.camaraId}: ${m.temp}°C (${m.ts})`);
            });
        } else {
            console.log('  ❌ Error:', data.error);
        }
    } catch (error) {
        console.log('  ❌ Error de conexión:', error.message);
    }

    // Prueba 3: Consultar mediciones de cámara específica
    console.log('\n📊 PRUEBA 3: Consultar mediciones de cámara 17');
    try {
        const response = await fetch(`${API_URL}/mediciones?camaraId=17`, {
            headers: { 'X-API-Key': API_KEY }
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log(`  ✅ Mediciones de cámara 17: ${data.data.length}`);
            data.data.forEach(m => {
                console.log(`    - Temp: ${m.temp}°C (${m.ts})`);
            });
        } else {
            console.log('  ❌ Error:', data.error);
        }
    } catch (error) {
        console.log('  ❌ Error de conexión:', error.message);
    }

    // Prueba 4: Prueba de errores de validación
    console.log('\n❌ PRUEBA 4: Errores de validación');
    
    const casosError = [
        { caso: 'Sin camaraId', payload: { temp: 5.0 } },
        { caso: 'camaraId vacío', payload: { camaraId: '', temp: 5.0 } },
        { caso: 'temp inválida', payload: { camaraId: '17', temp: 'invalid' } },
        { caso: 'ts inválido', payload: { camaraId: '17', temp: 2.5, ts: 'invalid-date' } }
    ];

    for (const { caso, payload } of casosError) {
        try {
            const response = await fetch(`${API_URL}/mediciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log(`  🔍 ${caso}: Status ${response.status} - ${data.error}`);
        } catch (error) {
            console.log(`  ❌ ${caso}: Error de conexión`, error.message);
        }
    }

    // Prueba 5: Prueba sin API Key
    console.log('\n🔑 PRUEBA 5: Sin API Key');
    try {
        const response = await fetch(`${API_URL}/mediciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ camaraId: '17', temp: 2.5 })
        });

        const data = await response.json();
        console.log(`  🔍 Sin API Key: Status ${response.status} - ${data.error}`);
    } catch (error) {
        console.log('  ❌ Error de conexión:', error.message);
    }

    // Prueba 6: Prueba con API Key inválida
    console.log('\n🔑 PRUEBA 6: API Key inválida');
    try {
        const response = await fetch(`${API_URL}/mediciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'invalid-key'
            },
            body: JSON.stringify({ camaraId: '17', temp: 2.5 })
        });

        const data = await response.json();
        console.log(`  🔍 API Key inválida: Status ${response.status} - ${data.error}`);
    } catch (error) {
        console.log('  ❌ Error de conexión:', error.message);
    }

    console.log('\n🎉 Pruebas completadas');
}

// Ejecutar solo si este archivo es llamado directamente
if (require.main === module) {
    testAPI().catch(console.error);
}

module.exports = { testAPI };