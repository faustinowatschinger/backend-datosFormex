const mongoose = require('mongoose');

// Schema para mediciones con validación
const medicionSchema = new mongoose.Schema({
    frigorificoId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Frigorifico'
    },
    camaraId: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return v && v.trim().length > 0;
            },
            message: 'camaraId cannot be empty'
        }
    },
    ts: {
        type: Date,
        required: true,
        validate: {
            validator: function(v) {
                return v instanceof Date || (typeof v === 'number' && !isNaN(v));
            },
            message: 'ts must be a valid Date or timestamp number'
        }
    },
    temp: {
        type: Number,
        required: false
    }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Índices para optimización de consultas
medicionSchema.index({ frigorificoId: 1, camaraId: 1, ts: -1 });
medicionSchema.index(
    { frigorificoId: 1, camaraId: 1, ts: 1 }, 
    { unique: true, name: 'ux_frigo_camara_ts' }
);

module.exports = medicionSchema;