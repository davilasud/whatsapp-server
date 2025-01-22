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


//funcion para asegurar la sesion 
async function ensureClientConnected() {
    let attempts = 0;
    while (attempts < 10) { // Reintenta hasta 10 veces
        const state = await client.getState();
        if (state === 'CONNECTED') {
            return true;
        }
        console.log(`Estado actual: ${state}. Reintentando en 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
        attempts++;
    }
    return false;
}


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
        console.log('Escanea este código QR con tu aplicación de WhatsApp.');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', async () => {
    console.log('¡Cliente de WhatsApp listo!');
    clientReady = true;

    // Prueba de envío inmediato
    const testNumber = '5219621422263@c.us';
    const testMessage = 'Mensaje de prueba inmediato después de estar listo';
    try {
        console.log(`Intentando enviar mensaje al número ${testNumber}`);
        await client.sendMessage(testNumber, testMessage);
        console.log(`Mensaje enviado exitosamente al número ${testNumber}`);
    } catch (err) {
        console.error(`Error al enviar mensaje al número ${testNumber}:`, err);
    }
});


    client.on('ready', async () => {
    console.log('¡Cliente de WhatsApp listo!');
    clientReady = true;

    // Prueba de envío inmediato
    const testNumber = '5219621422263@c.us';
    const testMessage = 'Mensaje de prueba inmediato después de estar listo';
    try {
        console.log(`Intentando enviar mensaje al número ${testNumber}`);
        await client.sendMessage(testNumber, testMessage);
        console.log(`Mensaje enviado exitosamente al número ${testNumber}`);
    } catch (err) {
        console.error(`Error al enviar mensaje al número ${testNumber}:`, err);
    }
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
        initializeClient(); // Reinicia el cliente si se desconecta
    });

    client.on('state_changed', (state) => {
    console.log(`Estado del cliente cambiado: ${state}`);
    });

    client.initialize();
}

// Inicializa el cliente por primera vez
initializeClient();

// Rutas del servidor

// Obtener el código QR para autenticar
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

app.get('/status', (req, res) => {
    res.send({ clientReady, qrCodeData });
    console.log(`Estado del cliente: ${clientReady ? 'Listo' : 'No listo'}`);
});


app.post('/sendMessage', async (req, res) => {
    console.log('Petición recibida en /sendMessage:', req.body);

    if (!clientReady) {
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { groupIds, message } = req.body;

    // Validar la entrada
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).send({ message: 'Se requiere al menos un ID de grupo.' });
    }

    try {
        const chats = await client.getChats();
        console.log('Chats disponibles:', chats.map((chat) => chat.id._serialized));

        const responses = [];

        // Procesar cada ID de grupo de forma asincrónica
        for (const groupId of groupIds) {
            const group = chats.find((chat) => chat.id._serialized === groupId);

            if (group) {
                try {
                    await client.sendMessage(group.id._serialized, message);
                    responses.push({ groupId, status: 'success', message: 'Mensaje enviado correctamente' });
                } catch (err) {
                    console.error(`Error al enviar mensaje al grupo ${groupId}:`, err);
                    responses.push({ groupId, status: 'error', message: 'Error al enviar mensaje', error: err.message });
                }
            } else {
                console.warn(`Grupo no encontrado: ${groupId}`);
                responses.push({ groupId, status: 'error', message: 'Grupo no encontrado' });
            }
        }

        console.log('Respuestas enviadas:', responses);
        res.send({ responses }); // Enviar la respuesta al cliente
    } catch (err) {
        console.error('Error al obtener los chats:', err);
        res.status(500).send({ message: 'Error al obtener los chats', error: err.message });
    }
});

app.post('/test', async (req, res) => {
    console.log('Petición recibida en /test:', req.body);

    if (!await ensureClientConnected()) {
    console.log('El cliente no se conectó completamente después de varios intentos.');
    return res.status(503).send({ message: 'El cliente no está completamente conectado.' });
    }


    if (!clientReady) {
        console.log('Cliente no está listo.');
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        console.log('Número de teléfono o mensaje faltante.');
        return res.status(400).send({ message: 'Se requiere un número de teléfono y un mensaje.' });
    }

    try {
        console.log('Verificando estado del cliente...');
        const state = await client.getState();
        console.log(`Estado actual del cliente: ${state}`);

        if (state !== 'CONNECTED') {
            return res.status(503).send({ message: 'El cliente no está conectado completamente.' });
        }

        console.log(`Intentando enviar mensaje al número ${phoneNumber}`);
        await client.sendMessage(`${phoneNumber}@c.us`, message);
        console.log(`Mensaje enviado exitosamente al número ${phoneNumber}`);
        res.send({ status: 'success', message: 'Mensaje enviado correctamente' });
    } catch (err) {
        console.error(`Error al enviar mensaje al número ${phoneNumber}:`, err);
        res.status(500).send({ status: 'error', message: 'Error al enviar mensaje', error: err.message });
    }
});




app.post('/testMessage', async (req, res) => {
    console.log('Petición recibida en /testMessage:', req.body);

    if (!clientReady) {
        console.log('Cliente no está listo.');
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { groupIds, message } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        console.log('Faltan IDs de grupo.');
        return res.status(400).send({ message: 'Se requiere al menos un ID de grupo.' });
    }

    const responses = [];

    try {
        for (const groupId of groupIds) {
            console.log(`Procesando grupo: ${groupId}`);
            try {
                console.log(`Intentando enviar mensaje al grupo ${groupId}`);
                await client.sendMessage(groupId, message);
                console.log(`Mensaje enviado exitosamente al grupo ${groupId}`);
                responses.push({ groupId, status: 'success', message: 'Mensaje enviado correctamente' });
            } catch (err) {
                console.error(`Error al enviar mensaje al grupo ${groupId}:`, err);
                responses.push({ groupId, status: 'error', message: 'Error al enviar mensaje', error: err.message });
            }
        }

        console.log('Respuestas generadas:', responses);
        res.send({ responses });
    } catch (err) {
        console.error('Error general en /testMessage:', err);
        res.status(500).send({ message: 'Error inesperado', error: err.message });
    }
});

app.post('/testGroup', async (req, res) => {
    console.log('Petición recibida en /testGroup:', req.body);

    if (!clientReady) {
        console.log('Cliente no está listo.');
        return res.status(503).send({ message: 'El cliente de WhatsApp no está listo.' });
    }

    const { groupId, message } = req.body;

    if (!groupId || !message) {
        console.log('ID de grupo o mensaje faltante.');
        return res.status(400).send({ message: 'Se requiere un ID de grupo y un mensaje.' });
    }

    try {
        console.log(`Intentando enviar mensaje al grupo ${groupId}`);
        await client.sendMessage(groupId, message);
        console.log(`Mensaje enviado exitosamente al grupo ${groupId}`);
        res.send({ status: 'success', message: 'Mensaje enviado correctamente' });
    } catch (err) {
        console.error(`Error al enviar mensaje al grupo ${groupId}:`, err);
        res.status(500).send({ status: 'error', message: 'Error al enviar mensaje', error: err.message });
    }
});



// Cerrar sesión y reiniciar el cliente
app.post('/logout', (req, res) => {
    console.log('Petición recibida en /logout');
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


app.post('/forceLogout', (req, res) => {
    const authPath = path.join(__dirname, '.wwebjs_auth');
    console.log(`Intentando eliminar la carpeta de autenticación en: ${authPath}`);

    if (fs.existsSync(authPath)) {
        fs.rm(authPath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error('Error al eliminar la carpeta de autenticación:', err);
                return res.status(500).send({ message: 'Error al eliminar la carpeta de autenticación', error: err });
            }
            console.log('Carpeta de autenticación eliminada correctamente');
            clientReady = false;
            res.send({ message: 'Sesión forzada cerrada y datos eliminados. Reinicia el cliente para generar un nuevo QR.' });
            // Inicializa el cliente por logout
            initializeClient();
            console.log('Sesion Re-Inicializada Carpeta Encontrada');
        });
    } else {
        console.log('No se encontró la carpeta de autenticación para eliminar.');
        res.status(404).send({ message: 'No se encontró la carpeta de autenticación.' });
         // Inicializa el cliente por logout
         initializeClient();
         console.log('Sesion Re-Inicializada Carpeta No Encontrada');
    }
});

app.post('/clearCache', async (req, res) => {
    if (!client) {
        console.log('Cliente no inicializado. No se puede limpiar la caché.');
        return res.status(500).send({ message: 'El cliente no está inicializado.' });
    }

    try {
        const browser = await client.pupBrowser;
        const pages = await browser.pages();

        for (const page of pages) {
            console.log('Limpiando caché del navegador...');
            await page.setCacheEnabled(false);
        }

        console.log('Caché del navegador limpiada correctamente.');
        res.send({ message: 'Caché del navegador de Puppeteer limpiada correctamente.' });
    } catch (err) {
        console.error('Error al limpiar la caché del navegador:', err);
        res.status(500).send({ message: 'Error al limpiar la caché del navegador.', error: err.message });
    }
});



// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor de WhatsApp-web.js corriendo en http://localhost:${port}`);
});
