// movi.js - Versión con módulos
const THREE = window.THREE;

// Exporta las variables necesarias
export const velocidadActual = new THREE.Vector3(0, 0, 0);

// Variables internas del módulo (no exportadas)
const maxVel = 0.1;
const aceleracion = 0.1;
const frenado = 0.8;
const sensibilidad = 0.002;

let keys = {};
let rotacionY = 0;
let objetoControlado = null;
let escena = null;
let bolasBlancas = []; // Array para rastrear las bolas

// Exporta las funciones
export function inicializarControlesAjolote(objeto, escenaThree) {
    objetoControlado = objeto;
    escena = escenaThree;
    
    const manejarTeclado = (e, estado) => {
        keys[e.key.toLowerCase()] = estado;
        if (e.code === "Space") keys["space"] = estado;
        if (e.code.includes("Shift")) keys["shift"] = estado;
    };

    window.addEventListener("keydown", (e) => manejarTeclado(e, true));
    window.addEventListener("keyup", (e) => manejarTeclado(e, false));

    document.addEventListener("mousedown", (e) => {
        if (e.button === 0) { // Solo click izquierdo
            document.body.requestPointerLock();
            crearBolaBlanca();
        }
    });

    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === document.body) {
            rotacionY -= e.movementX * sensibilidad;
            objetoControlado.rotation.y = rotacionY;
        }
    });
}

function crearBolaBlanca() {
    if (!escena || !objetoControlado) return;
    
    // Crear geometría y material para la bola blanca
    const geometry = new THREE.SphereGeometry(0.3, 16, 16); // Más grande y detallada
    const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        shininess: 100
    });
    
    const bola = new THREE.Mesh(geometry, material);
    bola.castShadow = true;
    
    // Posicionar la bola frente al ajolote (un poco más adelante)
    const distanciaLanzamiento = 1.5;
    const posicion = new THREE.Vector3(0, 0, -distanciaLanzamiento);
    posicion.applyQuaternion(objetoControlado.quaternion);
    posicion.add(objetoControlado.position);
    posicion.y += 0.5; // Ajuste de altura
    
    bola.position.copy(posicion);
    
    // Velocidad inicial fuerte hacia adelante
    const fuerzaLanzamiento = 0.3;
    const velocidad = new THREE.Vector3(0, 0, -fuerzaLanzamiento);
    velocidad.applyQuaternion(objetoControlado.quaternion);
    
    bola.userData = {
        velocidad: velocidad,
        tiempoVida: 120, // Tiempo de vida en frames
        danio: 10, // Daño que causa a los peces
        radio: 0.3 // Radio para detección de colisiones
    };
    
    escena.add(bola);
    bolasBlancas.push(bola);
    
    // Efecto de sonido (deberías tener un sonido de lanzamiento)
    if (window.sonidos && window.sonidos.lanzamiento) {
        const sonido = window.sonidos.lanzamiento.cloneNode();
        sonido.volume = 0.5;
        sonido.play().catch(e => console.log("Error al reproducir sonido:", e));
    }
}

// Función para actualizar las bolas (debe ser llamada desde el bucle principal)
export function actualizarBolasBlancas(peces) {
    for (let i = bolasBlancas.length - 1; i >= 0; i--) {
        const bola = bolasBlancas[i];
        
        // Actualizar posición
        bola.position.add(bola.userData.velocidad);
        
        // Aplicar gravedad leve
        bola.userData.velocidad.y -= 0.005;
        
        // Reducir tiempo de vida
        bola.userData.tiempoVida--;
        
        // Desvanecer gradualmente
        bola.material.opacity = bola.userData.tiempoVida / 120;
        
        // Detección de colisión con peces
        for (let j = peces.length - 1; j >= 0; j--) {
            const pez = peces[j];
            if (pez.position.distanceTo(bola.position) < 
                (bola.userData.radio + 0.5)) { // 0.5 es el radio aproximado del pez
                
                // Eliminar el pez
                escena.remove(pez);
                peces.splice(j, 1);
                
                // Añadir puntos
                if (window.score !== undefined) {
                    window.score += bola.userData.danio;
                }
                
                // Efecto de sonido
                if (window.sonidos && window.sonidos.comer) {
                    const sonido = window.sonidos.comer.cloneNode();
                    sonido.volume = 0.7;
                    sonido.play().catch(e => console.log(e));
                }
                
                break; // Salir del bucle de peces
            }
        }
        
        // Eliminar bola si su tiempo de vida terminó o está muy lejos
        if (bola.userData.tiempoVida <= 0 || 
            bola.position.length() > 50) {
            escena.remove(bola);
            bolasBlancas.splice(i, 1);
        }
    }
}

export function moverAjolote() {
    if (!objetoControlado) return;

    let direccion = new THREE.Vector3(0, 0, 0);

    if (keys["w"] || keys["arrowup"]) direccion.z -= 1;
    if (keys["s"] || keys["arrowdown"]) direccion.z += 1;
    if (keys["a"] || keys["arrowleft"]) direccion.x -= 1;
    if (keys["d"] || keys["arrowright"]) direccion.x += 1;

    if (direccion.length() > 0) {
        direccion.normalize();
        direccion.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotacionY);
        
        velocidadActual.x += (direccion.x * maxVel - velocidadActual.x) * aceleracion;
        velocidadActual.z += (direccion.z * maxVel - velocidadActual.z) * aceleracion;
    } else {
        velocidadActual.multiplyScalar(frenado);
    }

    const vertical = (keys["space"] ? 1 : 0) + (keys["shift"] ? -1 : 0);
    velocidadActual.y += (vertical * maxVel - velocidadActual.y) * aceleracion;

    objetoControlado.position.add(velocidadActual);
}

// Hacemos las variables accesibles globalmente
window.moverAjolote = moverAjolote;
window.inicializarControlesAjolote = inicializarControlesAjolote;
window.velocidadActual = velocidadActual;
window.actualizarBolasBlancas = actualizarBolasBlancas;