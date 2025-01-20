const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Variables globales
let client = null;
let clientReady = false;
let qrCodeData = '';

// Función para inicializar el cliente
function initializeClient() {
    console.log('Inicializando cliente de WhatsApp...');
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth'),
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    });

    // Eventos del cliente
    client.on('qr', (qr) => {
        qrCodeData = qr;
        console.log('QR generado:', qr);
    });

    client.on('ready', () => {
        console.log('¡Cliente de WhatsApp listo!');
        clientReady = true;
        qrCodeData = '';
    });

    client.on('authenticated', () => {
        console.log('Autenticación exitosa');
    });

    client.on('auth_failure', (msg) => {
        console.error('Error de autenticación:', msg);
        clientReady = false;
    });

    client.on('disconnected', (reason) => {
        console.warn('Cliente desconectado:', reason);
        clientReady = false;
        initializeClient();
    });

    client.initialize();
}

// Inicializa el cliente por primera vez
initializeClient();

// Rutas del servidor
app.get('/get-qr', (req, res) => {
    console.log('Petición recibida en /get-qr');
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            if (err) {
                console.error('Error al generar QR:', err);
                return res.status(500).send('Error al generar el QR');
            }
            res.send({ qrCode: url });
        });
    } else if (clientReady) {
        res.status(400).send({ message: 'Cliente ya autenticado' });
    } else {
        res.status(503).send({ message: 'Cliente no listo para generar QR' });
    }
});

app.post('/sendMessage', async (req, res) => {
    console.log('Petición recibida en /sendMessage:', req.body);
    if (!clientReady) {
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { groupIds, message } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).send({ message: 'Se requiere al menos un ID de grupo.' });
    }

    try {
        const chats = await client.getChats();
        console.log('Chats obtenidos:', chats.length);
        const responses = [];

        for (const groupId of groupIds) {
            const group = chats.find((chat) => chat.id._serialized === groupId);
            if (group) {
                try {
                    await client.sendMessage(group.id._serialized, message);
                    responses.push({ groupId, status: 'success', message: 'Mensaje enviado correctamente' });
                } catch (err) {
                    responses.push({ groupId, status: 'error', message: 'Error al enviar mensaje', error: err.message });
                }
            } else {
                responses.push({ groupId, status: 'error', message: 'Grupo no encontrado' });
            }
        }

        console.log('Respuestas enviadas:', responses);
        res.send({ responses });
    } catch (err) {
        console.error('Error al obtener los chats:', err);
        res.status(500).send({ message: 'Error al obtener los chats', error: err.message });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor de WhatsApp-web.js corriendo en http://localhost:${port}`);
});
