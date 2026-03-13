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
    runTransaction,
    onSnapshot         // ← NUEVO: listener en tiempo real
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyCsFxn0WRCuTPZpICaT542u-fEnJRzhJk4",
    authDomain: "shopuniverses-inventario.firebaseapp.com",
    projectId: "shopuniverses-inventario",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

export {
    db,
    doc,
    getDoc,
    getDocs,
    collection,
    runTransaction,
    onSnapshot         // ← NUEVO
};
