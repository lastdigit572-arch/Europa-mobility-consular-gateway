import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-x_oSFXujS9lW_vKLMZYt_HkNwFZdepQ",
  authDomain: "europa-mobility-consular.firebaseapp.com",
  projectId: "europa-mobility-consular",
  storageBucket: "europa-mobility-consular.firebasestorage.app",
  messagingSenderId: "1025473627840",
  appId: "1:1025473627840:web:aeba9bbf8ab560f08e8f25",
  measurementId: "G-8HJEP95JFX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const normPassport = (v) => String(v || "").trim().toUpperCase();
const normPin = (v) => String(v || "").trim();

window.saveClientToFirestore = async function (clientData) {
  const passport_no = normPassport(clientData.passport_no);
  const pin_code = normPin(clientData.pin_code);
  if (!passport_no || !pin_code) return { ok: false, error: "Passport and PIN required." };

  const record = {
    ...clientData,
    passport_no,
    pin_code,
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, "client_dossiers", passport_no), record, { merge: true });
  return { ok: true, data: record };
};

window.loginClientFromFirestore = async function (passportInput, pinInput) {
  const passport_no = normPassport(passportInput);
  const pin_code = normPin(pinInput);
  if (!passport_no || !pin_code) return { ok: false, error: "Passport and PIN required." };

  const snap = await getDoc(doc(db, "client_dossiers", passport_no));
  if (!snap.exists()) return { ok: false, error: "Client record not found." };

  const record = snap.data();
  if (normPin(record.pin_code) !== pin_code) return { ok: false, error: "Invalid PIN." };

  window.currentLoggedInClient = record;
  return { ok: true, data: record };
};

document.addEventListener("DOMContentLoaded", () => {
  const passEl = document.getElementById("quick-passport");
  const pinEl = document.getElementById("quick-pin");
  const container = passEl?.closest("div.space-y-3") || passEl?.parentElement?.parentElement;
  const btnEl = container?.querySelector("button");

  if (passEl && pinEl && btnEl && !btnEl.dataset.emcgBound) {
    btnEl.dataset.emcgBound = "1";
    btnEl.addEventListener("click", async (e) => {
      e.preventDefault();
      const res = await window.loginClientFromFirestore(passEl.value, pinEl.value);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      if (typeof window.renderClientProfile === "function") {
        window.renderClientProfile(res.data);
      } else {
        alert("Login Success: " + (res.data.full_name || res.data.passport_no));
      }
    });
  }
});
