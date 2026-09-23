// ============================================================================
// CONFIGURACIÓN DE FIREBASE PARA BACHILLERATO PARTY
// ============================================================================
// 1. Entra a https://console.firebase.google.com/
// 2. Crea un proyecto (o usa uno existente) y haz clic en "Agregar app" (icono </> Web).
// 3. Activa "Realtime Database" en el menú lateral izquierdo -> "Crear base de datos"
//    (Elige la ubicación por defecto y selecciona "Modo de prueba" para permitir lectura/escritura).
// 4. Copia los valores de tu objeto firebaseConfig y pégalos aquí abajo:

const FIREBASE_CONFIG = {
  apiKey: "AIzaSy_TU_API_KEY_AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Comprobación de configuración activa
function isFirebaseConfigured() {
  return FIREBASE_CONFIG && 
         FIREBASE_CONFIG.apiKey && 
         !FIREBASE_CONFIG.apiKey.includes("TU_API_KEY") &&
         FIREBASE_CONFIG.databaseURL &&
         !FIREBASE_CONFIG.databaseURL.includes("tu-proyecto");
}
