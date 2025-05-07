import { moverAjolote, inicializarControlesAjolote, velocidadActual, actualizarBolasBlancas } from './movi.js';

// Accedemos a THREE y TWEEN desde el global window
const THREE = window.THREE;
const TWEEN = window.TWEEN;

// Variables globales
let scene, camera, renderer, cameraContainer;
let ajolote = null, nenufar = null, peces = [], burbujas = [];
let score = 0, ultimoChoque = 0;
let directionalLight, fog = null;

// Geometrías y materiales
const bubbleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const bubbleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
});

const materialChoque = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.7
});

const efectoChoqueGeometry = new THREE.SphereGeometry(1, 16, 16);

// Efectos de sonido
const sonidos = {
    choque: new Audio('sounds/choque.mp3'),
    comer: new Audio('sounds/comer.mp3'),
    burbuja: new Audio('sounds/burbuja.mp3'),
    lanzamiento: new Audio('sounds/lanzamiento.mp3')
};

// Pool de sonidos para burbujas
const poolSonidosBurbuja = [];
const MAX_SONIDOS_BURBUJA = 3;

// Función para obtener un sonido de burbuja disponible
function obtenerSonidoBurbuja() {
    // Buscar un sonido no en uso
    for (const sonido of poolSonidosBurbuja) {
        if (sonido.paused) return sonido;
    }

    // Si todos están en uso y no hemos alcanzado el máximo, crear uno nuevo
    if (poolSonidosBurbuja.length < MAX_SONIDOS_BURBUJA) {
        const nuevoSonido = sonidos.burbuja.cloneNode(true);
        nuevoSonido.volume = 0.1; // Volumen más bajo
        poolSonidosBurbuja.push(nuevoSonido);
        return nuevoSonido;
    }

    return null; // No hay sonidos disponibles
}

// Inicialización principal
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    cameraContainer = new THREE.Object3D();
    scene.add(cameraContainer);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0);
    cameraContainer.add(camera);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Arena
    const arenaGeometry = new THREE.BoxGeometry(50, 4, 50);
    const arenaMaterial = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
    const arena = new THREE.Mesh(arenaGeometry, arenaMaterial);
    arena.position.y = -2.5;
    arena.receiveShadow = true;
    scene.add(arena);

    // Agua
    const aguaVolumenGeometry = new THREE.BoxGeometry(50, 6, 50);
    const aguaVolumenMaterial = new THREE.MeshStandardMaterial({
        color: 0x3399ff,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.3
    });
    const volumenAgua = new THREE.Mesh(aguaVolumenGeometry, aguaVolumenMaterial);
    volumenAgua.position.y = 2.5;
    scene.add(volumenAgua);

    // Precargar sonidos
    Object.values(sonidos).forEach(sound => {
        sound.preload = 'auto';
        sound.volume = 0.3;
    });

    // Configura los controles
    setupControls();

    // Inicializar controles pasando la escena como segundo parámetro
    inicializarControlesAjolote(cameraContainer, scene);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    cargarModelos();
    window.addEventListener('resize', onWindowResize);
}

// Función para configurar los controles de iluminación y niebla
function setupControls() {
    const lightControl = document.getElementById('light-control');
    const fogControl = document.getElementById('fog-control');

    if (lightControl) {
        lightControl.addEventListener('change', function() {
            directionalLight.visible = this.checked;
        });
    }

    if (fogControl) {
        fogControl.addEventListener('change', function() {
            if (this.checked) {
                // Crear niebla
                fog = new THREE.FogExp2(0x87ceeb, 0.02);
                scene.fog = fog;
            } else {
                // Eliminar niebla
                scene.fog = null;
                fog = null;
            }
        });
    }
}

function crearBurbuja(posicion) {
    const burbuja = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    burbuja.position.copy(posicion);
    burbuja.userData = {
        velocidad: Math.random() * 0.03 + 0.02,
        tiempoVida: 100 + Math.random() * 50
    };
    scene.add(burbuja);
    burbujas.push(burbuja);

    if (Math.random() < 0.1 && sonidos.burbuja) {
        const sonido = obtenerSonidoBurbuja();
        if (sonido) {
            sonido.currentTime = 0;
            sonido.play().catch(e => console.log(e));
        }
    }
}

function crearEfectoChoque() {
    const efecto = new THREE.Mesh(efectoChoqueGeometry, materialChoque);
    efecto.position.copy(cameraContainer.position);
    efecto.position.y += 0.5;
    scene.add(efecto);

    const escalaInicial = 0.5;
    efecto.scale.set(escalaInicial, escalaInicial, escalaInicial);

    new TWEEN.Tween(efecto.scale)
        .to({ x: 2, y: 2, z: 2 }, 300)
        .easing(TWEEN.Easing.Exponential.Out)
        .start();

    new TWEEN.Tween(efecto.material)
        .to({ opacity: 0 }, 500)
        .onComplete(() => scene.remove(efecto))
        .start();
}

function crearNuevoPez() {
    const pez = peces[7].clone();
    const aguaAncho = 45, aguaLargo = 45, aguaProfundidad = 5, aguaY = 0;

    pez.position.set(
        Math.random() * aguaAncho - aguaAncho / 2,
        aguaY + Math.random() * aguaProfundidad,
        Math.random() * aguaLargo - aguaLargo / 2
    );

    pez.userData = {
        velocidad: Math.random() * 0.05 + 0.02,
        direccion: Math.random() * Math.PI * 2,
        velocidadY: (Math.random() - 0.5) * 0.02,
        limitesAgua: {
            minX: -aguaAncho / 2, maxX: aguaAncho / 2,
            minZ: -aguaLargo / 2, maxZ: aguaLargo / 2,
            minY: aguaY, maxY: aguaY + aguaProfundidad
        }
    };

    scene.add(pez);
    peces.push(pez);
}

function cargarModelos() {
    const loader = new THREE.GLTFLoader();

    loader.load('models/minecraft_axolotl.glb', (gltf) => {
        ajolote = gltf.scene;
        ajolote.scale.set(0.5, 0.5, 0.5);
        ajolote.position.set(0.5, 0.5, 0.5);
        ajolote.castShadow = true;
        cameraContainer.add(ajolote);

        loader.load('models/nenufar.glb', (nenufarGltf) => {
            nenufar = nenufarGltf.scene;
            nenufar.scale.set(2, 2, 2);
            nenufar.position.set(0, 0.8, 0);
            scene.add(nenufar);
        }, undefined, console.error);

        cargarPeces();
    }, undefined, console.error);
}

function cargarPeces() {
    const loader = new THREE.GLTFLoader();
    loader.load('models/fish_rose_low_poly.glb', (gltf) => {
        const pezModelo = gltf.scene;
        const aguaAncho = 45, aguaLargo = 45, aguaProfundidad = 5, aguaY = 0;

        for (let i = 0; i < 10; i++) {
            const pez = pezModelo.clone();
            pez.scale.set(0.3, 0.3, 0.3);
            pez.position.set(
                Math.random() * aguaAncho - aguaAncho / 2,
                aguaY + Math.random() * aguaProfundidad,
                Math.random() * aguaLargo - aguaLargo / 2
            );

            pez.userData = {
                velocidad: Math.random() * 0.05 + 0.02,
                direccion: Math.random() * Math.PI * 2,
                velocidadY: (Math.random() - 0.5) * 0.02,
                limitesAgua: {
                    minX: -aguaAncho / 2, maxX: aguaAncho / 2,
                    minZ: -aguaLargo / 2, maxZ: aguaLargo / 2,
                    minY: aguaY, maxY: aguaY + aguaProfundidad
                }
            };

            pez.castShadow = true;
            scene.add(pez);
            peces.push(pez);
        }

        animate();
    }, undefined, console.error);
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    moverAjolote();

    // Actualizar puntuación en pantalla
    document.getElementById('score').textContent = `Puntos: ${score}`;
    console.log(score);

    // Límites y choques
    const aguaAncho = 50, aguaLargo = 50, aguaProfundidad = 6;
    const margen = 1.5;

    if (Math.abs(cameraContainer.position.x) > aguaAncho / 2 - margen ||
        Math.abs(cameraContainer.position.z) > aguaLargo / 2 - margen) {

        if (Date.now() - ultimoChoque > 1000) {
            crearEfectoChoque();
            sonidos.choque.cloneNode(true).play().catch(console.log);
            ultimoChoque = Date.now();
        }

        if (Math.abs(cameraContainer.position.x) > aguaAncho / 2 - margen) {
            velocidadActual.x *= -0.5;
        }
        if (Math.abs(cameraContainer.position.z) > aguaLargo / 2 - margen) {
            velocidadActual.z *= -0.5;
        }
    }

    cameraContainer.position.x = THREE.MathUtils.clamp(
        cameraContainer.position.x,
        -aguaAncho / 2 + margen,
        aguaAncho / 2 - margen
    );

    cameraContainer.position.z = THREE.MathUtils.clamp(
        cameraContainer.position.z,
        -aguaLargo / 2 + margen,
        aguaLargo / 2 - margen
    );

    cameraContainer.position.y = THREE.MathUtils.clamp(
        cameraContainer.position.y,
        0.5,
        aguaProfundidad - 0.5
    );

    // Comportamiento de peces
    peces.forEach((pez, index) => {
        const data = pez.userData;
        const distancia = cameraContainer.position.distanceTo(pez.position);

        // Movimiento del pez
        pez.position.x += Math.sin(data.direccion) * data.velocidad;
        pez.position.z += Math.cos(data.direccion) * data.velocidad;
        pez.position.y += data.velocidadY;
        pez.rotation.y = data.direccion;

        const lim = data.limitesAgua;

        // Rebote en el límite X (cuando el pez está fuera de los límites X)
        if (pez.position.x < lim.minX || pez.position.x > lim.maxX) {
            data.direccion = Math.PI - data.direccion + (Math.random() - 0.5);
            pez.position.x = THREE.MathUtils.clamp(pez.position.x, lim.minX, lim.maxX);

            // Aumentar un poco la velocidad
            data.velocidad = Math.min(data.velocidad + 0.005, 0.2); // Límite para que no se vuelvan locos
        }

        // Rebote en el límite Z (cuando el pez está fuera de los límites Z)
        if (pez.position.z < lim.minZ || pez.position.z > lim.maxZ) {
            data.direccion = -data.direccion + (Math.random() - 0.5);
            pez.position.z = THREE.MathUtils.clamp(pez.position.z, lim.minZ, lim.maxZ);

            // Aumentar un poco la velocidad
            data.velocidad = Math.min(data.velocidad + 0.005, 0.2);
        }

        // Rebote en el límite Y (arriba y abajo)
        if (pez.position.y > lim.maxY || pez.position.y < lim.minY) {
            data.velocidadY *= 1;  // Invertir la velocidad en Y
            pez.position.y = THREE.MathUtils.clamp(pez.position.y, lim.minY, lim.maxY);  // Aseguramos que no se salga del límite
        }

        // Si el pez está cerca del ajolote, eliminamos el pez
        if (distancia < 1) {
            scene.remove(pez);
            peces.splice(index, 1);
            score++;
            sonidos.comer.cloneNode(true).play().catch(console.log);
            crearNuevoPez();  // <-- Siempre crea uno nuevo
        }

        // Crear burbujas con un pequeño porcentaje
        if (Math.random() < 0.05) {
            crearBurbuja(pez.position.clone().add(new THREE.Vector3(0, 0.2, 0)));
        }
    });

    // Burbujas
    burbujas.forEach((burbuja, index) => {
        burbuja.position.y += burbuja.userData.velocidad;
        burbuja.userData.tiempoVida--;

        const escala = 1 + (0.5 * (1 - burbuja.userData.tiempoVida / 150));
        burbuja.scale.set(escala, escala, escala);

        if (burbuja.position.y > 4) {
            burbuja.material.opacity = 0.7 * (1 - (burbuja.position.y - 4) / 2);
        }

        if (burbuja.userData.tiempoVida <= 0 || burbuja.position.y > 6) {
            scene.remove(burbuja);
            burbujas.splice(index, 1);
        }
    });

    // Animación del nenúfar
    if (nenufar) {
        nenufar.position.y = 6 + Math.sin(Date.now() * 0.001) * 0.05;
        nenufar.rotation.y += 0.001;
    }

    // Actualizar bolas blancas (nueva funcionalidad)
    if (window.actualizarBolasBlancas) {
        actualizarBolasBlancas(peces);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();