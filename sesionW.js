const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
//const port = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Inicializa el cliente de WhatsApp
let client = null;
let qrCodeData = ''; // Almacena el QR temporalmente

function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth'),
        }),
    });

    // Eventos del cliente
    client.on('qr', (qr) => {
        qrCodeData = qr; // Actualiza el QR
        console.log('QR generado');
    });

    client.on('ready', () => {
        console.log('WhatsApp Web está listo');
        qrCodeData = ''; // Limpia el QR una vez conectado
    });

    client.on('authenticated', () => {
        console.log('Autenticación exitosa');
    });

    client.on('auth_failure', (msg) => {
        console.error('Error de autenticación:', msg);
    });

    client.initialize();
}

// Inicializa el cliente por primera vez
initializeClient();

// Rutas del servidor
// Generar y obtener QR
app.get('/get-qr', (req, res) => {
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            if (err) {
                res.status(500).send('Error al generar el QR');
            } else {
                res.send({ qrCode: url });
            }
        });
    } else {
        res.status(400).send({ message: 'No hay QR disponible o ya estás autenticado' });
    }
});

// Endpoint para cerrar sesión
/* app.post('/logout', (req, res) => {
    if (!client) {
        return res.status(500).send({ message: 'Cliente no inicializado' });
    }

    client.logout()
        .then(() => {
            console.log('Sesión cerrada correctamente');

            client.destroy()
                .then(() => {
                    console.log('Cliente destruido correctamente');

                    // Ruta a la carpeta de autenticación
                    const authPath = path.join(__dirname, '.wwebjs_auth');

                    // Verificar si la carpeta de autenticación existe y eliminarla
                    if (fs.existsSync(authPath)) {
                        fs.rm(authPath, { recursive: true, force: true }, (err) => {
                            if (err) {
                                console.error('Error al eliminar datos de autenticación:', err);
                                return res.status(500).send({ message: 'Error al eliminar datos de autenticación', error: err });
                            }

                            console.log('Datos de autenticación eliminados correctamente');

                            // Reinicializar el cliente
                            initializeClient();

                            res.send({ message: 'Sesión cerrada y cliente reiniciado. Ahora puedes escanear un nuevo QR.' });
                        });
                    } else {
                        console.warn('No se encontraron datos de autenticación para eliminar');

                        // Reinicializar directamente si no hay datos
                        initializeClient();
                        res.send({ message: 'Sesión cerrada, pero no había datos para eliminar. Ahora puedes escanear un nuevo QR.' });
                    }
                })
                .catch((destroyErr) => {
                    console.error('Error al destruir el cliente:', destroyErr);
                    res.status(500).send({ message: 'Error al destruir el cliente', error: destroyErr });
                });
        })
        .catch((err) => {
            console.error('Error al cerrar sesión:', err);
            res.status(500).send({ message: 'Error al cerrar sesión', error: err });
        });
});
 */
// Enviar mensaje a múltiples grupos
/* app.post('/sendMessage', (req, res) => {
    const { groupIds, message } = req.body;

    // Validar la entrada
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).send({ message: 'Se requiere al menos un ID de grupo' });
    }

    client.getChats().then((chats) => {
        const responses = [];

        // Procesar cada ID de grupo
        groupIds.forEach((groupId) => {
            const group = chats.find((chat) => chat.id._serialized === groupId);
            if (group) {
                client.sendMessage(group.id._serialized, message)
                    .then(() => {
                        responses.push({ groupId, status: 'success', message: 'Mensaje enviado correctamente' });
                        if (responses.length === groupIds.length) {
                            res.send({ responses });
                        }
                    })
                    .catch((err) => {
                        responses.push({ groupId, status: 'error', message: 'Error al enviar mensaje', error: err });
                        if (responses.length === groupIds.length) {
                            res.send({ responses });
                        }
                    });
            } else {
                responses.push({ groupId, status: 'error', message: 'Grupo no encontrado' });
                if (responses.length === groupIds.length) {
                    res.send({ responses });
                }
            }
        });
    }).catch((err) => {
        res.status(500).send({ message: 'Error al obtener chats', error: err });
    });
}); */

// Inicia el servidor
/* app.listen(port, () => {
    console.log(`Servidor de WhatsApp-web.js corriendo en http://localhost:${port}`);
}); */
