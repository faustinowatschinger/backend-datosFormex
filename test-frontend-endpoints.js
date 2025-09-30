require('dotenv').config();
// Compatibilidad node-fetch según versión de Node. Usar import dinámico si es ESM.
let fetchFn;
try {
    fetchFn = require('node-fetch');
    // node-fetch v2 exporta función directamente, v3 exporta como ESM
    if (fetchFn.default) fetchFn = fetchFn.default;
} catch (e) {
    fetchFn = (...args) => import('node-fetch').then(({default: f}) => f(...args));
}
const fetch = (...args) => fetchFn(...args);

const API_URL = 'http://localhost:4000/api';
const TEST_USER = {
    email: 'test@example.com',
    password: 'testpass123'
};

/**
 * Script para probar los nuevos endpoints del frontend
 */
async function testFrontendEndpoints() {
    console.log('🚀 Iniciando pruebas de endpoints del frontend\n');

    try {
        // 1. Login para obtener token
        console.log('🔑 PASO 1: Autenticación');
        
        const loginResp = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        let token;
        if (loginResp.ok) {
            const loginData = await loginResp.json();
            token = loginData.token;
            console.log('✅ Login exitoso');
        } else {
            // Si falla el login, intentar registrar primero
            console.log('⚠️ Login falló, intentando registrar usuario...');
            
            const registerResp = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(TEST_USER)
            });

            if (registerResp.ok) {
                console.log('✅ Usuario registrado');
                
                // Intentar login nuevamente
                const loginResp2 = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(TEST_USER)
                });

                if (loginResp2.ok) {
                    const loginData2 = await loginResp2.json();
                    token = loginData2.token;
                    console.log('✅ Login exitoso después del registro');
                } else {
                    throw new Error('No se pudo hacer login después del registro');
                }
            } else {
                const regError = await registerResp.json();
                throw new Error(`Error en registro: ${regError.msg || regError.message}`);
            }
        }

        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Probar endpoint de cámaras
        console.log('\n📊 PASO 2: Obtener lista de cámaras');
        
        // Probar nueva API
        try {
            const camarasResp = await fetch(`${API_URL}/data/mediciones`, {
                headers: authHeaders
            });

            if (camarasResp.ok) {
                const camarasData = await camarasResp.json();
                console.log(`✅ Nueva API de mediciones: ${camarasData.length} cámaras encontradas`);
                
                if (camarasData.length > 0) {
                    console.log(`   📋 Cámaras disponibles: ${camarasData.map(c => c.id).join(', ')}`);
                    
                    // Probar con la primera cámara
                    const primeraCamara = camarasData[0];
                    
                    // 3. Probar fechas de cámara
                    console.log(`\n📅 PASO 3: Obtener fechas para cámara ${primeraCamara.id}`);
                    
                    const fechasResp = await fetch(`${API_URL}/data/mediciones/camera/${primeraCamara.id}/dates`, {
                        headers: authHeaders
                    });

                    if (fechasResp.ok) {
                        const fechas = await fechasResp.json();
                        console.log(`✅ Fechas obtenidas: ${fechas.length} días disponibles`);
                        
                        if (fechas.length > 0) {
                            console.log(`   📅 Rango: ${fechas[0]} a ${fechas[fechas.length - 1]}`);
                            
                            // 4. Probar datos de cámara
                            console.log(`\n📈 PASO 4: Obtener datos para cámara ${primeraCamara.id}`);
                            
                            const datosResp = await fetch(`${API_URL}/data/mediciones/camera/${primeraCamara.id}?date=${fechas[fechas.length - 1]}`, {
                                headers: authHeaders
                            });

                            if (datosResp.ok) {
                                const datos = await datosResp.json();
                                console.log(`✅ Datos obtenidos: ${datos.docs.length} mediciones`);
                                if (datos.variables) {
                                    console.log(`   🏷️  Variables detectadas (${datos.variables.length}): ${datos.variables.slice(0,15).join(', ')}${datos.variables.length>15?' ...':''}`);
                                }
                                
                                if (datos.docs.length > 0) {
                                    const primerMedicion = datos.docs[0];
                                    console.log(`   📊 Primer registro: ${primerMedicion.timestamp}`);
                                    console.log(`   🌡️  TA1: ${primerMedicion.data.TA1}°C`);
                                    console.log(`   💨 Hum: ${primerMedicion.data.Hum}%`);
                                }
                            } else {
                                const error = await datosResp.json();
                                console.log(`❌ Error obteniendo datos: ${error.msg}`);
                            }
                        }
                    } else {
                        const error = await fechasResp.json();
                        console.log(`❌ Error obteniendo fechas: ${error.msg}`);
                    }
                }
            } else {
                const error = await camarasResp.json();
                console.log(`❌ Error en nueva API: ${error.error || error.message}`);
            }
        } catch (error) {
            console.log(`❌ Error conectando a nueva API: ${error.message}`);
        }

        // 5. Probar API antigua como comparación
        console.log('\n🔄 PASO 5: Probar API antigua (FormexCam)');
        
        try {
            const camarasAntiguaResp = await fetch(`${API_URL}/data`, {
                headers: authHeaders
            });

            if (camarasAntiguaResp.ok) {
                const camarasAntiguaData = await camarasAntiguaResp.json();
                console.log(`📊 API antigua: ${camarasAntiguaData.length} cámaras encontradas`);
                
                if (camarasAntiguaData.length > 0) {
                    console.log(`   📋 Cámaras FormexCam: ${camarasAntiguaData.map(c => c.id).join(', ')}`);
                }
            } else {
                const error = await camarasAntiguaResp.json();
                console.log(`❌ API antigua también falló: ${error.message}`);
            }
        } catch (error) {
            console.log(`❌ Error conectando a API antigua: ${error.message}`);
        }

        console.log('\n🎉 Pruebas completadas');

    } catch (error) {
        console.error('\n❌ Error en pruebas:', error.message);
        process.exit(1);
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    testFrontendEndpoints().catch(console.error);
}

module.exports = { testFrontendEndpoints };