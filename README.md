# 🎮 Bachillerato Party (Pit Stop / Basta / Tutti Frutti)

Una experiencia multijugador interactiva en tiempo real al estilo **Jackbox Games** y **Kahoot**, diseñada para jugar al **Bachillerato** (también conocido como *Pit Stop*, *Basta*, *Tutti Frutti* o *Stop*).

La plataforma divide la experiencia en **3 pantallas interconectadas** en tiempo real mediante WebSockets:
1. **📺 Pantalla de TV Gigante (`/tv.html`)**: Diseñada para proyectores o Smart TVs. Despliega el código QR gigante para que los jugadores se unan, el carrusel de letras estilo Netflix con física de desaceleración suave, el cronómetro de ronda, la barra de avatares escribiendo en vivo, el aviso monumental de STOP y el ranking animado estilo Kahoot con confeti.
2. **🎛️ Panel del Administrador (`/admin.html`)**: La cabina de control del presentador desde donde se detonan las vistas de la TV, se configuran los tiempos de ronda (30s, 45s, 60s, 90s, 120s o sin límite), se eligen y crean categorías, se carga un fondo PNG global y se moderan las respuestas recibidas.
3. **📱 Pantalla del Jugador Móvil (`/`)**: Interfaz táctil a la que ingresan los participantes escaneando el código QR. Cuenta con selección de avatar, autoguardado continuo de respuestas mientras escriben, indicador visual de letra correcta y el botón dorado de STOP.

---

## ✨ Características Principales

* **Ruleta de Letras estilo Netflix:** Carrusel horizontal continuo de 130 tarjetas que gira con efectos de casino y aterriza exactamente en la letra ganadora sin dejar espacios vacíos.
* **Aviso de STOP Monumental:** Al presionar STOP, el nombre y avatar del jugador toman protagonismo total en la pantalla de TV con tipografía gigante, resplandor neón y cuenta regresiva de 5 segundos.
* **Tensión en los Últimos 10 Segundos:** Sonido de latido acelerado que sube de tono e intensidad conforme el tiempo llega a cero, acompañado de una viñeta roja parpadeante en la TV y buzzer de tiempo agotado.
* **Avatares Escribiendo en Vivo:** La pantalla de TV muestra en tiempo real qué participantes están tecleando activamente con puntos animados (`• • •`).
* **Fondo PNG Global:** El administrador puede subir cualquier imagen PNG o JPG para usarla como fondo temático en la TV y en todos los celulares conectados.
* **Ranking Animado estilo Kahoot:** Tabla de posiciones con medallas de oro, plata y bronce, salto de puntos de la ronda (`🔥 +X pts`) y puntaje acumulado total.
* **Sistema de Puntaje Inteligente:**
  * `+100 pts`: Respuesta válida y única.
  * `+50 pts`: Respuesta válida pero repetida por otro jugador.
  * `+25 pts`: Bonus de velocidad para quien cantó STOP.
  * `0 pts`: Inválida o vacía.
  * Control total para el anfitrión para ajustar puntajes en 1 clic (+100, +50, 0).

---

## 🚀 Instalación y Uso Local

### Prerrequisitos
* Node.js v18 o superior instalado.

### Pasos
1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/bachillerato-party.git
   cd bachillerato-party
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor:
   ```bash
   npm start
   ```

4. Abre las interfaces en tu navegador:
   * **📺 Pantalla de TV:** `http://localhost:3000/tv.html`
   * **🎛️ Panel de Administrador:** `http://localhost:3000/admin.html`
   * **📱 Celulares de Jugadores:** Escanea el QR que aparece en la TV o entra a `http://<TU_IP_LOCAL>:3000/`

---

## ☁️ Despliegue en la Nube

> [!IMPORTANT]
> **Sobre Vercel y WebSockets:**
> Vercel utiliza una arquitectura Serverless orientada a funciones sin estado (stateless) de corta duración, por lo que **no soporta conexiones WebSockets persistentes de Socket.IO**. Para que la sincronización en tiempo real entre la TV, el Admin y los móviles funcione en la nube, se recomienda desplegar en servicios que admitan servidores Node.js continuos:
> - **Render (`render.com`):** Despliegue gratuito en 1 clic conectado a GitHub como *Web Service*.
> - **Railway (`railway.app`):** Soporte nativo para WebSockets y Socket.IO con conexión directa a GitHub.
> - **Fly.io:** Despliegue en contenedores con baja latencia.

---

## 📄 Licencia
MIT
