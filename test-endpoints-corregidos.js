const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testEndpoints() {
    try {
        console.log('🔬 Probando endpoints corregidos...\n');
        
        // Test 1: Lista de cámaras
        console.log('1️⃣ GET /api/data/mediciones');
        const camarasResponse = await axios.get(`${BASE_URL}/api/data/mediciones`);
        console.log(`   ✅ Status: ${camarasResponse.status}`);
        console.log(`   📊 Cámaras devueltas: ${camarasResponse.data.length}`);
        
        camarasResponse.data.forEach(camara => {
            console.log(`   - Cámara ${camara.id}: TA1=${camara.lastData.data.TA1}°C`);
        });
        
        // Test 2: Fechas disponibles para cada cámara
        console.log('\n2️⃣ Probando fechas por cámara:');
        for (const camara of camarasResponse.data) {
            try {
                const fechasResponse = await axios.get(`${BASE_URL}/api/data/mediciones/camera/${camara.id}/dates`);
                console.log(`   Cámara ${camara.id}: ${fechasResponse.data.length} fechas disponibles`);
                if (fechasResponse.data.length > 0) {
                    console.log(`     Fechas: ${fechasResponse.data.join(', ')}`);
                }
            } catch (error) {
                console.log(`   Cámara ${camara.id}: Error - ${error.response?.data?.msg || error.message}`);
            }
        }
        
        // Test 3: Datos de cámaras con información
        console.log('\n3️⃣ Probando datos de cámara 17:');
        try {
            const datosResponse = await axios.get(`${BASE_URL}/api/data/mediciones/camera/17`);
            console.log(`   ✅ Status: ${datosResponse.status}`);
            console.log(`   📊 Registros devueltos: ${datosResponse.data.docs.length}`);
            
            if (datosResponse.data.docs.length > 0) {
                const primer = datosResponse.data.docs[0];
                const ultimo = datosResponse.data.docs[datosResponse.data.docs.length - 1];
                console.log(`   🕐 Primer registro: ${new Date(primer.timestamp).toLocaleString()}`);
                console.log(`   🕐 Último registro: ${new Date(ultimo.timestamp).toLocaleString()}`);
                console.log(`   🌡️  Rango temperaturas: ${primer.data.TA1}°C - ${ultimo.data.TA1}°C`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.response?.data?.msg || error.message}`);
        }
        
        // Test 4: Datos de cámara sin información (19)
        console.log('\n4️⃣ Probando datos de cámara 19 (sin datos):');
        try {
            const datosResponse = await axios.get(`${BASE_URL}/api/data/mediciones/camera/19`);
            console.log(`   ✅ Status: ${datosResponse.status}`);
            console.log(`   📊 Registros devueltos: ${datosResponse.data.docs.length}`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.response?.data?.msg || error.message}`);
        }
        
        console.log('\n✅ Pruebas completadas');
        
    } catch (error) {
        console.error('\n❌ Error general:', error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data)}`);
        }
    }
}

testEndpoints();