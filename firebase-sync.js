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

window.saveClientToFirestore = async function (clientData = {}) {
  const passport_no = normPassport(clientData.passport_no || clientData.passportNumber || clientData.passport);
  const pin_code = normPin(clientData.pin_code || clientData.pin);

  if (!passport_no || !pin_code) {
    return { ok: false, error: "Passport and PIN required." };
  }

  const record = {
    ...clientData,
    passport_no,
    pin_code,
    passportNumber: passport_no,
    pin: pin_code,
    passport: passport_no,
    name: clientData.name || clientData.full_name || clientData.fullName || "",
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, "client_dossiers", passport_no), record, { merge: true });
  return { ok: true, data: record };
};

window.loginClientFromFirestore = async function (passportInput, pinInput) {
  const passport_no = normPassport(passportInput);
  const pin_code = normPin(pinInput);

  if (!passport_no || !pin_code) {
    return { ok: false, error: "Passport and PIN required." };
  }

  const snap = await getDoc(doc(db, "client_dossiers", passport_no));
  if (!snap.exists()) {
    return { ok: false, error: "Client record not found." };
  }

  const record = snap.data();
  const savedPin = normPin(record.pin_code || record.pin);

  if (savedPin !== pin_code) {
    return { ok: false, error: "Invalid PIN." };
  }

  window.currentLoggedInClient = record;
  return { ok: true, data: record };
};

function hookAppWithFirestore() {
  // ১. saveDB() কল হলে সব ক্লায়েন্টকে Firestore-এ সেভ করবে
  if (typeof window.saveDB === "function" && !window.saveDB._fsHooked) {
    const origSaveDB = window.saveDB;
    window.saveDB = function (...args) {
      const res = origSaveDB.apply(this, args);
      try {
        const dbObj = window.clientDB || {};
        Object.values(dbObj).forEach((c) => {
          if (c && (c.passport || c.passport_no || c.passportNumber) && (c.pin || c.pin_code)) {
            window.saveClientToFirestore(c).catch(() => {});
          }
        });
      } catch (e) {}
      return res;
    };
    window.saveDB._fsHooked = true;
  }

  // ২. loginClientFromInputs() কল হলে আগে Firestore থেকে ক্লায়েন্ট এনে clientDB-তে বসাবে
  if (typeof window.loginClientFromInputs === "function" && !window.loginClientFromInputs._fsHooked) {
    const origLogin = window.loginClientFromInputs;
    window.loginClientFromInputs = async function (passInputId, pinInputId) {
      const passVal = normPassport(document.getElementById(passInputId)?.value);
      const pinVal = normPin(document.getElementById(pinInputId)?.value);

      if (passVal && pinVal) {
        try {
          const fsRes = await window.loginClientFromFirestore(passVal, pinVal);
          if (fsRes.ok && fsRes.data) {
            window.clientDB = window.clientDB || {};
            const existing = window.clientDB[passVal] || {};
            window.clientDB[passVal] = {
              ...existing,
              ...fsRes.data,
              passport: passVal,
              pin: pinVal,
              name: fsRes.data.name || fsRes.data.full_name || existing.name || passVal
            };
          }
        } catch (e) {}
      }
      return origLogin.apply(this, arguments);
    };
    window.loginClientFromInputs._fsHooked = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  hookAppWithFirestore();
  setTimeout(hookAppWithFirestore, 500);
});
