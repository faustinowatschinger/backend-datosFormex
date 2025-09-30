require('dotenv').config();
const axios = require('axios');

async function testFrontend() {
    try {
        console.log('🔬 Probando los endpoints del frontend...\n');
        
        const BASE_URL = 'http://localhost:4000';
        
        // Mock del token para pruebas
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MWVjMTE0MmEyMmNhNGJkMTJmZGE4YiIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTczMDA1MTg3NSwiZXhwIjoxNzMwMTM4Mjc1fQ.m8edfp8EXMXlbugK5lLRFTEq1YenxyKopMfpiMaj2dU';
        
        const headers = {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
        };
        
        // 1. Test lista de cámaras
        console.log('1️⃣ GET /api/data/mediciones (lista de cámaras):');
        try {
            const response = await axios.get(`${BASE_URL}/api/data/mediciones`, { headers });
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📊 Cámaras devueltas: ${response.data.length}`);
            
            response.data.forEach(camara => {
                const temp = camara.lastData?.data?.TA1 || 0;
                console.log(`   - Cámara ${camara.id}: ${temp}°C`);
            });
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
        }
        
        // 2. Test fechas disponibles
        console.log('\n2️⃣ Fechas disponibles por cámara:');
        const camaras = ['17', '18', '19', '20'];
        
        for (const cam of camaras) {
            try {
                const response = await axios.get(`${BASE_URL}/api/data/mediciones/camera/${cam}/dates`, { headers });
                console.log(`   Cámara ${cam}: [${response.data.join(', ')}]`);
            } catch (error) {
                console.log(`   Cámara ${cam}: Error - ${error.response?.status} ${error.response?.data?.msg || error.message}`);
            }
        }
        
        // 3. Test datos de cámara específica
        console.log('\n3️⃣ Datos de cámara 17:');
        try {
            const response = await axios.get(`${BASE_URL}/api/data/mediciones/camera/17`, { headers });
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📊 Registros: ${response.data.docs?.length || 0}`);
            
            if (response.data.docs && response.data.docs.length > 0) {
                const primero = response.data.docs[0];
                const ultimo = response.data.docs[response.data.docs.length - 1];
                console.log(`   🕐 Primer registro: ${new Date(primero.timestamp).toLocaleString()} - ${primero.data.TA1}°C`);
                console.log(`   🕐 Último registro: ${new Date(ultimo.timestamp).toLocaleString()} - ${ultimo.data.TA1}°C`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.response?.status} - ${error.response?.data?.msg || error.message}`);
        }
        
        // 4. Test datos con fecha específica
        console.log('\n4️⃣ Datos de cámara 17 para el 28/09/2025:');
        try {
            const response = await axios.get(`${BASE_URL}/api/data/mediciones/camera/17?date=2025-09-28`, { headers });
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📊 Registros del 28/09: ${response.data.docs?.length || 0}`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.response?.status} - ${error.response?.data?.msg || error.message}`);
        }
        
        console.log('\n✅ Pruebas completadas');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testFrontend();