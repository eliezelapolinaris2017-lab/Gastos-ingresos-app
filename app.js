/* Oasis Gastos/Ingresos — Pro (GitHub Pages, localStorage + Firebase Cloud Sync) */
const HUB_URL = "https://eliezelapolinaris2017-lab.github.io/oasis-hub/";
const KEY = "oasis_cashflow_pro_v1";

/* Firebase (MISMO proyecto que facturación) */
const OWNER_EMAIL = "nexustoolspr@gmail.com";
const FIREBASE_APP_NAME = "oasis-suite"; // para evitar choque si ya inicializaste en otra app

const firebaseConfig = {
  apiKey: "AIzaSyBm67RjL0QzMRLfo6zUYCI0bak1eGJAR-U",
  authDomain: "oasis-facturacion.firebaseapp.com",
  projectId: "oasis-facturacion",
  storageBucket: "oasis-facturacion.firebasestorage.app",
  messagingSenderId: "84422038905",
  appId: "1:84422038905:web:b0eef65217d2bfc3298ba8"
};

let fbApp = null;
let fbAuth = null;
let fbDb = null;
let fbUser = null;

/* Utils */
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n||0));
const isoToday = () => new Date().toISOString().slice(0,10);
const uid = (p="id") => `${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const escapeHtml = (s="") =>
  String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));

const daysBetween = (aIso, bIso) => {
  const a = new Date(aIso);
  const b = new Date(bIso);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000*60*60*24)));
};

function inRange(iso, from, to){
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

/* ========== Local DB ========== */
function loadDB(){
  return JSON.parse(localStorage.getItem(KEY) || JSON.stringify({
    cats: [],
    tx: [],
    recurring: [],
    meta: {
      lastRecurringRun: "",
      lastBackupAt: "",        // ISO datetime
      backupNagDismissedAt: "" // ISO datetime (opcional)
    }
  }));
}
function saveDB(db){ localStorage.setItem(KEY, JSON.stringify(db)); }

/* ========== Firebase wiring ========== */
function initFirebase(){
  try{
    // compat: firebase global
    if (!window.firebase) return;

    // Reuse existing app if already initialized
    try{
      fbApp = firebase.app(FIREBASE_APP_NAME);
    }catch{
      fbApp = firebase.initializeApp(firebaseConfig, FIREBASE_APP_NAME);
    }

    fbAuth = firebase.auth(fbApp);
    fbDb = firebase.firestore(fbApp);

  }catch(e){
    console.warn("Firebase init error:", e);
  }
}

function assertOwner(u){
  if (!u) throw new Error("No hay sesión.");
  const email = String(u.email||"").toLowerCase();
  if (email !== OWNER_EMAIL) throw new Error("Cuenta no autorizada.");
  return true;
}

function docRef(){
  // users/{uid}/apps/cashflow
  return fbDb.collection("users").doc(fbUser.uid).collection("apps").doc("cashflow");
}

async function cloudPull(){
  if (!fbUser || !fbDb) return false;
  const snap = await docRef().get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const cloud = data.db;
  if (!cloud) return false;

  // Merge cloud -> local (cloud manda)
  const local = loadDB();
  const merged = {
    cats: Array.isArray(cloud.cats) ? cloud.cats : (local.cats||[]),
    tx: Array.isArray(cloud.tx) ? cloud.tx : (local.tx||[]),
    recurring: Array.isArray(cloud.recurring) ? cloud.recurring : (local.recurring||[]),
    meta: { ...(local.meta||{}), ...(cloud.meta||{}), cloudUpdatedAt: data.updatedAt || "" }
  };
  saveDB(merged);
  return true;
}

async function cloudPush(){
  if (!fbUser || !fbDb) return;
  const db = loadDB();
  const payload = {
    updatedAt: new Date().toISOString(),
    ownerEmail: OWNER_EMAIL,
    db
  };
  await docRef().set(payload, { merge: true });
}

async function loginGoogle(){
  if (!fbAuth) return alert("Firebase no está listo.");
  try{
    const prov = new firebase.auth.GoogleAuthProvider();
    const res = await fbAuth.signInWithPopup(prov);
    assertOwner(res.user);
  }catch(e){
    console.warn(e);
    alert("Login cancelado o bloqueado.");
    try{ await fbAuth.signOut(); }catch{}
  }
}

async function logout(){
  try{ await fbAuth.signOut(); }catch{}
}

function wireAuthButtons(){
  // Opcionales: si existen, los usa
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");
  const pill = $("authPill");

  if (btnLogin) btnLogin.addEventListener("click", loginGoogle);
  if (btnLogout) btnLogout.addEventListener("click", logout);

  if (!fbAuth) {
    if (pill) pill.textContent = "Offline";
    return;
  }

  fbAuth.onAuthStateChanged(async (u)=>{
    if (!u){
      fbUser = null;
      if (pill) pill.textContent = "Offline";
      if (btnLogin) btnLogin.style.display = "";
      if (btnLogout) btnLogout.style.display = "none";
      return;
    }
    try{
      assertOwner(u);
      fbUser = u;

      if (btnLogin) btnLogin.style.display = "none";
      if (btnLogout) btnLogout.style.display = "";

      if (pill) pill.textContent = `Cloud: ${OWNER_EMAIL}`;

      // Pull once on login, then render
      await cloudPull();
      renderCats();
      renderRecurring();
      resetTxForm();
      renderTxTable();
      refreshAll();

      // Optional: live listener (si quieres “tiempo real”)
      // docRef().onSnapshot(()=>{ cloudPull().then(()=>{ renderTxTable(); refreshAll(); }); });

    }catch(e){
      alert(e.message || "Cuenta no autorizada.");
      try{ await fbAuth.signOut(); }catch{}
      fbUser = null;
      if (pill) pill.textContent = "Offline";
    }
  });
}

/* ========== DOM ========== */
const tabs = $("tabs");
const views = {
  dashboard: $("view-dashboard"),
  transactions: $("view-transactions"),
  categories: $("view-categories"),
  recurring: $("view-recurring"),
  data: $("view-data"),
};
function setView(name){
  Object.keys(views).forEach(k => views[k].classList.toggle("is-active", k===name));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.view===name));
}

/* KPI */
const kpiIncome = $("kpiIncome");
const kpiExpense = $("kpiExpense");
const kpiNet = $("kpiNet");

// NUEVO KPI BACKUP (opcional en HTML)
const kpiBackup = $("kpiBackup");
const kpiBackupHint = $("kpiBackupHint");
const kpiBackupSub = $("kpiBackupSub");

const dashPill = $("dashPill");
const dashGrid = $("dashGrid");
const pFrom = $("pFrom");
const pTo = $("pTo");

/* Tx form */
let activeTxId = null;
const txMode = $("txMode");
const txType = $("txType");
const txDate = $("txDate");
const txAmount = $("txAmount");
const txCategory = $("txCategory");
const txMethod = $("txMethod");
const txStatus = $("txStatus");
const txParty = $("txParty");
const txRef = $("txRef");
const txTags = $("txTags");
const txReceipt = $("txReceipt");
const txNotes = $("txNotes");
const receiptMeta = $("receiptMeta");
const receiptImg = $("receiptImg");

const btnQuickAdd = $("btnQuickAdd");
const btnSaveTx = $("btnSaveTx");
const btnDuplicate = $("btnDuplicate");
const btnDeleteTx = $("btnDeleteTx");

/* Tx list + filters */
const fText = $("fText");
const fType = $("fType");
const fStatus = $("fStatus");
const fCategory = $("fCategory");
const fMethod = $("fMethod");
const fFrom = $("fFrom");
const fTo = $("fTo");
const btnClearFilters = $("btnClearFilters");
const txBody = $("txBody");

/* Cats */
const btnSeedCats = $("btnSeedCats");
const btnClearCats = $("btnClearCats");
const catName = $("catName");
const catType = $("catType");
const catColor = $("catColor");
const btnAddCat = $("btnAddCat");
const catBody = $("catBody");

/* Recurring */
const rType = $("rType");
const rCategory = $("rCategory");
const rAmount = $("rAmount");
const rDay = $("rDay");
const rParty = $("rParty");
const rMemo = $("rMemo");
const btnAddRecurring = $("btnAddRecurring");
const btnRunRecurring = $("btnRunRecurring");
const btnClearRecurring = $("btnClearRecurring");
const recBody = $("recBody");

/* Data */
const btnExport = $("btnExport");
const btnImport = $("btnImport");
const importFile = $("importFile");
const btnReset = $("btnReset");

/* ========== Categories ========== */
function seedCats(){
  const base = [
    { name:"Ventas / Servicios", type:"INCOME", color:"#00c853" },
    { name:"Mantenimientos", type:"INCOME", color:"#22d3ee" },
    { name:"Instalaciones", type:"INCOME", color:"#0a3cff" },
    { name:"Emergencias", type:"INCOME", color:"#7c3aed" },

    { name:"Materiales / Repuestos", type:"EXPENSE", color:"#ff9800" },
    { name:"Combustible", type:"EXPENSE", color:"#ef4444" },
    { name:"Herramientas", type:"EXPENSE", color:"#d6b15a" },
    { name:"Teléfono / Internet", type:"EXPENSE", color:"#22d3ee" },
    { name:"Publicidad", type:"EXPENSE", color:"#7c3aed" },
    { name:"Renta / Oficina", type:"EXPENSE", color:"#ff9800" },
  ];

  const db = loadDB();
  const exist = new Set((db.cats||[]).map(c=>c.name.toLowerCase()));
  base.forEach(c=>{
    if (!exist.has(c.name.toLowerCase())){
      db.cats.push({ id: uid("cat"), ...c, createdAt:new Date().toISOString() });
    }
  });
  saveDB(db);
  renderCats();
  refreshAll();
  cloudPushSafe();
}

function addCat(){
  const name = (catName.value||"").trim();
  const type = catType.value;
  const color = catColor.value || "#22d3ee";
  if (!name) return alert("Nombre requerido.");

  const db = loadDB();
  if ((db.cats||[]).some(c=>c.name.toLowerCase()===name.toLowerCase())) return alert("Esa categoría ya existe.");

  db.cats.push({ id: uid("cat"), name, type, color, createdAt:new Date().toISOString() });
  saveDB(db);

  catName.value = "";
  renderCats();
  refreshAll();
  cloudPushSafe();
}

function renderCats(){
  const db = loadDB();
  const cats = [...(db.cats||[])].sort((a,b)=>a.name.localeCompare(b.name));

  catBody.innerHTML = "";
  if (!cats.length){
    catBody.innerHTML = `<tr><td colspan="4" style="opacity:.7;padding:14px">Sin categorías. Usa “Plantilla”.</td></tr>`;
  } else {
    cats.forEach(c=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.type)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:8px">
          <span style="width:14px;height:14px;border-radius:6px;background:${escapeHtml(c.color)};border:1px solid rgba(255,255,255,.18)"></span>
          <span>${escapeHtml(c.color)}</span>
        </span></td>
        <td>
          <button class="btn danger" type="button" data-del-cat="${escapeHtml(c.id)}">Borrar</button>
        </td>
      `;
      catBody.appendChild(tr);
    });
  }

  catBody.querySelectorAll("[data-del-cat]").forEach(b=>{
    b.addEventListener("click", ()=>{
      if (!confirm("¿Borrar categoría?")) return;
      const id = b.dataset.delCat;
      const db = loadDB();
      db.cats = (db.cats||[]).filter(c=>c.id!==id);
      saveDB(db);
      renderCats();
      refreshAll();
      cloudPushSafe();
    });
  });

  fillCategorySelects();
}

function fillCategorySelects(){
  const db = loadDB();
  const cats = [...(db.cats||[])].sort((a,b)=>a.name.localeCompare(b.name));

  const makeOpt = (c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    o.dataset.color = c.color || "#22d3ee";
    o.dataset.type = c.type || "BOTH";
    return o;
  };

  txCategory.innerHTML = "";
  cats.forEach(c=> txCategory.appendChild(makeOpt(c)));

  fCategory.innerHTML = `<option value="">Categoría (Todas)</option>`;
  cats.forEach(c=> fCategory.appendChild(makeOpt(c)));

  rCategory.innerHTML = "";
  cats.forEach(c=> rCategory.appendChild(makeOpt(c)));

  if (!cats.length){
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "No hay categorías";
    txCategory.appendChild(o);
    rCategory.appendChild(o.cloneNode(true));
  }
}

/* ========== Receipt handling ========== */
function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(String(r.result||""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function showReceipt(rec){
  if (!rec || !rec.dataUrl){
    receiptMeta.textContent = "Sin recibo";
    receiptImg.style.display = "none";
    receiptImg.src = "";
    return;
  }
  receiptMeta.textContent = `${rec.name} · ${(rec.sizeKB||0)} KB`;
  receiptImg.src = rec.dataUrl;
  receiptImg.style.display = "block";
}

/* ========== Transactions ========== */
function resetTxForm(){
  activeTxId = null;
  txMode.textContent = "Nuevo";
  txType.value = "INCOME";
  txDate.value = isoToday();
  txAmount.value = "";
  txMethod.value = "EFECTIVO";
  txStatus.value = "PAGADO";
  txParty.value = "";
  txRef.value = "";
  txTags.value = "";
  txNotes.value = "";
  txReceipt.value = "";
  showReceipt(null);
}

async function saveTx(){
  const db = loadDB();

  if (!(db.cats||[]).length){
    alert("Primero crea categorías (Plantilla).");
    setView("categories");
    return;
  }

  const type = txType.value;
  const date = txDate.value || isoToday();
  const amount = Number(txAmount.value||0);
  const categoryId = txCategory.value;
  const method = txMethod.value;
  const status = txStatus.value;
  const party = (txParty.value||"").trim();
  const ref = (txRef.value||"").trim();
  const tags = (txTags.value||"").trim();
  const notes = (txNotes.value||"").trim();

  if (!amount || amount <= 0) return alert("Monto inválido.");
  if (!categoryId) return alert("Selecciona categoría.");

  let receipt = null;
  const file = txReceipt.files?.[0];
  if (file){
    const dataUrl = await readFileAsDataURL(file);
    receipt = { name:file.name, type:file.type, sizeKB: Math.round(file.size/1024), dataUrl };
  } else if (activeTxId){
    const existing = (db.tx||[]).find(t=>t.id===activeTxId);
    receipt = existing?.receipt || null;
  }

  const item = {
    id: activeTxId || uid("tx"),
    type, date, amount, categoryId, method, status,
    party, ref, tags, notes,
    receipt,
    updatedAt: new Date().toISOString(),
  };

  const idx = (db.tx||[]).findIndex(t=>t.id===item.id);
  if (idx >= 0) db.tx[idx] = { ...db.tx[idx], ...item };
  else db.tx.unshift({ ...item, createdAt: new Date().toISOString() });

  saveDB(db);
  activeTxId = item.id;
  txMode.textContent = "Editando";

  renderTxTable();
  refreshAll();
  cloudPushSafe();
  alert("Guardado ✅");
}

function duplicateTx(){
  if (!activeTxId){
    alert("Nada para duplicar. Guarda o abre una transacción.");
    return;
  }
  const db = loadDB();
  const t = (db.tx||[]).find(x=>x.id===activeTxId);
  if (!t) return;

  const copy = { ...t, id: uid("tx"), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  db.tx.unshift(copy);
  saveDB(db);

  openTx(copy.id);
  renderTxTable();
  refreshAll();
  cloudPushSafe();
  alert("Duplicado ✅");
}

function deleteTx(){
  if (!activeTxId){
    resetTxForm();
    return;
  }
  if (!confirm("¿Borrar transacción?")) return;

  const db = loadDB();
  db.tx = (db.tx||[]).filter(t=>t.id!==activeTxId);
  saveDB(db);

  resetTxForm();
  renderTxTable();
  refreshAll();
  cloudPushSafe();
}

function openTx(id){
  const db = loadDB();
  const t = (db.tx||[]).find(x=>x.id===id);
  if (!t) return;

  activeTxId = t.id;
  txMode.textContent = "Editando";

  txType.value = t.type || "INCOME";
  txDate.value = t.date || isoToday();
  txAmount.value = String(t.amount || "");
  txCategory.value = t.categoryId || "";
  txMethod.value = t.method || "EFECTIVO";
  txStatus.value = t.status || "PAGADO";
  txParty.value = t.party || "";
  txRef.value = t.ref || "";
  txTags.value = t.tags || "";
  txNotes.value = t.notes || "";
  txReceipt.value = "";
  showReceipt(t.receipt || null);

  setView("transactions");
  window.scrollTo({top:0,behavior:"smooth"});
}

/* Filters + table render */
function getCat(db, id){
  return (db.cats||[]).find(c=>c.id===id) || null;
}

function passesFilters(t, db){
  const text = (fText.value||"").trim().toLowerCase();
  const type = fType.value;
  const status = fStatus.value;
  const cat = fCategory.value;
  const method = fMethod.value;
  const from = fFrom.value || "";
  const to = fTo.value || "";

  if (type && t.type !== type) return false;
  if (status && t.status !== status) return false;
  if (cat && t.categoryId !== cat) return false;
  if (method && t.method !== method) return false;
  if (!inRange(t.date, from, to)) return false;

  if (text){
    const hay = [t.ref,t.party,t.notes,t.tags].join(" ").toLowerCase();
    if (!hay.includes(text)) return false;
  }
  return true;
}

function renderTxTable(){
  const db = loadDB();
  const rows = (db.tx||[]).filter(t=>passesFilters(t, db)).sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  txBody.innerHTML = "";
  if (!rows.length){
    txBody.innerHTML = `<tr><td colspan="8" style="opacity:.7;padding:14px">Sin transacciones.</td></tr>`;
    return;
  }

  rows.forEach(t=>{
    const c = getCat(db, t.categoryId);
    const catName = c?.name || "—";
    const color = c?.color || "#22d3ee";

    const badgeType = t.type==="INCOME" ? "in" : "out";
    const badgeLabel = t.type==="INCOME" ? "Ingreso" : "Gasto";
    const badgeStatus = t.status==="PENDIENTE" ? `<span class="badge pending">Pendiente</span>` : `<span class="badge">Pagado</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.date||"")}</td>
      <td><span class="badge ${badgeType}">${badgeLabel}</span></td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:8px">
          <span style="width:12px;height:12px;border-radius:6px;background:${escapeHtml(color)};border:1px solid rgba(255,255,255,.18)"></span>
          ${escapeHtml(catName)}
        </span>
      </td>
      <td>${escapeHtml(t.method||"")}</td>
      <td>${escapeHtml(t.party||"—")}</td>
      <td>${badgeStatus}</td>
      <td><strong>${escapeHtml(fmt(t.amount||0))}</strong></td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" type="button" data-open="${escapeHtml(t.id)}">Abrir</button>
          <button class="btn ghost" type="button" data-receipt="${escapeHtml(t.id)}">Recibo</button>
        </div>
      </td>
    `;
    txBody.appendChild(tr);
  });

  txBody.querySelectorAll("[data-open]").forEach(b=>{
    b.addEventListener("click", ()=>openTx(b.dataset.open));
  });

  txBody.querySelectorAll("[data-receipt]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const db = loadDB();
      const t = (db.tx||[]).find(x=>x.id===b.dataset.receipt);
      if (!t?.receipt) return alert("Esta transacción no tiene recibo.");
      showReceipt(t.receipt);
      setView("transactions");
      window.scrollTo({top:0,behavior:"smooth"});
    });
  });
}

function clearFilters(){
  fText.value = "";
  fType.value = "";
  fStatus.value = "";
  fCategory.value = "";
  fMethod.value = "";
  fFrom.value = "";
  fTo.value = "";
  renderTxTable();
}

/* ========== Recurring ========== */
function addRecurring(){
  const db = loadDB();
  if (!(db.cats||[]).length){
    alert("Crea categorías primero.");
    setView("categories");
    return;
  }

  const type = rType.value;
  const categoryId = rCategory.value;
  const amount = Number(rAmount.value||0);
  const day = Number(rDay.value||1);
  const party = (rParty.value||"").trim();
  const memo = (rMemo.value||"").trim();

  if (!categoryId) return alert("Selecciona categoría.");
  if (!amount || amount<=0) return alert("Monto inválido.");
  if (!day || day<1 || day>28) return alert("Día debe ser 1-28.");

  db.recurring.unshift({
    id: uid("rec"),
    type, categoryId, amount, day, party, memo,
    createdAt: new Date().toISOString()
  });
  saveDB(db);

  rAmount.value = "";
  rParty.value = "";
  rMemo.value = "";

  renderRecurring();
  refreshAll();
  cloudPushSafe();
  alert("Recurrente guardado ✅");
}

function renderRecurring(){
  const db = loadDB();
  const rows = (db.recurring||[]);

  recBody.innerHTML = "";
  if (!rows.length){
    recBody.innerHTML = `<tr><td colspan="7" style="opacity:.7;padding:14px">Sin recurrentes.</td></tr>`;
    return;
  }

  rows.forEach(r=>{
    const c = getCat(db, r.categoryId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(c?.name || "—")}</td>
      <td>${escapeHtml(String(r.day||""))}</td>
      <td><strong>${escapeHtml(fmt(r.amount||0))}</strong></td>
      <td>${escapeHtml(r.party||"—")}</td>
      <td>${escapeHtml(r.memo||"—")}</td>
      <td><button class="btn danger" type="button" data-del-rec="${escapeHtml(r.id)}">Borrar</button></td>
    `;
    recBody.appendChild(tr);
  });

  recBody.querySelectorAll("[data-del-rec]").forEach(b=>{
    b.addEventListener("click", ()=>{
      if (!confirm("¿Borrar recurrente?")) return;
      const id = b.dataset.delRec;
      const db = loadDB();
      db.recurring = (db.recurring||[]).filter(x=>x.id!==id);
      saveDB(db);
      renderRecurring();
      refreshAll();
      cloudPushSafe();
    });
  });
}

function runRecurringThisMonth(){
  const db = loadDB();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  if (db.meta?.lastRecurringRun === ym){
    if (!confirm("Ya generaste este mes. ¿Generar otra vez? (duplicaría)")) return;
  }

  const made = [];
  (db.recurring||[]).forEach(r=>{
    const date = `${ym}-${String(r.day).padStart(2,"0")}`;
    const t = {
      id: uid("tx"),
      type: r.type,
      date,
      amount: r.amount,
      categoryId: r.categoryId,
      method: "OTRO",
      status: "PENDIENTE",
      party: r.party || "",
      ref: "RECURRENTE",
      tags: "recurrente",
      notes: r.memo || "",
      receipt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.tx.unshift(t);
    made.push(t);
  });

  db.meta = db.meta || {};
  db.meta.lastRecurringRun = ym;

  saveDB(db);
  renderTxTable();
  refreshAll();
  cloudPushSafe();
  alert(`Generado ✅ (${made.length} transacciones)`);
}

function clearRecurring(){
  if (!confirm("¿Vaciar recurrentes?")) return;
  const db = loadDB();
  db.recurring = [];
  saveDB(db);
  renderRecurring();
  refreshAll();
  cloudPushSafe();
}

/* ========== Dashboard calc ========== */
function calcPeriodTotals(from, to){
  const db = loadDB();
  const tx = (db.tx||[]).filter(t=>inRange(t.date, from, to));
  const income = tx.filter(t=>t.type==="INCOME").reduce((a,t)=>a+Number(t.amount||0),0);
  const expense = tx.filter(t=>t.type==="EXPENSE").reduce((a,t)=>a+Number(t.amount||0),0);
  return { db, tx, income, expense, net: income-expense };
}

function sumByCategory(tx, type){
  const map = new Map();
  tx.filter(t=>t.type===type).forEach(t=>{
    map.set(t.categoryId, (map.get(t.categoryId)||0) + Number(t.amount||0));
  });
  return [...map.entries()].sort((a,b)=>b[1]-a[1]);
}

/* ========== Backup KPI ========== */
function computeBackupStatus(db){
  const last = db.meta?.lastBackupAt || "";
  if (!last) return { days: 999, lastLabel: "Nunca", due: true };
  const days = daysBetween(last, new Date().toISOString());
  return {
    days,
    lastLabel: new Date(last).toLocaleString(),
    due: days >= 7
  };
}

function renderBackupKPI(){
  if (!kpiBackup) return; // si no existe en HTML, no molesta

  const db = loadDB();
  const s = computeBackupStatus(db);

  kpiBackup.textContent = s.due ? `Backup ⚠️ (${s.days}d)` : `Backup (${s.days}d)`;
  if (kpiBackupHint) kpiBackupHint.textContent = s.due ? "Toca para hacer backup (recomendado)" : "Toca para exportar backup";
  if (kpiBackupSub) kpiBackupSub.textContent = `Último: ${s.lastLabel}`;

  // estilo rápido: cambia borde/alerta si está vencido
  const card = kpiBackup.closest(".kpiCard");
  if (card){
    card.classList.toggle("kpi-due", s.due);
  }

  // nag cada 7 días (solo una vez por sesión)
  if (s.due && !window.__backupNagShown){
    window.__backupNagShown = true;
    setTimeout(()=> {
      alert(`Backup recomendado: han pasado ${s.days} días.\nToca el KPI “Backup” para exportar la data.`);
    }, 400);
  }
}

function doBackupExport(){
  const db = loadDB();
  const payload = { exportedAt: new Date().toISOString(), db };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oasis_gastos_ingresos_backup_${isoToday()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 300);

  // marca último backup
  db.meta = db.meta || {};
  db.meta.lastBackupAt = new Date().toISOString();
  saveDB(db);
  cloudPushSafe();
  renderBackupKPI();
}

/* ========== Dashboard render ========== */
function renderDashboard(){
  const from = pFrom.value || "";
  const to = pTo.value || "";
  const { db, tx, income, expense, net } = calcPeriodTotals(from, to);

  kpiIncome.textContent = fmt(income);
  kpiExpense.textContent = fmt(expense);
  kpiNet.textContent = fmt(net);

  dashGrid.innerHTML = "";

  const cardA = document.createElement("div");
  cardA.className = "dashCard dash-blue";
  cardA.innerHTML = `<strong>Cashflow del periodo</strong><div class="meta">Ingresos <b>${escapeHtml(fmt(income))}</b> · Gastos <b>${escapeHtml(fmt(expense))}</b> · Net <b>${escapeHtml(fmt(net))}</b></div>`;
  dashGrid.appendChild(cardA);

  const cardB = document.createElement("div");
  cardB.className = "dashCard " + (net>=0 ? "dash-ok" : "dash-bad");
  cardB.innerHTML = `<strong>${net>=0 ? "Net positivo" : "Net negativo"}</strong><div class="meta">${net>=0 ? "Bien. Esto es combustible para escalar." : "No es ‘mala suerte’. Es señal: controla gastos o sube margen."}</div>`;
  dashGrid.appendChild(cardB);

  const topExp = sumByCategory(tx, "EXPENSE").slice(0,5);
  const expLines = topExp.length
    ? topExp.map(([cid,val])=>{
        const c = getCat(db, cid);
        return `${escapeHtml(c?.name||"—")}: <b>${escapeHtml(fmt(val))}</b>`;
      }).join("<br>")
    : "Sin gastos en el periodo.";
  const cardC = document.createElement("div");
  cardC.className = "dashCard dash-gold";
  cardC.innerHTML = `<strong>Top gastos (categorías)</strong><div class="meta">${expLines}</div>`;
  dashGrid.appendChild(cardC);

  const topInc = sumByCategory(tx, "INCOME").slice(0,5);
  const incLines = topInc.length
    ? topInc.map(([cid,val])=>{
        const c = getCat(db, cid);
        return `${escapeHtml(c?.name||"—")}: <b>${escapeHtml(fmt(val))}</b>`;
      }).join("<br>")
    : "Sin ingresos en el periodo.";
  const cardD = document.createElement("div");
  cardD.className = "dashCard dash-ok";
  cardD.innerHTML = `<strong>Top ingresos (categorías)</strong><div class="meta">${incLines}</div>`;
  dashGrid.appendChild(cardD);

  const pending = tx.filter(t=>t.status==="PENDIENTE").reduce((a,t)=>a+Number(t.amount||0),0);
  const pendCard = document.createElement("div");
  pendCard.className = "dashCard dash-warn";
  pendCard.innerHTML = `<strong>Pendientes</strong><div class="meta">Total en estado Pendiente: <b>${escapeHtml(fmt(pending))}</b></div>`;
  dashGrid.appendChild(pendCard);

  const docs = document.createElement("div");
  docs.className = "dashCard dash-blue";
  docs.innerHTML = `<strong>Actividad</strong><div class="meta">Transacciones en periodo: <b>${escapeHtml(String(tx.length))}</b><br>Recurrentes: <b>${escapeHtml(String((db.recurring||[]).length))}</b></div>`;
  dashGrid.appendChild(docs);

  dashPill.textContent = (db.cats||[]).length ? "Listo" : "Falta categorías";

  renderBackupKPI();
}

/* ========== Data ========== */
function exportJSON(){
  // esto ahora ES el backup normal también
  doBackupExport();
}

async function importJSON(file){
  try{
    const txt = await file.text();
    const data = JSON.parse(txt);
    const db = data.db || data;
    if (!db.cats || !Array.isArray(db.cats) || !db.tx || !Array.isArray(db.tx) || !db.recurring || !Array.isArray(db.recurring)){
      alert("Archivo inválido.");
      return;
    }
    saveDB({ cats: db.cats, tx: db.tx, recurring: db.recurring, meta: db.meta || { lastRecurringRun:"", lastBackupAt:"" } });
    renderCats();
    renderRecurring();
    resetTxForm();
    renderTxTable();
    refreshAll();
    cloudPushSafe();
    alert("Importado ✅");
  }catch{
    alert("No se pudo importar.");
  }
}

function resetAll(){
  if (!confirm("Reset total: borra categorías, transacciones y recurrentes. ¿Seguro?")) return;
  saveDB({ cats: [], tx: [], recurring: [], meta:{ lastRecurringRun:"", lastBackupAt:"" } });
  renderCats();
  renderRecurring();
  resetTxForm();
  renderTxTable();
  refreshAll();
  cloudPushSafe();
}

/* ========== Cloud safe wrapper ========== */
function cloudPushSafe(){
  if (!fbUser || !fbDb) return;
  cloudPush().catch((e)=>{
    console.warn("Cloud push blocked:", e);
  });
}

/* ========== Refresh ========== */
function refreshAll(){
  renderDashboard();
}

/* ========== Boot ========== */
(function boot(){
  $("hubBtn").href = HUB_URL;

  // defaults: mes actual
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);

  pFrom.value = first; pTo.value = last;
  fFrom.value = first; fTo.value = last;
  txDate.value = isoToday();

  // Firebase init
  initFirebase();
  wireAuthButtons();

  tabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".tab");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  btnQuickAdd.addEventListener("click", ()=>{
    resetTxForm();
    setView("transactions");
    window.scrollTo({top:0,behavior:"smooth"});
  });
  btnSaveTx.addEventListener("click", saveTx);

  btnDuplicate.addEventListener("click", duplicateTx);
  btnDeleteTx.addEventListener("click", deleteTx);

  txReceipt.addEventListener("change", async ()=>{
    const file = txReceipt.files?.[0];
    if (!file){ showReceipt(null); return; }
    const dataUrl = await readFileAsDataURL(file);
    showReceipt({ name:file.name, type:file.type, sizeKB: Math.round(file.size/1024), dataUrl });
  });

  btnSeedCats.addEventListener("click", seedCats);
  btnClearCats.addEventListener("click", ()=>{
    if (!confirm("¿Vaciar categorías?")) return;
    const db = loadDB();
    db.cats = [];
    saveDB(db);
    renderCats();
    refreshAll();
    cloudPushSafe();
  });
  btnAddCat.addEventListener("click", addCat);

  btnAddRecurring.addEventListener("click", addRecurring);
  btnRunRecurring.addEventListener("click", runRecurringThisMonth);
  btnClearRecurring.addEventListener("click", clearRecurring);

  [fText,fType,fStatus,fCategory,fMethod,fFrom,fTo].forEach(el=>{
    el.addEventListener("input", renderTxTable);
    el.addEventListener("change", renderTxTable);
  });
  btnClearFilters.addEventListener("click", clearFilters);

  pFrom.addEventListener("change", refreshAll);
  pTo.addEventListener("change", refreshAll);

  btnExport.addEventListener("click", exportJSON);
  btnImport.addEventListener("click", ()=>importFile.click());
  importFile.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if (f) importJSON(f);
    e.target.value = "";
  });
  btnReset.addEventListener("click", resetAll);

  // KPI Backup click
  if (kpiBackup){
    kpiBackup.style.cursor = "pointer";
    kpiBackup.addEventListener("click", doBackupExport);
  }

  // Initial renders
  renderCats();
  renderRecurring();
  resetTxForm();
  renderTxTable();
  refreshAll();
})();
