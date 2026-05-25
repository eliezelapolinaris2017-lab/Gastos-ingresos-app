/* Nexus Finance Live — Oasis/Nexus CRM style */
const KEY = "nexus_finance_live_v2";
const OWNER_EMAIL = "nexustoolspr@gmail.com";
const FIREBASE_APP_NAME = "nexus-finance-live";
const firebaseConfig = {
  apiKey: "AIzaSyBm67RjL0QzMRLfo6zUYCI0bak1eGJAR-U",
  authDomain: "oasis-facturacion.firebaseapp.com",
  projectId: "oasis-facturacion",
  storageBucket: "oasis-facturacion.firebasestorage.app",
  messagingSenderId: "84422038905",
  appId: "1:84422038905:web:b0eef65217d2bfc3298ba8"
};
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n||0));
const isoToday = () => new Date().toISOString().slice(0,10);
const uid = (p="id") => `${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const defaultLogo = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#d9b76a"/><stop offset="1" stop-color="#25c7ff"/></linearGradient></defs><rect width="180" height="180" rx="44" fill="#07111f"/><path d="M43 118V61h20l54 57V61h20v57h-20L63 61v57z" fill="url(#g)"/><circle cx="90" cy="90" r="72" fill="none" stroke="url(#g)" stroke-width="7" opacity=".75"/></svg>`)}`;
let fbApp=null, fbAuth=null, fbDb=null, fbUser=null, unsub=null, activeTxId=null, txType="INCOME", saveTimer=null, cloudApplying=false;
function blankDB(){return {settings:{appName:"Nexus Finance",subName:"",hubUrl:"https://eliezelapolinaris2017-lab.github.io/oasis-hub/",logo:defaultLogo},cats:[],tx:[],meta:{lastBackupAt:"",updatedAt:""}}}
function loadDB(){try{return {...blankDB(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return blankDB()}}
function saveDB(db){db.meta=db.meta||{};db.meta.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(db));scheduleCloudPush();}
function setLocalOnly(db){localStorage.setItem(KEY,JSON.stringify(db));}
function ref(){return fbDb.collection("users").doc(fbUser.uid).collection("apps").doc("nexus_finance_live");}
function assertOwner(u){if(!u)throw new Error("No hay sesión"); if(String(u.email||"").toLowerCase()!==OWNER_EMAIL)throw new Error("Cuenta no autorizada");}
function initFirebase(){try{if(!window.firebase)return; try{fbApp=firebase.app(FIREBASE_APP_NAME)}catch{fbApp=firebase.initializeApp(firebaseConfig,FIREBASE_APP_NAME)} fbAuth=firebase.auth(fbApp); fbDb=firebase.firestore(fbApp);}catch(e){console.warn(e)}}
function setCloud(on,msg){$("cloudDot").classList.toggle("on",!!on); $("authPill").textContent=on?"Cloud activo":"Offline"; $("syncPill").textContent=msg|| (on?"Sync vivo":"Sync local");}
async function cloudPush(){if(!fbUser||!fbDb||cloudApplying)return; const db=loadDB(); await ref().set({db,updatedAt:new Date().toISOString(),ownerEmail:OWNER_EMAIL},{merge:true}); setCloud(true,"Guardado en cloud");}
function scheduleCloudPush(){if(!fbUser||!fbDb||cloudApplying)return; clearTimeout(saveTimer); setCloud(true,"Sincronizando…"); saveTimer=setTimeout(()=>cloudPush().catch(e=>{console.warn(e);setCloud(true,"Sync pendiente")}),650)}
async function loginGoogle(){if(!fbAuth)return alert("Firebase no está listo."); try{const p=new firebase.auth.GoogleAuthProvider(); const r=await fbAuth.signInWithPopup(p); assertOwner(r.user);}catch(e){alert("Login cancelado o cuenta no autorizada."); try{await fbAuth.signOut()}catch{}}}
async function logout(){try{if(unsub)unsub(); await fbAuth.signOut()}catch{}}
function wireAuth(){if(!fbAuth){setCloud(false);return} $("btnLogin").onclick=loginGoogle; $("btnLogout").onclick=logout; fbAuth.onAuthStateChanged(async u=>{if(!u){fbUser=null; if(unsub)unsub(); $("btnLogin").hidden=false; $("btnLogout").hidden=true; setCloud(false); return} try{assertOwner(u); fbUser=u; $("btnLogin").hidden=true; $("btnLogout").hidden=false; setCloud(true,"Conectando sync vivo"); unsub=ref().onSnapshot(s=>{if(!s.exists){cloudPush();return} const cloud=s.data().db; if(!cloud)return; const local=loadDB(); const cTime=cloud.meta?.updatedAt||s.data().updatedAt||""; const lTime=local.meta?.updatedAt||""; if(cTime && cTime!==lTime){cloudApplying=true; setLocalOnly({...blankDB(),...cloud}); cloudApplying=false; renderAll(); setCloud(true,"Sync vivo");}},e=>{console.warn(e);setCloud(true,"Sync limitado")}); await cloudPush();}catch(e){alert(e.message); logout();}})}
function readFile(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||""));r.onerror=rej;r.readAsDataURL(file)})}
function applyBrand(){const db=loadDB(),s=db.settings||blankDB().settings; ["appLogo","appLogoMobile"].forEach(id=>$(id).src=s.logo||defaultLogo); $("brandTitle").textContent=s.appName||"Nexus Finance"; $("brandSub").textContent=s.subName||""; $("heroTitle").textContent=s.appName||"Nexus Finance"; $("heroSub").textContent=""; $("hubBtn").href=s.hubUrl||"#"; $("setAppName").value=s.appName||""; $("setSubName").value=s.subName||""; $("setHub").value=s.hubUrl||"";}
function seedCats(){const base=[['Labor','INCOME','#21d07a'],['Ventas / Servicios','INCOME','#21d07a'],['Mantenimientos','INCOME','#25c7ff'],['Instalaciones','INCOME','#d9b76a'],['Emergencias','INCOME','#ff8a00'],['Servicios Prestados','EXPENSE','#ff5c7a'],['Materiales / Repuestos','EXPENSE','#ff5c7a'],['Combustible','EXPENSE','#ff8a00'],['Herramientas','EXPENSE','#d9b76a'],['Teléfono / Internet','EXPENSE','#25c7ff'],['Publicidad','EXPENSE','#9b7cff'],['Renta / Oficina','EXPENSE','#15e2c2']]; const db=loadDB(); const e=new Set((db.cats||[]).map(c=>c.name.toLowerCase())); base.forEach(([name,type,color])=>{if(!e.has(name.toLowerCase()))db.cats.push({id:uid('cat'),name,type,color})}); saveDB(db); renderAll();}
function renderCats(){const db=loadDB(),cats=(db.cats||[]).sort((a,b)=>a.name.localeCompare(b.name)); const opts=cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''); $("txCategory").innerHTML=opts||'<option value="">Sin categorías</option>'; $("fCategory").innerHTML='<option value="">Categoría</option>'+opts; $("catChips").innerHTML=cats.map(c=>`<span class="chip" style="border-color:${esc(c.color)}55">${esc(c.name)} <small>${esc(c.type)}</small><button data-delcat="${esc(c.id)}">×</button></span>`).join('')||'<p>No hay categorías.</p>'; document.querySelectorAll('[data-delcat]').forEach(b=>b.onclick=()=>{const db=loadDB();db.cats=db.cats.filter(c=>c.id!==b.dataset.delcat);saveDB(db);renderAll()});}
function catName(id){return (loadDB().cats||[]).find(c=>c.id===id)?.name||'—'}
function setView(v){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('is-active',x.id===`view-${v}`));document.querySelectorAll('.navBtn').forEach(x=>x.classList.toggle('is-active',x.dataset.view===v));}
function setTxType(t){txType=t; $("segIncome").classList.toggle('is-active',t==='INCOME'); $("segExpense").classList.toggle('is-active',t==='EXPENSE');}
function resetTx(t=txType){activeTxId=null; $("txMode").textContent='Nueva transacción'; $("entryChip").textContent='Nuevo'; setTxType(t); $("txAmount").value=''; $("txDate").value=isoToday(); $("txMethod").value='EFECTIVO'; $("txStatus").value='PAGADO'; $("txParty").value=''; $("txRef").value=''; $("txNotes").value=''; $("txReceipt").value=''; $("receiptPreview").textContent='Sin recibo';}
async function saveTx(){const db=loadDB(); if(!db.cats.length){seedCats()} const amount=Number($("txAmount").value||0); if(amount<=0)return alert('Monto inválido.'); let receipt=null; const f=$("txReceipt").files?.[0]; if(f) receipt={name:f.name,type:f.type,sizeKB:Math.round(f.size/1024),dataUrl:await readFile(f)}; else if(activeTxId) receipt=(db.tx||[]).find(t=>t.id===activeTxId)?.receipt||null; const item={id:activeTxId||uid('tx'),type:txType,date:$("txDate").value||isoToday(),amount,categoryId:$("txCategory").value,method:$("txMethod").value,status:$("txStatus").value,party:$("txParty").value.trim(),ref:$("txRef").value.trim(),notes:$("txNotes").value.trim(),receipt,updatedAt:new Date().toISOString()}; const i=db.tx.findIndex(x=>x.id===item.id); if(i>=0)db.tx[i]={...db.tx[i],...item}; else db.tx.unshift({...item,createdAt:new Date().toISOString()}); activeTxId=item.id; saveDB(db); renderAll(); setView('history');}
function openTx(id){const t=loadDB().tx.find(x=>x.id===id); if(!t)return; activeTxId=t.id; setTxType(t.type); $("txMode").textContent='Editar transacción'; $("entryChip").textContent='Editando'; $("txAmount").value=t.amount||''; $("txDate").value=t.date||isoToday(); $("txCategory").value=t.categoryId||''; $("txMethod").value=t.method||'EFECTIVO'; $("txStatus").value=t.status||'PAGADO'; $("txParty").value=t.party||''; $("txRef").value=t.ref||''; $("txNotes").value=t.notes||''; $("receiptPreview").textContent=t.receipt?`${t.receipt.name} · ${t.receipt.sizeKB} KB`:'Sin recibo'; setView('entry')}
function duplicateTx(){if(!activeTxId)return; const db=loadDB(),t=db.tx.find(x=>x.id===activeTxId); if(!t)return; db.tx.unshift({...t,id:uid('tx'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}); saveDB(db); renderAll();}
function deleteTx(){if(!activeTxId)return resetTx(); if(!confirm('¿Borrar transacción?'))return; const db=loadDB(); db.tx=db.tx.filter(t=>t.id!==activeTxId); saveDB(db); resetTx(); renderAll();}
function pass(t){const q=$("fText").value.toLowerCase().trim(); if($("fType").value&&t.type!==$("fType").value)return false; if($("fStatus").value&&t.status!==$("fStatus").value)return false; if($("fCategory").value&&t.categoryId!==$("fCategory").value)return false; if($("fFrom").value&&t.date<$("fFrom").value)return false; if($("fTo").value&&t.date>$("fTo").value)return false; if(q&&!(`${t.party} ${t.ref} ${t.notes} ${catName(t.categoryId)}`.toLowerCase().includes(q)))return false; return true;}
function calcTotals(){const db=loadDB(),from=$("pFrom").value,to=$("pTo").value; const tx=db.tx.filter(t=>(!from||t.date>=from)&&(!to||t.date<=to)); const inc=tx.filter(t=>t.type==='INCOME').reduce((a,t)=>a+Number(t.amount||0),0); const exp=tx.filter(t=>t.type==='EXPENSE').reduce((a,t)=>a+Number(t.amount||0),0); return{db,tx,inc,exp,net:inc-exp};}
function renderDashboard(){const {tx,inc,exp,net}=calcTotals(); $("kpiIncome").textContent=fmt(inc); $("kpiExpense").textContent=fmt(exp); $("kpiNet").textContent=fmt(net); const pending=tx.filter(t=>t.status==='PENDIENTE').reduce((a,t)=>a+Number(t.amount||0),0); const avg=tx.length?(inc+exp)/tx.length:0; $("dashGrid").innerHTML=[['Cashflow',fmt(net),net>=0?'Operación saludable':'Margen bajo presión'],['Pendiente',fmt(pending),'Cobros/gastos sin cerrar'],['Movimientos',String(tx.length),'Transacciones del periodo'],['Promedio',fmt(avg),'Ticket operativo promedio']].map(x=>`<div class="insight"><span>${x[0]}</span><br><b>${x[1]}</b><p>${x[2]}</p></div>`).join(''); renderBackupKPI();}
function renderHistory(){const rows=loadDB().tx.filter(pass).sort((a,b)=>(b.date||'').localeCompare(a.date||'')); $("txList").innerHTML=rows.map(t=>`<div class="txRow"><span>${esc(t.date)}</span><span class="badge ${t.type==='INCOME'?'in':'out'}">${t.type==='INCOME'?'Ingreso':'Gasto'}</span><div><strong>${esc(catName(t.categoryId))}</strong><br><small>${esc(t.party||t.ref||t.notes||'—')}</small></div><strong>${fmt(t.amount)}</strong><button class="btn ghost small" data-open="${esc(t.id)}">Abrir</button></div>`).join('')||'<p>No hay transacciones.</p>'; document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTx(b.dataset.open));}
function renderBackupKPI(){const last=loadDB().meta?.lastBackupAt; $("kpiBackupValue").textContent=last?'Listo':'Pendiente'; $("kpiBackupSub").textContent=last?new Date(last).toLocaleString():'Toca para exportar';}
function exportJSON(){const db=loadDB(); db.meta.lastBackupAt=new Date().toISOString(); setLocalOnly(db); const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),db},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`nexus_finance_backup_${isoToday()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),300); renderBackupKPI(); scheduleCloudPush();}
async function importJSON(file){try{const data=JSON.parse(await file.text()); const db=data.db||data; if(!Array.isArray(db.tx)||!Array.isArray(db.cats))return alert('Archivo inválido.'); setLocalOnly({...blankDB(),...db}); renderAll(); scheduleCloudPush();}catch{alert('No se pudo importar.')}}

function weekRows(from,to){const db=loadDB(); const tx=(db.tx||[]).filter(t=>(!from||t.date>=from)&&(!to||t.date<=to)); return {db,tx};}
function byCategory(tx,type){const map=new Map(); tx.filter(t=>t.type===type).forEach(t=>{const name=catName(t.categoryId); map.set(name,(map.get(name)||0)+Number(t.amount||0));}); return [...map.entries()].sort((a,b)=>b[1]-a[1]);}
function sumCategory(tx,type,words){const terms=words.map(w=>w.toLowerCase()); return tx.filter(t=>t.type===type && terms.some(w=>catName(t.categoryId).toLowerCase().includes(w))).reduce((a,t)=>a+Number(t.amount||0),0);}
function renderWeeklyReport(){
  if(!$('weeklyKpis'))return;
  const from=$('wFrom').value,to=$('wTo').value;
  const {tx}=weekRows(from,to);
  const income=tx.filter(t=>t.type==='INCOME').reduce((a,t)=>a+Number(t.amount||0),0);
  const expense=tx.filter(t=>t.type==='EXPENSE').reduce((a,t)=>a+Number(t.amount||0),0);
  const pending=tx.filter(t=>t.status==='PENDIENTE').reduce((a,t)=>a+Number(t.amount||0),0);
  const labor=sumCategory(tx,'INCOME',['labor']);
  const services=sumCategory(tx,'EXPENSE',['servicios prestados','pago de servicios']);
  const net=income-expense;
  const margin=income?((net/income)*100).toFixed(1)+'%':'0%';
  const metrics=[
    ['↗','Ingresos Brutos',fmt(income),'Total ingresos','green'],
    ['↘','Gastos Operacionales',fmt(expense),'Total gastos','red'],
    ['▣','Balance Neto',fmt(net),'Ingresos - Gastos','blue'],
    ['▥','Margen Neto',margin,'Porcentaje','purple'],
    ['👥','Labor (Ingreso)',fmt(labor),'Total labor','orange'],
    ['🤝','Servicios Prestados (Gasto)',fmt(services),'Total servicios prestados','teal'],
    ['▤','Pendientes por Cobrar/Pagar',fmt(pending),'Total pendientes','yellow'],
    ['☷','Transacciones',String(tx.length),'Total transacciones','gray']
  ];
  $('weeklyKpis').innerHTML=metrics.map(x=>`<div class="reportMetric clean ${x[4]}"><i>${x[0]}</i><div><span>${x[1]}</span><strong>${x[2]}</strong><small>${x[3]}</small></div></div>`).join('');
  const inc=byCategory(tx,'INCOME'), exp=byCategory(tx,'EXPENSE');
  $('weeklyIncomeCats').innerHTML=renderCategoryHtml(inc,'income');
  $('weeklyExpenseCats').innerHTML=renderCategoryHtml(exp,'expense');
  const body=$('weeklyTxBody');
  if(body){
    body.innerHTML=tx.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(t=>`<tr><td>${esc(t.date||'')}</td><td>${t.type==='INCOME'?'Ingreso':'Gasto'}</td><td>${esc(catName(t.categoryId))}</td><td>${esc(t.party||t.ref||t.notes||'—')}</td><td>${fmt(t.amount)}</td><td><span class="okPill">COMPLETADO</span></td></tr>`).join('')||'<tr><td colspan="6">Sin transacciones.</td></tr>';
  }
  const total=$('weeklyTxTotal'); if(total) total.textContent=String(tx.length);
  const totalAmount=$('weeklyTxAmount'); if(totalAmount) totalAmount.textContent=fmt(net);
}
function renderCategoryHtml(rows,kind){
  const total=rows.reduce((a,r)=>a+Number(r[1]||0),0);
  const lines=rows.length?rows.map(([name,val])=>`<div class="reportLine"><span>${esc(name)}</span><strong>${fmt(val)}</strong></div>`).join(''):'<div class="reportLine"><span>Sin registros</span><strong>$0.00</strong></div>';
  return `<div class="catPanelInner"><div class="catLines">${lines}<div class="reportLine total"><span>Total ${kind==='income'?'Ingresos':'Gastos'}</span><strong>${fmt(total)}</strong></div></div><div class="donut ${kind}"><b>${fmt(total)}</b><small>100%</small></div></div>`;
}
function pdfText(doc,text,x,y,opt={}){doc.text(String(text||''),x,y,opt)}
function addPdfTable(doc,title,rows,x,y,w){doc.setFont('helvetica','bold');doc.setFontSize(11);pdfText(doc,title,x,y);y+=7;doc.setFontSize(9);doc.setFont('helvetica','normal'); if(!rows.length){pdfText(doc,'Sin registros.',x,y);return y+8} rows.forEach(([name,val])=>{if(y>274){doc.addPage();y=18} doc.setDrawColor(220);doc.line(x,y+2,x+w,y+2); pdfText(doc,String(name).slice(0,42),x,y); pdfText(doc,fmt(val),x+w,y,{align:'right'}); y+=7;}); return y+5;}
function moneyOrText(label,value){
  if(label==='Transacciones') return `${value} transacciones`;
  if(label==='Margen neto') return value;
  return fmt(value);
}
function ensurePage(doc,y){
  if(y>260){doc.addPage();return 18;}
  return y;
}
function sectionTitle(doc,title,x,y){
  y=ensurePage(doc,y);
  doc.setTextColor(20,28,38);
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  pdfText(doc,title,x,y);
  return y+8;
}
function drawMetricCard(doc,label,value,x,y,w,h){
  doc.setDrawColor(218,222,228);
  doc.setFillColor(255,255,255);
  doc.roundedRect(x,y,w,h,3,3,'FD');
  doc.setTextColor(70,78,90);
  doc.setFont('helvetica','normal');
  doc.setFontSize(7.5);
  pdfText(doc,label,x+4,y+7);
  doc.setTextColor(20,28,38);
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  pdfText(doc,String(value),x+4,y+16);
}
function drawCategoryBlock(doc,title,rows,x,y,w){
  y=sectionTitle(doc,title,x,y);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(35,43,54);
  if(!rows.length){
    pdfText(doc,'Sin registros.',x,y);
    return y+10;
  }
  rows.forEach(([name,val])=>{
    y=ensurePage(doc,y);
    doc.setDrawColor(226,230,235);
    doc.line(x,y+2,x+w,y+2);
    pdfText(doc,String(name).slice(0,40),x,y);
    doc.setFont('helvetica','bold');
    pdfText(doc,fmt(val),x+w,y,{align:'right'});
    doc.setFont('helvetica','normal');
    y+=7;
  });
  return y+7;
}
function drawTransactionHeader(doc,x,y){
  doc.setFillColor(245,247,250);
  doc.roundedRect(x,y-5,184,8,2,2,'F');
  doc.setTextColor(20,28,38);
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  ['Fecha','Tipo','Categoría','Detalle','Monto'].forEach((h,i)=>pdfText(doc,h,[x+2,39,64,105,198][i],y,{align:i===4?'right':'left'}));
  return y+7;
}
function drawMoneyCard(doc, icon, label, value, sub, color, x, y, w, h){
  const colors={green:[32,176,93],red:[244,69,80],blue:[18,112,229],purple:[124,64,238],orange:[255,126,0],teal:[0,145,139],yellow:[237,174,0],gray:[80,92,105]};
  const c=colors[color]||colors.blue;
  doc.setDrawColor(224,228,234); doc.setFillColor(255,255,255); doc.roundedRect(x,y,w,h,3,3,'FD');
  doc.setFillColor(c[0],c[1],c[2]); doc.circle(x+10,y+h/2,5.2,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8); pdfText(doc,icon,x+10,y+h/2+2.5,{align:'center'});
  doc.setTextColor(12,20,32); doc.setFontSize(7.5); doc.setFont('helvetica','bold'); pdfText(doc,label,x+19,y+7);
  doc.setFontSize(11.5); pdfText(doc,value,x+19,y+15);
  doc.setTextColor(74,85,101); doc.setFont('helvetica','normal'); doc.setFontSize(7); pdfText(doc,sub,x+19,y+21);
}
function drawReportCategoryPanel(doc,title,rows,x,y,w,h,kind){
  doc.setDrawColor(224,228,234); doc.setFillColor(255,255,255); doc.roundedRect(x,y,w,h,3,3,'FD');
  doc.setTextColor(12,20,32); doc.setFont('helvetica','bold'); doc.setFontSize(10); pdfText(doc,title,x+4,y+8);
  doc.setFontSize(7); pdfText(doc,'Categoría',x+4,y+17); pdfText(doc,'Monto',x+52,y+17,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(30,38,50);
  let yy=y+24; const total=rows.reduce((a,r)=>a+Number(r[1]||0),0);
  const safe=rows.length?rows:[[kind==='income'?'Sin ingresos':'Sin gastos',0]];
  safe.slice(0,8).forEach(([name,val])=>{doc.setDrawColor(232,235,240); doc.line(x+4,yy+1,x+54,yy+1); pdfText(doc,String(name).slice(0,24),x+4,yy); pdfText(doc,fmt(val),x+54,yy,{align:'right'}); yy+=6;});
  doc.setFont('helvetica','bold'); doc.setTextColor(kind==='income'?32:244,kind==='income'?176:69,kind==='income'?93:80); pdfText(doc,`Total ${kind==='income'?'Ingresos':'Gastos'}`,x+4,y+h-8); pdfText(doc,fmt(total),x+54,y+h-8,{align:'right'});
  const cx=x+w-22, cy=y+h/2+4; doc.setDrawColor(kind==='income'?32:244,kind==='income'?176:69,kind==='income'?93:80); doc.setLineWidth(7); doc.circle(cx,cy,13,'S'); doc.setLineWidth(.2); doc.setTextColor(12,20,32); doc.setFontSize(8); pdfText(doc,fmt(total),cx,cy,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6); pdfText(doc,'100%',cx,cy+6,{align:'center'});
}
function generateWeeklyPDF(){
  const api=window.jspdf?.jsPDF;
  if(!api)return alert('PDF no disponible.');
  const db=loadDB(),s=db.settings||{};
  const from=$('wFrom').value,to=$('wTo').value,notes=($('wNotes').value||'').trim();
  const {tx}=weekRows(from,to);
  const income=tx.filter(t=>t.type==='INCOME').reduce((a,t)=>a+Number(t.amount||0),0);
  const expense=tx.filter(t=>t.type==='EXPENSE').reduce((a,t)=>a+Number(t.amount||0),0);
  const pending=tx.filter(t=>t.status==='PENDIENTE').reduce((a,t)=>a+Number(t.amount||0),0);
  const labor=sumCategory(tx,'INCOME',['labor']);
  const services=sumCategory(tx,'EXPENSE',['servicios prestados','pago de servicios']);
  const net=income-expense;
  const margin=income?((net/income)*100).toFixed(1)+'%':'0%';
  const inc=byCategory(tx,'INCOME'), exp=byCategory(tx,'EXPENSE');
  const doc=new api({unit:'mm',format:'letter'});
  const left=12, pageW=216;
  doc.setFillColor(255,255,255); doc.rect(0,0,216,279,'F');
  try{if(s.logo)doc.addImage(s.logo,'PNG',left,6,24,16)}catch{}
  doc.setTextColor(12,20,32); doc.setFont('helvetica','bold'); doc.setFontSize(18); pdfText(doc,'NEXUS FINANCE',left,20);
  doc.setDrawColor(210,214,220); doc.line(left,28,pageW-left,28);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); pdfText(doc,`${from||'—'} - ${to||'—'}`,pageW-left,16,{align:'right'});
  doc.setFont('helvetica','bold'); doc.setFontSize(16); pdfText(doc,'Reporte Semanal',left,38);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(47,59,76); pdfText(doc,'Resumen financiero operativo por semana.',left,45);
  const cards=[['IN','Ingresos Brutos',fmt(income),'Total ingresos','green'],['GO','Gastos Operacionales',fmt(expense),'Total gastos','red'],['BN','Balance Neto',fmt(net),'Ingresos - Gastos','blue'],['MN','Margen Neto',margin,'Porcentaje','purple'],['LB','Labor (Ingreso)',fmt(labor),'Total labor','orange'],['SP','Servicios Prestados (Gasto)',fmt(services),'Total servicios prestados','teal'],['PD','Pendientes por Cobrar/Pagar',fmt(pending),'Total pendientes','yellow'],['#','Transacciones',String(tx.length),'Total transacciones','gray']];
  let y=52; const cw=48, ch=23, gap=5;
  cards.forEach((c,i)=>drawMoneyCard(doc,c[0],c[1],c[2],c[3],c[4],left+(cw+gap)*(i%4),y+(ch+6)*Math.floor(i/4),cw,ch));
  y+=58;
  drawReportCategoryPanel(doc,'Ingresos por Categoría',inc,left,y,100,58,'income');
  drawReportCategoryPanel(doc,'Gastos por Categoría',exp,116,y,88,58,'expense');
  y+=66;
  doc.setDrawColor(224,228,234); doc.setFillColor(255,255,255); doc.roundedRect(left,y,192,56,3,3,'FD');
  doc.setTextColor(12,20,32); doc.setFont('helvetica','bold'); doc.setFontSize(10); pdfText(doc,'Detalle de Transacciones',left+4,y+8);
  let ty=y+18; doc.setFontSize(7); ['Fecha','Tipo','Categoría','Detalle','Monto','Estado'].forEach((h,i)=>pdfText(doc,h,[left+4,left+32,left+58,left+92,left+156,left+181][i],ty,{align:i===4?'right':'left'}));
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(30,38,50); ty+=7;
  tx.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,7).forEach(t=>{doc.setDrawColor(232,235,240); doc.line(left+4,ty+1,left+188,ty+1); pdfText(doc,t.date||'',left+4,ty); pdfText(doc,t.type==='INCOME'?'Ingreso':'Gasto',left+32,ty); pdfText(doc,catName(t.categoryId).slice(0,22),left+58,ty); pdfText(doc,(t.party||t.ref||t.notes||'—').slice(0,32),left+92,ty); pdfText(doc,fmt(t.amount),left+156,ty,{align:'right'}); doc.setTextColor(10,145,77); doc.setFont('helvetica','bold'); pdfText(doc,'COMPLETADO',left+181,ty); doc.setTextColor(30,38,50); doc.setFont('helvetica','normal'); ty+=6;});
  doc.setFont('helvetica','bold'); doc.setTextColor(12,20,32); pdfText(doc,`Total Transacciones: ${tx.length}`,left+4,y+51); pdfText(doc,'Total Monto:',left+140,y+51,{align:'right'}); pdfText(doc,fmt(net),left+188,y+51,{align:'right'});
  y+=66;
  doc.setDrawColor(224,228,234); doc.roundedRect(left,y,192,16,3,3,'S'); doc.setFontSize(8); doc.setTextColor(12,20,32); doc.setFont('helvetica','bold'); pdfText(doc,'Notas internas del reporte',left+8,y+7); doc.setFont('helvetica','normal'); doc.setTextColor(47,59,76); pdfText(doc,notes||'Sin notas para este periodo.',left+8,y+13);
  doc.save(`reporte_semanal_nexus_${from||isoToday()}_${to||isoToday()}.pdf`);
}
function setDefaultWeek(){if(!$('wFrom'))return; const d=new Date(); const day=(d.getDay()+6)%7; const mon=new Date(d); mon.setDate(d.getDate()-day); const sun=new Date(mon); sun.setDate(mon.getDate()+6); $('wFrom').value=mon.toISOString().slice(0,10); $('wTo').value=sun.toISOString().slice(0,10);}

function renderAll(){applyBrand();renderCats();renderDashboard();renderHistory();renderWeeklyReport();}
function calculator(){const keys=['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','C','+','(',')','⌫','=']; const box=$("calcKeys"); box.innerHTML=keys.map(k=>`<button class="${'+-×÷='.includes(k)?'op':''} ${k==='='?'eq':''}" data-k="${k}">${k}</button>`).join(''); box.onclick=e=>{const b=e.target.closest('button'); if(!b)return; let k=b.dataset.k,d=$("calcDisplay"); if(k==='C')d.value=''; else if(k==='⌫')d.value=d.value.slice(0,-1); else if(k==='='){try{d.value=String(Function(`return (${d.value.replaceAll('×','*').replaceAll('÷','/')})`)())}catch{d.value='Error'}} else d.value+=k;};}
function wire(){if($('btnWeeklyPdf'))$('btnWeeklyPdf').onclick=generateWeeklyPDF; ['wFrom','wTo','wNotes'].forEach(id=>{const el=$(id); if(el)el.addEventListener('input',renderWeeklyReport)}); document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>setView(b.dataset.view)); ["btnQuickOpen","btnNewIncome","tileIncome"].forEach(id=>$(id).onclick=()=>{resetTx('INCOME');setView('entry')}); ["btnNewExpense","tileExpense"].forEach(id=>$(id).onclick=()=>{resetTx('EXPENSE');setView('entry')}); $("tileSplit").onclick=()=>{resetTx('EXPENSE');setView('entry');$("txNotes").value='Gasto dividido entre ___ partes';openCalc()}; $("segIncome").onclick=()=>setTxType('INCOME'); $("segExpense").onclick=()=>setTxType('EXPENSE'); $("btnSaveTx").onclick=saveTx; $("btnResetTx").onclick=()=>resetTx(); $("btnDuplicate").onclick=duplicateTx; $("btnDeleteTx").onclick=deleteTx; $("btnSeedCats").onclick=seedCats; $("btnAddCat").onclick=()=>{const db=loadDB(),name=$("catName").value.trim(); if(!name)return; db.cats.push({id:uid('cat'),name,type:$("catType").value,color:$("catColor").value}); saveDB(db); $("catName").value=''; renderAll()}; $("btnSaveSettings").onclick=async()=>{const db=loadDB(); db.settings.appName=$("setAppName").value.trim()||'Nexus Finance'; db.settings.subName=$("setSubName").value.trim()||''; db.settings.hubUrl=$("setHub").value.trim()||'#'; const f=$("setLogo").files?.[0]; if(f)db.settings.logo=await readFile(f); saveDB(db); renderAll();}; $("btnDefaultLogo").onclick=()=>{const db=loadDB();db.settings.logo=defaultLogo;saveDB(db);renderAll()}; ["btnExport","tileBackup","backupCard"].forEach(id=>$(id).onclick=exportJSON); $("btnImport").onclick=()=>$("importFile").click(); $("importFile").onchange=e=>{const f=e.target.files?.[0]; if(f)importJSON(f); e.target.value=''}; $("btnReset").onclick=()=>{if(confirm('Reset total. ¿Seguro?')){setLocalOnly(blankDB());renderAll();scheduleCloudPush()}}; ["fText","fType","fStatus","fCategory","fFrom","fTo"].forEach(id=>$(id).addEventListener('input',renderHistory)); $("btnClearFilters").onclick=()=>{["fText","fType","fStatus","fCategory","fFrom","fTo"].forEach(id=>$(id).value='');renderHistory()}; ["pFrom","pTo"].forEach(id=>$(id).addEventListener('change',renderDashboard)); $("txReceipt").onchange=()=>{$("receiptPreview").textContent=$("txReceipt").files?.[0]?.name||'Sin recibo'}; calculator(); $("btnCalc").onclick=openCalc; $("btnCloseCalc").onclick=closeCalc; $("btnUseCalc").onclick=()=>{const v=Number($("calcDisplay").value); if(!isNaN(v))$("txAmount").value=v.toFixed(2); closeCalc()};}
function openCalc(){$("calcDrawer").classList.add('open');$("calcDisplay").focus()} function closeCalc(){$("calcDrawer").classList.remove('open')}
(function boot(){setDefaultWeek(); const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),last=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10); ["pFrom","fFrom"].forEach(id=>$(id).value=first); ["pTo","fTo"].forEach(id=>$(id).value=last); wire(); if(!loadDB().cats.length)seedCats(); resetTx(); renderAll(); initFirebase(); wireAuth();})();
