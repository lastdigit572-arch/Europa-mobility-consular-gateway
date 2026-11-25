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
  const passport_no = normPassport(
    clientData.passport_no || clientData.passportNumber || clientData.passport
  );
  const pin_code = normPin(clientData.pin_code || clientData.pin);

  if (!passport_no || !pin_code) {
    return { ok: false, error: "Passport and PIN required." };
  }

  const record = {
    ...clientData,
    passport: passport_no,
    passport_no,
    passportNumber: passport_no,
    pin: pin_code,
    pin_code,
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

function syncAllClientDBToFirestore() {
  try {
    const dbObj = window.clientDB || {};
    Object.values(dbObj).forEach((c) => {
      if (c && (c.passport || c.passport_no || c.passportNumber) && (c.pin || c.pin_code)) {
        window.saveClientToFirestore(c).catch((err) => console.error("Firestore save error:", err));
      }
    });
  } catch (e) {
    console.error("Sync loop error:", e);
  }
}

function attachFirestoreHooks() {
  // ১. saveDB চললে Firestore-এ সেভ করবে
  if (typeof window.saveDB === "function" && !window.saveDB._fsWrapped) {
    const origSaveDB = window.saveDB;
    window.saveDB = function (...args) {
      const result = origSaveDB.apply(this, args);
      syncAllClientDBToFirestore();
      return result;
    };
    window.saveDB._fsWrapped = true;
  }

  // ২. লগইন বাটন/ফর্মে ক্লিক করলে আগে Firestore থেকে ডেটা এনে clientDB-তে বসাবে
  const loginBtns = document.querySelectorAll(
    'button[onclick*="loginClientFromInputs"], button[onclick*="loginClient"]'
  );

  loginBtns.forEach((btn) => {
    if (btn.dataset.fsLoginBound) return;
    btn.dataset.fsLoginBound = "1";

    btn.addEventListener(
      "click",
      async function (e) {
        const passEl =
          document.getElementById("modal-passport-input") ||
          document.getElementById("quick-passport");
        const pinEl =
          document.getElementById("modal-pin-input") ||
          document.getElementById("quick-pin");

        const pVal = normPassport(passEl?.value);
        const pinVal = normPin(pinEl?.value);

        if (!pVal || !pinVal) return;

        // ইতিমধ্যে লোকাল clientDB-তে থাকলে আলাদা করে আটকাবে না
        if (window.clientDB && window.clientDB[pVal] && normPin(window.clientDB[pVal].pin) === pinVal) {
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        try {
          const res = await window.loginClientFromFirestore(pVal, pinVal);
          if (res.ok && res.data) {
            window.clientDB = window.clientDB || {};
            window.clientDB[pVal] = {
              ...res.data,
              passport: pVal,
              pin: pinVal,
              name: res.data.name || res.data.full_name || pVal
            };
            if (typeof window.saveDB === "function" && window.saveDB._fsWrapped) {
              // শুধু localStorage-এ রাখার জন্য
              try {
                localStorage.setItem("emcg_client_dossiers_v4", JSON.stringify(window.clientDB));
              } catch (_) {}
            }
            if (typeof window.closeModal === "function") {
              window.closeModal("client-login-modal");
            }
            window.activeClientPassport = pVal;
            if (typeof window.renderClientProfile === "function") {
              window.renderClientProfile(window.clientDB[pVal]);
            }
          } else {
            if (typeof window.showToast === "function") {
              window.showToast(res.error || "Access Denied: Invalid Passport Number or Security PIN.");
            } else {
              alert(res.error || "Invalid Passport or PIN.");
            }
          }
        } catch (err) {
          console.error("Firestore login error:", err);
          if (typeof window.showToast === "function") {
            window.showToast("Network/Database error while checking client record.");
          }
        }
      },
      true
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  attachFirestoreHooks();
  setTimeout(attachFirestoreHooks, 400);
  setTimeout(attachFirestoreHooks, 1200);
});
