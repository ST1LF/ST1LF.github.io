import { FIREBASE_CONFIG } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, signInWithPopup,
  GoogleAuthProvider, GithubAuthProvider, OAuthProvider
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

const $ = id => document.getElementById(id);
const msg = (text, ok = false) => { $("msg").textContent = text || ""; $("msg").className = "msg" + (ok ? " ok" : ""); };

/* ---------- Вход и выход ---------- */
async function signIn(provider) {
  msg("");
  const p = provider === "google" ? new GoogleAuthProvider()
          : provider === "github" ? new GithubAuthProvider()
          : new OAuthProvider("apple.com");
  try { await signInWithPopup(auth, p); }
  catch (e) { msg(e.message || String(e)); }
}

async function logout() {
  msg("");
  try { await signOut(auth); msg("Вы вышли из аккаунта.", true); }
  catch (e) { msg(e.message || String(e)); }
}

/* ---------- Заметки в Firestore: users/{uid}/notes ---------- */
let unsubNotes = null;

function renderNotes(items) {
  const ul = $("noteList"); ul.textContent = "";
  items.forEach(n => {
    const li = document.createElement("li");
    const t = document.createElement("span"); t.textContent = n.text;
    const b = document.createElement("button"); b.type = "button"; b.textContent = "Удалить";
    b.addEventListener("click", () => removeNote(n.id));
    li.append(t, b); ul.append(li);
  });
  $("noteEmpty").classList.toggle("hidden", items.length > 0);
}

function watchNotes(uid) {
  if (unsubNotes) { unsubNotes(); unsubNotes = null; }
  if (!uid) { renderNotes([]); return; }
  const q = query(collection(db, "users", uid, "notes"), orderBy("createdAt", "desc"));
  unsubNotes = onSnapshot(q,
    snap => renderNotes(snap.docs.map(d => ({ id: d.id, text: d.data().text }))),
    e => msg(e.message));
}

async function addNote(text) {
  if (!auth.currentUser) return;
  try { await addDoc(collection(db, "users", auth.currentUser.uid, "notes"), { text, createdAt: serverTimestamp() }); }
  catch (e) { msg(e.message || String(e)); }
}

async function removeNote(id) {
  if (!auth.currentUser) return;
  try { await deleteDoc(doc(db, "users", auth.currentUser.uid, "notes", id)); }
  catch (e) { msg(e.message || String(e)); }
}

/* ---------- Отображение ---------- */
function render(user) {
  $("signedOut").classList.toggle("hidden", !!user);
  $("signedIn").classList.toggle("hidden", !user);
  if (!user) return;
  const name = user.displayName || "Без имени";
  const provider = (user.providerData[0] && user.providerData[0].providerId || "").replace(".com", "");
  $("userName").textContent  = name;
  $("userEmail").textContent = user.email || "";
  $("userMeta").textContent  = "Вход выполнен через " + provider;
  $("avatarFallback").textContent = name.trim().charAt(0).toUpperCase();
  const img = $("avatar");
  if (user.photoURL) { img.src = user.photoURL; img.classList.remove("hidden"); $("avatarFallback").classList.add("hidden"); }
  else { img.classList.add("hidden"); $("avatarFallback").classList.remove("hidden"); }
}

/* ---------- Слушатели ---------- */
document.querySelectorAll(".prov").forEach(b => b.addEventListener("click", () => signIn(b.dataset.provider)));
$("logout").addEventListener("click", logout);
$("addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("noteText"), text = input.value.trim();
  if (!text) return;
  input.value = "";
  await addNote(text);
});

onAuthStateChanged(auth, user => { render(user); watchNotes(user ? user.uid : null); });
