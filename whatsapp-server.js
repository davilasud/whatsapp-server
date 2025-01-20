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
let clientReady = false; // Verifica si el cliente está listo
let qrCodeData = ''; // Almacena temporalmente el QR

// Función para inicializar el cliente
function initializeClient() {
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
        qrCodeData = qr; // Actualiza el QR
        console.log('QR generado');
    });

    client.on('ready', () => {
        console.log('WhatsApp Web está listo');
        clientReady = true;
        qrCodeData = ''; // Limpia el QR
    });

    client.on('authenticated', () => {
        console.log('Autenticación exitosa');
    });

    client.on('auth_failure', (msg) => {
        console.error('Error de autenticación:', msg);
        clientReady = false; // Marca como no listo en caso de fallo
    });

    client.on('disconnected', (reason) => {
        console.error('Cliente desconectado:', reason);
        clientReady = false;
        initializeClient(); // Reintenta inicializar el cliente
    });

    client.initialize();
}

// Inicializa el cliente por primera vez
initializeClient();

// Rutas del servidor

// Obtener el código QR para autenticar
app.get('/get-qr', (req, res) => {
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            if (err) {
                console.error('Error al generar el QR:', err);
                res.status(500).send('Error al generar el QR');
            } else {
                res.send({ qrCode: url });
            }
        });
    } else if (clientReady) {
        res.status(400).send({ message: 'Cliente ya autenticado' });
    } else {
        res.status(503).send({ message: 'Cliente no listo para generar QR' });
    }
});

// Cerrar sesión y reiniciar el cliente
app.post('/logout', (req, res) => {
    if (!client) {
        return res.status(500).send({ message: 'Cliente no inicializado' });
    }

    client.logout()
        .then(() => {
            console.log('Sesión cerrada correctamente');
            const authPath = path.join(__dirname, '.wwebjs_auth');

            if (fs.existsSync(authPath)) {
                fs.rm(authPath, { recursive: true, force: true }, (err) => {
                    if (err) {
                        console.error('Error al eliminar datos de autenticación:', err);
                        return res.status(500).send({ message: 'Error al eliminar datos de autenticación', error: err });
                    }

                    console.log('Datos de autenticación eliminados correctamente');
                    clientReady = false;
                    initializeClient();
                    res.send({ message: 'Sesión cerrada y cliente reiniciado. Ahora puedes escanear un nuevo QR.' });
                });
            } else {
                console.warn('No se encontraron datos de autenticación para eliminar');
                clientReady = false;
                initializeClient();
                res.send({ message: 'Sesión cerrada. Ahora puedes escanear un nuevo QR.' });
            }
        })
        .catch((err) => {
            console.error('Error al cerrar sesión:', err);
            res.status(500).send({ message: 'Error al cerrar sesión', error: err });
        });
});

// Enviar mensaje a múltiples grupos
app.post('/sendMessage', async (req, res) => {
    if (!clientReady) {
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { groupIds, message } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).send({ message: 'Se requiere al menos un ID de grupo.' });
    }

    try {
        const chats = await client.getChats();
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

        res.send({ responses });
    } catch (err) {
        console.error('Error al obtener los chats:', err);
        res.status(500).send({ message: 'Error al obtener los chats', error: err.message });
    }
});

// Manejo global de errores inesperados
app.use((err, req, res, next) => {
    console.error('Error inesperado:', err);
    res.status(500).send({ message: 'Error inesperado', error: err.message });
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor de WhatsApp-web.js corriendo en http://localhost:${port}`);
});
