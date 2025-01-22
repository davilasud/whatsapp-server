const express = require('express');
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Ruta del archivo de autenticación
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

// Variable para almacenar temporalmente el QR
let qrCodeData = null;

async function iniciarWhatsApp() {
    const sock = makeWASocket({
        auth: state,
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { qr, connection } = update;

        if (qr) {
            // Generar el código QR como una URL base64
            qrcode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error('Error al generar QR:', err);
                } else {
                    qrCodeData = url; // Almacenar el QR generado
                }
            });
        }

        if (connection === 'open') {
            console.log('Conexión exitosa a WhatsApp');
            qrCodeData = null; // Limpiar el QR una vez conectado
        } else if (connection === 'close') {
            console.log('Conexión cerrada');
        }
    });
}

iniciarWhatsApp();

// Endpoint para obtener el QR
app.get('/get-qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qrCode: qrCodeData });
    } else {
        res.status(400).json({ message: 'El QR no está disponible o ya expiró. Intente nuevamente.' });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
