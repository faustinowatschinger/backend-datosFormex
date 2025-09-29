const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
    try {
        console.log('🔬 Probando endpoints de la API...');
        
        // Test endpoint de cámaras
        console.log('\n1️⃣ Probando /api/camaras...');
        const camarasResponse = await axios.get(`${BASE_URL}/api/camaras`);
        console.log(`   ✅ Status: ${camarasResponse.status}`);
        console.log(`   📊 Cámaras encontradas: ${camarasResponse.data?.length || 0}`);
        
        if (camarasResponse.data && camarasResponse.data.length > 0) {
            const primeraCamara = camarasResponse.data[0];
            console.log(`   📝 Primera cámara: ID=${primeraCamara.camaraId}, Temp=${primeraCamara.temperatura}°C`);
            
            // Test endpoint de mediciones por cámara
            console.log(`\n2️⃣ Probando /api/mediciones/camara/${primeraCamara.camaraId}...`);
            const medicionesResponse = await axios.get(`${BASE_URL}/api/mediciones/camara/${primeraCamara.camaraId}`);
            console.log(`   ✅ Status: ${medicionesResponse.status}`);
            console.log(`   📊 Mediciones encontradas: ${medicionesResponse.data?.length || 0}`);
            
            if (medicionesResponse.data && medicionesResponse.data.length > 0) {
                console.log(`   📝 Primera medición: ${JSON.stringify(medicionesResponse.data[0], null, 2).substring(0, 200)}...`);
            }
        }
        
        console.log('\n✅ ¡Pruebas completadas exitosamente!');
        
    } catch (error) {
        console.error('\n❌ Error en las pruebas:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Mensaje: ${error.response.data?.msg || error.response.statusText}`);
        } else if (error.request) {
            console.error('   No se pudo conectar al servidor. ¿Está corriendo?');
        } else {
            console.error('   Error:', error.message);
        }
    }
}

testAPI();