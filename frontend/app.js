let socket = null;
let miNombre = "";

let temporizadorEscribiendo = null;
let ultimoAvisoEscribiendo = 0;

// ==========================================
// VARIABLES DE RECONEXIÓN
// ==========================================

let reconectando = false;
let intentosReconectar = 0;
let temporizadorReconectar = null;


// ==========================================
// ELEMENTOS HTML
// ==========================================

const estado = document.getElementById("estado");
const pantallaNombre = document.getElementById("pantallaNombre");
const chat = document.getElementById("chat");

const inputNombre = document.getElementById("nombre");
const btnEntrar = document.getElementById("btnEntrar");

const inputMensaje = document.getElementById("mensaje");
const btnEnviar = document.getElementById("btnEnviar");

const mensajes = document.getElementById("mensajes");
const usuarios = document.getElementById("usuarios");
const escribiendo = document.getElementById("escribiendo");


// ==========================================
// CONECTAR CON EL SERVIDOR
// ==========================================

function conectar() {

    estado.textContent = "Conectando...";

    socket = new WebSocket(CONFIG.WS_URL);


    // ======================================
    // CONEXIÓN EXITOSA
    // ======================================

    socket.addEventListener("open", () => {

        estado.textContent = "🟢 Conectado";

        console.log("[ws] conectado");

        // Reiniciar contador de reconexión
        intentosReconectar = 0;
        reconectando = false;

        if (temporizadorReconectar) {

            clearTimeout(temporizadorReconectar);

            temporizadorReconectar = null;
        }


        // Volver a registrar el nombre
        if (miNombre) {

            socket.send(JSON.stringify({

                tipo: "nombre",
                nombre: miNombre

            }));

        }

    });


    // ======================================
    // MENSAJES DEL SERVIDOR
    // ======================================

    socket.addEventListener("message", (event) => {

        try {

            const datos = JSON.parse(event.data);

            procesarMensaje(datos);

        } catch (error) {

            console.error(
                "Mensaje inválido:",
                error
            );

        }

    });


    // ======================================
    // CONEXIÓN CERRADA
    // ======================================

    socket.addEventListener("close", () => {

        estado.textContent = "🔴 Desconectado";

        console.log("[ws] conexión cerrada");

        escribiendo.textContent = "";

        iniciarReconexión();

    });


    // ======================================
    // ERROR
    // ======================================

    socket.addEventListener("error", (error) => {

        console.error(
            "[ws] error:",
            error
        );

    });

}


// ==========================================
// RECONEXIÓN AUTOMÁTICA
// ==========================================

function iniciarReconexión() {

    // Evitar varias reconexiones simultáneas
    if (reconectando) {
        return;
    }

    reconectando = true;

    intentosReconectar++;


    // ======================================
    // BACKOFF EXPONENCIAL
    // ======================================
    // 1 segundo
    // 2 segundos
    // 4 segundos
    // 8 segundos
    // 16 segundos
    // máximo 30 segundos

    const espera = Math.min(
        1000 * Math.pow(
            2,
            intentosReconectar - 1
        ),
        30000
    );


    console.log(
        `[reconexión] intento ${intentosReconectar} en ${espera / 1000}s`
    );


    estado.textContent =
        `🔄 Reconectando en ${espera / 1000}s...`;


    temporizadorReconectar = setTimeout(() => {

        reconectando = false;

        conectar();

    }, espera);

}


// ==========================================
// PROCESAR MENSAJES DEL SERVIDOR
// ==========================================

function procesarMensaje(datos) {


    // ======================================
    // SOLICITUD DE NOMBRE
    // ======================================

    if (datos.tipo === "solicitar_nombre") {

        console.log(
            "Servidor solicita nombre"
        );

        return;
    }


    // ======================================
    // HISTORIAL
    // ======================================

    if (datos.tipo === "historial") {

        datos.mensajes.forEach((mensaje) => {

            mostrarMensaje(mensaje);

        });

        return;
    }


    // ======================================
    // NUEVO MENSAJE
    // ======================================

    if (datos.tipo === "mensaje") {

        // Quitamos el aviso de escritura
        escribiendo.textContent = "";

        mostrarMensaje(
            datos.mensaje
        );

        return;
    }


    // ======================================
    // ALGUIEN ENTRÓ
    // ======================================

    if (datos.tipo === "entrada") {

        mostrarSistema(
            datos.nombre +
            " entró al chat"
        );

        return;
    }


    // ======================================
    // ALGUIEN SALIÓ
    // ======================================

    if (datos.tipo === "salida") {

        mostrarSistema(
            datos.nombre +
            " salió del chat"
        );

        return;
    }


    // ======================================
    // LISTA DE USUARIOS
    // ======================================

    if (datos.tipo === "usuarios") {

        actualizarUsuarios(
            datos.usuarios
        );

        return;
    }


    // ======================================
    // ALGUIEN ESTÁ ESCRIBIENDO
    // ======================================

    if (datos.tipo === "escribiendo") {

        escribiendo.textContent =
            datos.nombre +
            " está escribiendo...";

        return;
    }


    // ======================================
    // ALGUIEN DEJÓ DE ESCRIBIR
    // ======================================

    if (datos.tipo === "dejo_de_escribir") {

        escribiendo.textContent = "";

        return;
    }


    // ======================================
    // ERROR DEL SERVIDOR
    // ======================================

    if (datos.tipo === "error") {

        alert(
            datos.mensaje
        );

        return;
    }

}


// ==========================================
// MOSTRAR MENSAJE
// ==========================================

function mostrarMensaje(mensaje) {

    const elemento =
        document.createElement("div");

    elemento.classList.add(
        "mensaje"
    );


    const nombre =
        document.createElement("strong");

    nombre.textContent =
        mensaje.nombre + ":";


    const texto =
        document.createElement("span");

    texto.textContent =
        " " + mensaje.texto;


    elemento.appendChild(nombre);

    elemento.appendChild(texto);

    mensajes.appendChild(elemento);


    // Bajar automáticamente
    mensajes.scrollTop =
        mensajes.scrollHeight;

}


// ==========================================
// MOSTRAR AVISO DEL SISTEMA
// ==========================================

function mostrarSistema(texto) {

    const elemento =
        document.createElement("div");

    elemento.classList.add(
        "sistema"
    );


    // textContent evita interpretar HTML
    elemento.textContent = texto;


    mensajes.appendChild(elemento);

    mensajes.scrollTop =
        mensajes.scrollHeight;

}


// ==========================================
// ACTUALIZAR USUARIOS
// ==========================================

function actualizarUsuarios(lista) {

    usuarios.innerHTML = "";


    lista.forEach((nombre) => {

        const elemento =
            document.createElement("li");

        elemento.textContent =
            "🟢 " + nombre;

        usuarios.appendChild(
            elemento
        );

    });

}


// ==========================================
// ENTRAR AL CHAT
// ==========================================

btnEntrar.addEventListener(
    "click",
    () => {

        const nombre =
            inputNombre.value.trim();


        if (!nombre) {

            alert(
                "Escribe tu nombre."
            );

            return;
        }


        miNombre = nombre;


        pantallaNombre.classList.add(
            "oculto"
        );


        chat.classList.remove(
            "oculto"
        );


        conectar();

    }
);


// ==========================================
// AVISAR QUE ESTOY ESCRIBIENDO
// ==========================================

function avisarEscribiendo() {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        return;
    }


    const ahora = Date.now();


    // Máximo un aviso cada 500 ms
    if (
        ahora - ultimoAvisoEscribiendo >= 500
    ) {

        socket.send(
            JSON.stringify({
                tipo: "escribiendo"
            })
        );


        ultimoAvisoEscribiendo =
            ahora;

    }


    // Reiniciar temporizador
    clearTimeout(
        temporizadorEscribiendo
    );


    temporizadorEscribiendo =
        setTimeout(() => {

            if (
                socket &&
                socket.readyState ===
                WebSocket.OPEN
            ) {

                socket.send(
                    JSON.stringify({
                        tipo: "dejo_de_escribir"
                    })
                );

            }

        }, 1000);

}


// ==========================================
// DETECTAR CUANDO ESCRIBE
// ==========================================

inputMensaje.addEventListener(
    "input",
    () => {

        if (
            inputMensaje.value.trim() !== ""
        ) {

            avisarEscribiendo();

        } else {

            clearTimeout(
                temporizadorEscribiendo
            );


            if (
                socket &&
                socket.readyState ===
                WebSocket.OPEN
            ) {

                socket.send(
                    JSON.stringify({
                        tipo: "dejo_de_escribir"
                    })
                );

            }

        }

    }
);


// ==========================================
// ENVIAR MENSAJE
// ==========================================

function enviarMensaje() {

    const texto =
        inputMensaje.value.trim();


    if (!texto) {
        return;
    }


    if (
        !socket ||
        socket.readyState !==
        WebSocket.OPEN
    ) {

        alert(
            "No hay conexión con el servidor."
        );

        return;
    }


    // Detener "está escribiendo"
    clearTimeout(
        temporizadorEscribiendo
    );


    socket.send(
        JSON.stringify({
            tipo: "dejo_de_escribir"
        })
    );


    // Enviar mensaje
    socket.send(
        JSON.stringify({

            tipo: "mensaje",

            texto: texto

        })
    );


    // Limpiar campo
    inputMensaje.value = "";


    // Volver al campo
    inputMensaje.focus();

}


// ==========================================
// BOTÓN ENVIAR
// ==========================================

btnEnviar.addEventListener(
    "click",
    enviarMensaje
);


// ==========================================
// ENTER PARA ENVIAR
// ==========================================

inputMensaje.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            enviarMensaje();

        }

    }
);