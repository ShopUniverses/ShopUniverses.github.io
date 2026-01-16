/**************************************************
 * FIREBASE.JS
 * Inicialización Firebase - ShopUniverses
 **************************************************/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN REAL
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "shopuniverses-inventario.firebaseapp.com",
    projectId: "shopuniverses-inventario",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Firestore
const db = getFirestore(app);

// Exportar lo necesario
export {
    db,
    doc,
    getDoc,
    runTransaction
};
