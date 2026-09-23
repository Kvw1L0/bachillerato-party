// ============================================================================
// CONFIGURACIÓN DE FIREBASE PARA BACHILLERATO PARTY
// ============================================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB9toC79P_4Hv1Y4S8J5mSse6TkqGzaPZw",
  authDomain: "bachillerato-811d3.firebaseapp.com",
  databaseURL: "https://bachillerato-811d3-default-rtdb.firebaseio.com",
  projectId: "bachillerato-811d3",
  storageBucket: "bachillerato-811d3.firebasestorage.app",
  messagingSenderId: "714755740696",
  appId: "1:714755740696:web:28201911c44f1112721f6d"
};

// Comprobación de configuración activa
function isFirebaseConfigured() {
  return FIREBASE_CONFIG && 
         FIREBASE_CONFIG.apiKey && 
         !FIREBASE_CONFIG.apiKey.includes("TU_API_KEY") &&
         FIREBASE_CONFIG.databaseURL &&
         !FIREBASE_CONFIG.databaseURL.includes("tu-proyecto");
}
