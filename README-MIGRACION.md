# Migración a Colección Unificada de Mediciones

Este documento describe la migración del sistema de múltiples colecciones `FormexCamXX` a una colección única `mediciones` con autenticación por API Key.

## Estructura Nueva

### Colección `mediciones`
```javascript
{
  _id: ObjectId,
  frigorificoId: ObjectId,  // Referencia al frigorífico
  camaraId: String,         // ID de la cámara (ej: "17", "18", "19", "20")
  ts: Date,                 // Timestamp de la medición
  temp: Number,             // Temperatura (opcional)
  createdAt: Date,          // Timestamp de creación
  updatedAt: Date           // Timestamp de actualización
}
```

### Colección `frigorificos`
```javascript
{
  _id: ObjectId,
  nombre: String,           // Nombre del frigorífico
  apiKey: String,           // API Key única para autenticación
  ubicacion: String,        // Ubicación física
  createdAt: Date
}
```

## Índices Requeridos

```javascript
// Índice para consultas ordenadas por timestamp descendente
db.medicions.createIndex({ frigorificoId: 1, camaraId: 1, ts: -1 });

// Índice único para prevenir duplicados
db.medicions.createIndex({ frigorificoId: 1, camaraId: 1, ts: 1 }, { 
  unique: true, 
  name: 'ux_frigo_camara_ts' 
});
```

## Configuración Inicial

### 1. Crear índices y validador
```bash
cd c:\3W-integracion-funcional\datos-plc-backend\backend-app
node db-server/setup-mediciones.js
```

### 2. Migrar datos existentes
```bash
node db-server/migrar-formex.js
```

### 3. Crear frigorífico si no existe
```javascript
// En MongoDB
db.frigorificos.insertOne({
  nombre: "Frigorífico Principal",
  apiKey: "your-secure-api-key-here",
  ubicacion: "Planta Principal",
  createdAt: new Date()
});
```

## Nueva API

### Endpoints

#### POST /api/mediciones
Inserta una nueva medición.

**Headers:**
- `X-API-Key`: API Key del frigorífico
- `Content-Type: application/json`

**Body:**
```json
{
  "camaraId": "17",
  "temp": 2.5,
  "ts": "2025-01-15T10:30:00Z"  // Opcional, usa Date.now() si no se proporciona
}
```

**Respuestas:**
- `201`: Medición creada exitosamente
- `400`: Error de validación
- `401`: API Key inválida o faltante
- `409`: Timestamp duplicado (error `duplicate_ts`)

#### GET /api/mediciones
Obtiene mediciones del frigorífico.

**Headers:**
- `X-API-Key`: API Key del frigorífico

**Query Parameters:**
- `camaraId`: Filtrar por cámara específica
- `from`: Fecha desde (ISO string)
- `to`: Fecha hasta (ISO string)  
- `limit`: Número máximo de registros (default: 100)
- `skip`: Número de registros a omitir (paginación)

**Respuesta:**
```json
{
  "data": [
    {
      "_id": "...",
      "frigorificoId": "...",
      "camaraId": "17",
      "ts": "2025-01-15T10:30:00Z",
      "temp": 2.5
    }
  ],
  "pagination": {
    "total": 1500,
    "limit": 100,
    "skip": 0,
    "hasMore": true
  },
  "filter": {
    "frigorificoId": "...",
    "camaraId": "17",
    "from": null,
    "to": null
  }
}
```

## Implementación en Raspberry Pi

### Código de ejemplo:

```javascript
const fetch = require('node-fetch');

const API_URL = 'http://your-server:4000/api';
const API_KEY = 'your-api-key-here';

async function enviarMedicion(camaraId, temp, ts = null) {
    const payload = { camaraId, temp };
    if (ts) payload.ts = ts;

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

        if (response.ok) {
            console.log('✅ Medición enviada:', data);
            return true;
        } else if (response.status === 409 && data.error === 'duplicate_ts') {
            // Reintentar sin timestamp
            const retryPayload = { camaraId, temp };
            const retryResponse = await fetch(`${API_URL}/mediciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(retryPayload)
            });

            if (retryResponse.ok) {
                console.log('✅ Medición enviada (reintento)');
                return true;
            }
        }

        console.error('❌ Error:', data);
        return false;

    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

// Uso
await enviarMedicion('17', 2.5);
```

### Script completo de ejemplo:
Usar el archivo `raspberry-client-example.js` como base para implementar en la Raspberry Pi.

## Validaciones

### Servidor
- `frigorificoId`: ObjectId válido (resuelto automáticamente por middleware)
- `camaraId`: String no vacío
- `ts`: Date válida o timestamp numérico
- `temp`: Number (opcional)

### MongoDB Validator
```javascript
{
  $jsonSchema: {
    bsonType: "object",
    required: ["frigorificoId", "camaraId", "ts"],
    properties: {
      frigorificoId: {
        bsonType: "objectId",
        description: "frigorificoId must be an ObjectId and is required"
      },
      camaraId: {
        bsonType: "string",
        minLength: 1,
        description: "camaraId must be a non-empty string and is required"
      },
      ts: {
        bsonType: ["date", "number"],
        description: "ts must be a date or timestamp number and is required"
      },
      temp: {
        bsonType: ["number", "null"],
        description: "temp must be a number if provided"
      }
    }
  }
}
```

## Manejo de Errores

### Códigos de Error Comunes

- `missing_api_key`: Falta el header X-API-Key
- `invalid_api_key`: API Key no válida
- `validation_error`: Datos del payload inválidos
- `duplicate_ts`: Ya existe una medición para esa cámara en ese timestamp
- `internal_error`: Error interno del servidor

### Estrategia de Reintento (Raspberry)

1. Enviar medición con timestamp específico
2. Si recibe error 409 (`duplicate_ts`), reintentar sin timestamp
3. El servidor usará `new Date()` automáticamente
4. Si el segundo intento falla, registrar error y continuar

## Migración Gradual

### Fase 1: Configuración
1. ✅ Crear nueva estructura de colecciones
2. ✅ Configurar índices y validadores
3. ✅ Implementar middleware de autenticación

### Fase 2: API Nuevas
1. ✅ Implementar POST /mediciones
2. ✅ Implementar GET /mediciones
3. ✅ Validaciones y manejo de errores

### Fase 3: Migración de Datos
1. ✅ Script de migración de FormexCamXX a mediciones
2. ✅ Verificación de integridad de datos

### Fase 4: Raspberry Pi
1. ✅ Código de ejemplo para envío de mediciones
2. 🔄 Actualizar scripts de la Raspberry Pi
3. 🔄 Pruebas en entorno real

### Fase 5: Depreciación
1. 🔄 Redirigir endpoints antiguos a nueva API
2. 🔄 Eliminar colecciones FormexCamXX después de verificar migración
3. 🔄 Limpiar código obsoleto

## Testing

### Probar configuración:
```bash
node db-server/setup-mediciones.js
```

### Probar migración:
```bash
node db-server/migrar-formex.js
```

### Probar cliente:
```bash
node raspberry-client-example.js
```

### Verificar en MongoDB:
```javascript
// Contar mediciones
db.medicions.countDocuments()

// Ver mediciones por cámara
db.medicions.aggregate([
  { $group: { _id: "$camaraId", count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
])

// Ver últimas mediciones
db.medicions.find().sort({ ts: -1 }).limit(10)
```