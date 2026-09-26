const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// Dominios permitidos.
// Para las pruebas locales permitimos nuestro frontend en el puerto 5500.
const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:5500,http://127.0.0.1:5500"
)
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);

// Últimos mensajes del chat
const historial = [];

// =====================================================
// SERVIDOR HTTP
// =====================================================

const server = http.createServer((req, res) => {

    // Ruta de comprobación
    if (req.url === "/health") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            ok: true,
            conectados: wss.clients.size,
            mensajesEnHistorial: historial.length,
            uptimeSegundos: Math.floor(process.uptime())
        }));

        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("Servidor de chat funcionando");
});


// =====================================================
// SERVIDOR WEBSOCKET
// =====================================================

const wss = new WebSocket.Server({
    server: server,

    // Seguridad: solamente aceptamos nuestro frontend
    verifyClient: (info, done) => {

        const origin = info.origin;

        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            done(true);
            return;
        }

        console.log(`[seguridad] origen rechazado: ${origin}`);

        done(false, 403, "Origen no permitido");
    }
});


// =====================================================
// ENVIAR A TODOS
// =====================================================

function enviarATodos(datos) {

    const mensaje = JSON.stringify(datos);

    wss.clients.forEach((cliente) => {

        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(mensaje);
        }

    });
}


// =====================================================
// ENVIAR LISTA DE USUARIOS
// =====================================================

function enviarUsuarios() {

    const usuarios = [];

    wss.clients.forEach((cliente) => {

        if (cliente.nombre) {
            usuarios.push(cliente.nombre);
        }

    });

    enviarATodos({
        tipo: "usuarios",
        usuarios: usuarios
    });
}


// =====================================================
// NUEVA CONEXIÓN
// =====================================================

wss.on("connection", (ws) => {

    console.log("[ws] nueva conexión");

    // Estado del cliente
    ws.nombre = null;
    ws.ultimaActividad = Date.now();
    ws.ultimaEscritura = 0;

    // Pedimos el nombre
    ws.send(JSON.stringify({
        tipo: "solicitar_nombre"
    }));


    // =================================================
    // RECIBIR MENSAJES
    // =================================================

    ws.on("message", (data) => {

        try {

            ws.ultimaActividad = Date.now();

            const datos = JSON.parse(data.toString());


            // ==========================================
            // REGISTRAR NOMBRE
            // ==========================================

            if (datos.tipo === "nombre") {

                const nombre = String(datos.nombre || "").trim();

                if (!nombre) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "Debes escribir un nombre."
                    }));

                    return;
                }

                if (nombre.length > 30) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "El nombre no puede superar 30 caracteres."
                    }));

                    return;
                }

                // Evitar nombres duplicados
                let nombreOcupado = false;

                wss.clients.forEach((cliente) => {

                    if (
                        cliente !== ws &&
                        cliente.nombre &&
                        cliente.nombre.toLowerCase() === nombre.toLowerCase()
                    ) {
                        nombreOcupado = true;
                    }

                });

                if (nombreOcupado) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "Ese nombre ya está en uso."
                    }));

                    return;
                }

                ws.nombre = nombre;

                console.log(`[ws] nombre="${nombre}"`);


                // ======================================
                // HISTORIAL
                // ======================================

                ws.send(JSON.stringify({
                    tipo: "historial",
                    mensajes: historial
                }));


                // ======================================
                // AVISO DE ENTRADA
                // ======================================

                enviarATodos({
                    tipo: "entrada",
                    nombre: nombre
                });


                // ======================================
                // ACTUALIZAR USUARIOS
                // ======================================

                enviarUsuarios();

                return;
            }


            // ==========================================
            // MENSAJE DE CHAT
            // ==========================================

            if (datos.tipo === "mensaje") {

                if (!ws.nombre) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "Primero debes ingresar un nombre."
                    }));

                    return;
                }

                const texto = String(datos.texto || "").trim();

                if (!texto) {
                    return;
                }


                // Límite de tamaño
                if (texto.length > 500) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "El mensaje no puede superar 500 caracteres."
                    }));

                    return;
                }


                // Límite sencillo de ritmo:
                // no más de un mensaje cada 300 ms
                const ahora = Date.now();

                if (
                    ws.ultimoMensaje &&
                    ahora - ws.ultimoMensaje < 300
                ) {

                    ws.send(JSON.stringify({
                        tipo: "error",
                        mensaje: "Estás enviando mensajes demasiado rápido."
                    }));

                    return;
                }

                ws.ultimoMensaje = ahora;


                const mensaje = {
                    nombre: ws.nombre,
                    texto: texto,
                    fecha: new Date().toISOString()
                };


                // Guardar historial
                historial.push(mensaje);

                // Máximo 50 mensajes
                if (historial.length > 50) {
                    historial.shift();
                }


                console.log(
                    `[ws] mensaje de="${ws.nombre}"`
                );


                // Enviar a todos
                enviarATodos({
                    tipo: "mensaje",
                    mensaje: mensaje
                });

                return;
            }


            // ==========================================
            // ESTÁ ESCRIBIENDO
            // ==========================================

            if (datos.tipo === "escribiendo") {

                if (!ws.nombre) {
                    return;
                }

                const ahora = Date.now();

                // Evita enviar demasiados avisos
                if (ahora - ws.ultimaEscritura < 300) {
                    return;
                }

                ws.ultimaEscritura = ahora;

                wss.clients.forEach((cliente) => {

                    if (
                        cliente !== ws &&
                        cliente.readyState === WebSocket.OPEN
                    ) {

                        cliente.send(JSON.stringify({
                            tipo: "escribiendo",
                            nombre: ws.nombre
                        }));

                    }

                });

                return;
            }


            // ==========================================
            // DEJÓ DE ESCRIBIR
            // ==========================================

            if (datos.tipo === "dejo_de_escribir") {

                if (!ws.nombre) {
                    return;
                }

                wss.clients.forEach((cliente) => {

                    if (
                        cliente !== ws &&
                        cliente.readyState === WebSocket.OPEN
                    ) {

                        cliente.send(JSON.stringify({
                            tipo: "dejo_de_escribir",
                            nombre: ws.nombre
                        }));

                    }

                });

                return;
            }


            // ==========================================
            // TIPO DESCONOCIDO
            // ==========================================

            ws.send(JSON.stringify({
                tipo: "error",
                mensaje: "Tipo de mensaje no válido."
            }));


        } catch (error) {

            console.log("[ws] mensaje inválido");

            ws.send(JSON.stringify({
                tipo: "error",
                mensaje: "Mensaje inválido."
            }));

        }

    });


    // =================================================
    // CIERRE DE CONEXIÓN
    // =================================================

    ws.on("close", () => {

        if (ws.nombre) {

            console.log(
                `[cierre] nombre="${ws.nombre}"`
            );

            enviarATodos({
                tipo: "salida",
                nombre: ws.nombre
            });

            enviarUsuarios();

        }

    });


    // =================================================
    // ERROR
    // =================================================

    ws.on("error", (error) => {

        console.log(
            "[ws] error:",
            error.message
        );

    });

});


// =====================================================
// PING / PONG
// =====================================================

// Cada 30 segundos comprobamos que los clientes sigan vivos.
const intervaloPing = setInterval(() => {

    wss.clients.forEach((ws) => {

        if (ws.isAlive === false) {

            console.log(
                `[ping] conexión sin respuesta: ${ws.nombre || "sin nombre"}`
            );

            ws.terminate();

            return;
        }

        ws.isAlive = false;

        ws.ping();

    });

}, 30000);


// Cuando el cliente responde al ping
wss.on("connection", (ws) => {

    ws.isAlive = true;

    ws.on("pong", () => {

        ws.isAlive = true;

    });

});


// Cuando el servidor se cierra
wss.on("close", () => {

    clearInterval(intervaloPing);

});


// =====================================================
// INICIAR SERVIDOR
// =====================================================

server.listen(PORT, () => {

    console.log(
        `[KrayCloud] Servidor escuchando en el puerto ${PORT}`
    );

    console.log(
        `[seguridad] Orígenes permitidos: ${ALLOWED_ORIGINS.join(", ")}`
    );

});