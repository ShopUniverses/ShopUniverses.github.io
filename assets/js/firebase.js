/**************************************************
 * FIREBASE.JS
 * Inicialización Firebase - ShopUniverses
 **************************************************/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN REAL
const firebaseConfig = {
    apiKey: "AIzaSyB5zYCn6SD4stzYCawHdrj6oK8zqccWP0Q",
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
    getDocs,
    collection,
    runTransaction
};
