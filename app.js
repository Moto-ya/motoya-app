/* MOTO-YA app · catálogo de repuestos para los vendedores de los móviles.
   Funciona sin internet (service worker). Los datos vienen de data.json, que se exporta desde el SAM. */
"use strict";

// ===== Configuración =====
const APP_VERSION = "1.0.0";
const PIN_HASH = "d9dc1d069210e0fa428d740fb83898d455ffef12eda8627c0b1563d32ce56e45"; // SHA-256 de "MOTO-YA|" + PIN
const PIN_SALT = "MOTO-YA|";
const IMG_CACHE = "motoya-img-v1";

const FAM_ORDER=["PASTILLAS DE FRENO","BANDAS DE FRENO","KIT DE ARRASTRE","BATERÍA","LLANTA","NEUMÁTICO","FILTRO DE AIRE","FILTRO DE ACEITE","GUAYA CLUTCH","GUAYA ACELERADOR","GUAYA FRENO","MANIGUETA","CUNAS DE DIRECCIÓN","CORREA DE TRANSMISIÓN","BUJÍA","BALINERA","BOMBILLO","DIRECCIONAL","ESPEJO","REPOSAPIÉ","IMPERMEABLE","ACEITE DE MOTOR","LIMPIEZA Y CUIDADO"];
const BRAND_ORDER=["BAJAJ","AKT","YAMAHA","HONDA","SUZUKI","TVS","HERO","KAWASAKI","AUTECO","KYMCO","BRONCO","TONGKO","JIALING","QINGQI","VICTORY"];

// ===== Utilidades =====
const $=id=>document.getElementById(id);
const norm=s=>(s??"").toString().normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase();
const sc=s=>s.charAt(0)+s.slice(1).toLowerCase();
const nk=s=>norm(s).replace(/[^A-Z0-9]/g,"");
const money=n=>n==null?"—":"$"+Math.round(n).toLocaleString("es-CO");
const esc=s=>(s??"").toString().replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const title=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).replace(/\b(De|Del|Y)\b/g,w=>w.toLowerCase());
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function hoyISO(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function hoy(){const d=new Date();return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()}
function aviso(m,ms){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(aviso.h);aviso.h=setTimeout(()=>t.hidden=true,ms||2200)}

// SHA-256 (usa el del navegador; si no está disponible, uno propio)
async function sha256(txt){
  if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(txt));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
  return sha256js(txt);
}
function sha256js(ascii){const rr=(v,a)=>(v>>>a)|(v<<(32-a));const mp=Math.pow,maxWord=mp(2,32);let result="",words=[],len=ascii.length*8,hash=[],k=[],pc=0;const isC={};
  for(let c=2;pc<64;c++){if(!isC[c]){for(let i=0;i<313;i+=c)isC[i]=c;hash[pc]=(mp(c,.5)*maxWord)|0;k[pc++]=(mp(c,1/3)*maxWord)|0}}
  hash=hash.slice(0,8);ascii+="\x80";while(ascii.length%64-56)ascii+="\x00";
  for(let i=0;i<ascii.length;i++){const j=ascii.charCodeAt(i);words[i>>2]|=j<<((3-i)%4)*8}
  words[words.length]=((len/maxWord)|0);words[words.length]=len;
  for(let j=0;j<words.length;){const w=words.slice(j,j+=16),oh=hash;hash=hash.slice(0,8);
    for(let i=0;i<64;i++){const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
      const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash);hash[4]=(hash[4]+t1)|0}
    for(let i=0;i<8;i++)hash[i]=(hash[i]+oh[i])|0}
  for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=(b<16?"0":"")+b.toString(16)}return result}

// ===== PIN =====
// Se pide una vez al día en cada celular.
function pedirPin(){
  return new Promise(resolve=>{
    if(ls.get("motoya-ok")===hoyISO()){resolve();return}
    const box=$("pin");box.hidden=false;$("carga").hidden=true;
    let v="",fallos=0,bloqueo=0;
    const dots=[...$("dots").children];
    const pintar=()=>dots.forEach((d,i)=>d.classList.toggle("on",i<v.length));
    async function probar(){
      const h=await sha256(PIN_SALT+v);
      if(h===PIN_HASH){ls.set("motoya-ok",hoyISO());box.hidden=true;document.removeEventListener("keydown",tecla);resolve();return}
      fallos++;v="";pintar();$("dots").classList.remove("err");void $("dots").offsetWidth;$("dots").classList.add("err");
      if(fallos>=5){bloqueo=Date.now()+30000;fallos=0;$("pinerr").textContent="Demasiados intentos. Espera 30 segundos."}
      else $("pinerr").textContent="PIN incorrecto";
    }
    function teclear(k){
      if(Date.now()<bloqueo)return;
      if(k==="b")v=v.slice(0,-1);else if(k==="c")v="";else if(v.length<6){v+=k;if(v.length===1)$("pinerr").textContent=""}
      pintar();if(v.length===6)setTimeout(probar,120);
    }
    function tecla(e){if(/^\d$/.test(e.key))teclear(e.key);else if(e.key==="Backspace")teclear("b")}
    $("keys").addEventListener("click",e=>{const b=e.target.closest("[data-k]");if(b)teclear(b.dataset.k)});
    document.addEventListener("keydown",tecla);
  });
}

// ===== Datos =====
let DB=null,DATA=[],VEH=[],MODS=new Map(),BYC=new Map();
async function cargarDatos(){
  const r=await fetch("data.json",{cache:"no-cache"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}
function prepararDatos(db){
  DB=db;VEH=db.veh||[];DATA=db.p||[];
  MODS=new Map((db.m||[]).map(m=>[m[0]+"|"+m[1],m]));
  DATA.forEach(p=>{
    p.uni=p.ap.some(a=>a[0]==="UNIVERSAL");
    p.brands=[...new Set(p.ap.map(a=>a[0]).filter(b=>b!=="UNIVERSAL"))];
    p.hay=" "+nk(p.c)+" "+nk(p.cp)+" "+norm([p.d,p.f,p.mk,p.cp,...p.ap.map(a=>a[0]+" "+a[1])].join(" ")).replace(/[-/.,()]/g," ")+" "+p.ap.map(a=>nk(a[1])).join(" ");
  });
  BYC=new Map(DATA.map(p=>[p.c,p]));
}
const vi=v=>VEH.indexOf(v);
function stockDe(p,v){if(v==="BODEGA")return p.st.b||0;const i=vi(v);return i<0?0:(p.st.m[i]||0)}
function gavetaDe(p,v){const i=vi(v);return i<0?"":(p.st.g[i]||"")}

// Guarda las fotos en el celular para verlas sin internet
async function guardarFotos(){
  if(!("caches" in window)||!navigator.onLine)return;
  try{
    const c=await caches.open(IMG_CACHE);
    const urls=DATA.filter(p=>p.img).map(p=>"img/"+p.img);
    const falta=[];for(const u of urls){if(!(await c.match(u)))falta.push(u)}
    if(!falta.length)return;
    let n=0;const el=$("descarga");
    for(const u of falta){
      try{await c.add(u)}catch(e){}
      n++;el.textContent="Guardando fotos para usar sin internet: "+n+"/"+falta.length;
    }
    el.textContent="";aviso("Fotos guardadas: la app ya funciona sin internet");
  }catch(e){}
}

// ===== Estado =====
const state={q:"",fam:null,brand:null,model:null,veh:"BODEGA"};

function textMatch(p){const t=norm(state.q).replace(/[-/.,()]/g," ").split(/\s+/).filter(Boolean);return t.every(x=>p.hay.includes(x)||p.hay.includes(nk(x)))}
const fitsBrand=(p,b)=>p.brands.includes(b);
const fitsModel=(p,b,m)=>p.ap.some(a=>a[0]===b&&a[1]===m);
function base(skip){return DATA.filter(p=>textMatch(p)
  &&(skip==="fam"||!state.fam||p.f===state.fam)
  &&(skip==="brand"||!state.brand||fitsBrand(p,state.brand)||(p.uni&&skip!=="model"))
  &&(skip==="model"||skip==="brand"||!state.model||fitsModel(p,state.brand,state.model)||p.uni))}
function chipRow(el,items,key,label){
  el.innerHTML="";
  if(!items.length){el.innerHTML='<span class="hint">'+(key==="model"?"Elige primero la marca de la moto.":"Sin opciones con esta búsqueda.")+'</span>';return}
  items.forEach(([v,n])=>{const b=document.createElement("button");b.type="button";b.className="chip";
    b.innerHTML=esc(label(v))+"<small>"+n+"</small>";b.setAttribute("aria-pressed",state[key]===v?"true":"false");
    b.addEventListener("click",()=>{state[key]=state[key]===v?null:v;if(key==="brand")state.model=null;render();});
    el.appendChild(b)});
  const on=el.querySelector('[aria-pressed="true"]');if(on)el.scrollLeft=Math.max(0,on.offsetLeft-el.clientWidth/2+on.clientWidth/2);
}
function counts(list,fn){const m=new Map();list.forEach(p=>fn(p).forEach(k=>m.set(k,(m.get(k)||0)+1)));return m}

function apHtml(p){
  if(p.uni)return '<div class="brandline">Sirve para <b>todas las motos</b>.</div>';
  const g=new Map();p.ap.forEach(a=>{if(!g.has(a[0]))g.set(a[0],[]);g.get(a[0]).push(a)});
  const brands=[...g.keys()].sort((a,b)=>(a===state.brand?-1:b===state.brand?1:0)||BRAND_ORDER.indexOf(a)-BRAND_ORDER.indexOf(b));
  const line=b=>'<div class="brandline"><span class="bn">'+esc(b)+'</span>'+g.get(b).map(a=>{
      const hit=b===state.brand&&a[1]===state.model;
      return '<span class="mdl'+(hit?" hit":"")+'">'+esc(a[1])+(a[2]?'<i>'+esc(a[2])+'</i>':'')+'</span>'}).join("")+'</div>';
  const first=brands.slice(0,3),rest=brands.slice(3);
  return first.map(line).join("")+(rest.length?'<details><summary>Ver las otras '+rest.length+' marcas</summary>'+rest.map(line).join("")+'</details>':'');
}

// Estado de validación de la aplicación, bien visible para que el vendedor no lo tome como garantía
const VAL={
  CONFIRMADO:["ok","✔","Aplicación verificada","Confirmada con la tabla del proveedor."],
  CORREGIDO:["ok","✔","Aplicación corregida y verificada","Revisada y corregida con la tabla del proveedor."],
  UNIVERSAL:["ok","✔","Universal","Sirve para todas las motos."],
  VERIFICAR:["warn","⚠","Confirmar antes de vender","Compara con el repuesto viejo del cliente o con el empaque."],
  "SIN VALIDAR":["pend","⚠","Aplicación por validar","Todavía no está confirmada. Compara con el repuesto viejo del cliente antes de vender."]
};
function valHtml(p){const v=VAL[p.est]||VAL["SIN VALIDAR"];
  return `<div class="valban ${v[0]}"><span class="ic">${v[1]}</span><div><b>${v[2]}</b>${esc(v[3])}</div></div>`}

function gav(g){if(["M","N"].includes(g))return 'Columna '+g+'<small>arriba</small>';if(["O","P"].includes(g))return 'Columna '+g+'<small>abajo</small>';return 'Gaveta '+esc(g)}

function fotoHtml(p){
  if(!p.img)return '<div class="foto sin">Sin foto todavía</div>';
  const ref=/-ref\./.test(p.img);
  return `<button type="button" class="foto" data-zoom="${esc(p.c)}" aria-label="Ampliar foto de ${esc(p.c)}"><img loading="lazy" decoding="async" src="img/${esc(p.img)}" alt="${esc(p.d)}">${ref?'<span class="refb">Imagen de referencia</span>':''}</button>`;
}

function card(p){
  const v=state.veh,mine=stockDe(p,v),bod=p.st.b||0;
  let loc;
  if(v==="BODEGA"){const e=VEH.map((x,i)=>[x,p.st.g[i]]).filter(x=>x[1]);loc=e.length?'<div class="loc" style="font-size:18px">'+e.map(([x,g])=>esc(title(x))+": "+esc(g)).join("<br>")+'</div>':(bod>0?'<div class="loc">Bodega física</div>':'<div class="loc pend">No hay en bodega</div>')}
  else{const g=gavetaDe(p,v);loc=g?'<div class="loc">'+gav(g)+'</div>':'<div class="loc pend">Sin gaveta en este vehículo</div>'}
  const warn=[];
  if(state.brand&&state.model){const a=p.ap.find(x=>x[0]===state.brand&&x[1]===state.model);if(a&&a[3])warn.push(a[3]);if(a&&a[2])warn.push("Para la "+state.model+": posición "+a[2]+".")}
  if(p.ojo)warn.push(p.ojo);
  return `<article class="card">
    <div class="cardhead"><span class="fam">${esc(p.f)}</span><span class="code">${esc(p.c)}</span></div>
    ${fotoHtml(p)}
    <h2 class="desc">${esc(p.d)}</h2>
    <div class="meta"><span>Marca <strong>${esc(p.mk)}</strong></span><span>Presentación <strong>${esc(p.pr)}</strong></span></div>
    ${p.cp?`<div class="provline">Ref. proveedor <b>${esc(p.cp)}</b></div>`:""}
    ${valHtml(p)}
    ${warn.length?'<div class="ojo"><b>Ojo</b>'+warn.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div>':''}
    <div class="stock">
      <div class="box"><span class="lab">${v==="BODEGA"?"En bodega":"En mi vehículo"}</span><span class="v ${mine>0?"si":"no"}">${mine} und</span></div>
      <div class="box"><span class="lab">Dónde está</span>${loc}</div>
    </div>
    <div class="price">
      <div class="pbox tr"><span class="lab">Transferencia</span><div class="big">${money(p.venta)}</div><small>Precio full</small></div>
      <div class="pbox ef"><span class="lab">Efectivo −5%</span><div class="big">${money(p.promo)}</div><small>Ahorra ${money(p.venta-p.promo)}</small></div>
    </div>
    ${addHtml(p)}
    <div class="fits"><div class="fitshead"><span class="lab" style="margin:0">Sirve para${p.uni?"":" ("+p.ap.length+" modelos)"}</span></div>${apHtml(p)}</div>
    ${v!=="BODEGA"&&bod>0?`<div class="meta"><span>En bodega: <strong>${bod} und</strong></span></div>`:""}
  </article>`;
}

// Ficha de medidas de la moto elegida (MODELOS_MOTO del SAM)
function fichaHtml(){
  if(!state.brand||!state.model)return "";
  const m=MODS.get(state.brand+"|"+state.model);if(!m)return "";
  const f=(l,x)=>`<div><span>${l}</span>${x?`<b>${esc(x)}</b>`:'<b class="nd">Sin dato</b>'}</div>`;
  return `<section class="ficha"><h3>Ficha <span>${esc(state.brand)} ${esc(state.model)}</span></h3>
    <div class="fgrid">${f("Llanta delantera",m[2])}${f("Llanta trasera",m[3])}${f("Cadena",m[4])}${f("Batería",m[5])}${f("Bujía NGK",m[6])}</div>
    <p>Medidas de referencia según las tablas. Confírmalas en la moto del cliente.</p></section>`;
}

function render(){
  const famC=counts(base("fam"),p=>[p.f]);
  chipRow($("c1"),[...FAM_ORDER.filter(f=>famC.has(f)),...[...famC.keys()].filter(f=>!FAM_ORDER.includes(f))].map(f=>[f,famC.get(f)]),"fam",f=>sc(f));
  const brC=counts(base("brand"),p=>p.brands);
  chipRow($("c2"),[...BRAND_ORDER.filter(b=>brC.has(b)),...[...brC.keys()].filter(b=>!BRAND_ORDER.includes(b))].map(b=>[b,brC.get(b)]),"brand",b=>b==="AKT"||b==="TVS"?b:title(b));
  if(state.brand){const mC=counts(base("model"),p=>p.ap.filter(a=>a[0]===state.brand).map(a=>a[1]));
    chipRow($("c3"),[...mC.entries()].sort((a,b)=>a[0].localeCompare(b[0],"es",{numeric:true})),"model",m=>m)}
  else chipRow($("c3"),[],"model",m=>m);
  $("p1").textContent=state.fam?"· "+sc(state.fam):"";
  $("p2").textContent=state.brand?"· "+state.brand:"";
  $("p3").textContent=state.model?"· "+state.model:"";
  $("reset").hidden=!(state.fam||state.brand||state.model);
  const fh=fichaHtml();$("ficha").innerHTML=fh;$("ficha").hidden=!fh;
  const veh=state.veh;
  const res=base(null).sort((a,b)=>(a.uni-b.uni)||((stockDe(b,veh)>0)-(stockDe(a,veh)>0))||(FAM_ORDER.indexOf(a.f)-FAM_ORDER.indexOf(b.f))||a.d.localeCompare(b.d));
  const parts=[state.fam&&sc(state.fam),state.brand&&state.model?state.brand+" "+state.model:state.brand].filter(Boolean);
  $("count").innerHTML="<b>"+res.length+"</b> "+(res.length===1?"producto":"productos")+(parts.length?" · "+esc(parts.join(" · ")):"");
  $("list").innerHTML=res.length?res.map(card).join(""):'<div class="empty">No hay productos con esa combinación.<br>Quita un filtro o busca solo el modelo (ej. "NKD").</div>';
}

// ===== Cotización (se guarda en este celular, no va al SAM) =====
const nomDe=p=>p.d;
const detDe=p=>[title(p.mk||""),title(p.pr||"")].filter(Boolean).join(" · ");
let COT={items:[],cliente:"",asesor:""};
const QTY={};let verCot=false;
function cargarCot(){
  try{const v=JSON.parse(ls.get("motoya-cot")||"null");if(v&&Array.isArray(v.items))COT={items:v.items,cliente:v.cliente||"",asesor:v.asesor||""}}catch(e){}
  // Si cambió la lista de precios, lo cotizado toma los precios nuevos; lo que ya no existe se quita.
  COT.items=COT.items.filter(x=>BYC.has(x.c));
  COT.items.forEach(x=>{const p=BYC.get(x.c);x.nom=nomDe(p);x.det=detDe(p);x.venta=p.venta;x.promo=p.promo;x.q=Math.max(1,Math.round(+x.q)||1)});
}
function guardarCot(){ls.set("motoya-cot",JSON.stringify(COT));marcarBotonCot()}
const enCot=c=>COT.items.find(x=>x.c===c);
function marcarBotonCot(){const n=COT.items.length;$("nbadge").textContent=n;$("nbadge2").textContent=n;$("botcot").setAttribute("aria-pressed",verCot?"true":"false");$("botcot").setAttribute("aria-label","Cotización, "+n+(n===1?" producto":" productos"))}
function totalesCot(){let tr=0,ef=0,und=0;COT.items.forEach(x=>{tr+=x.venta*x.q;ef+=x.promo*x.q;und+=x.q});return{tr,ef,ahorro:tr-ef,und}}
function stockAviso(p,q){if(state.veh==="BODEGA")return"";const m=stockDe(p,state.veh),b=p.st.b||0;
  if(q<=m)return"";return m>0?`Solo tienes ${m} en tu vehículo${b?` (en bodega hay ${b})`:""}.`:`No tienes en tu vehículo${b?`; en bodega hay ${b}`:""}.`}

function addHtml(p){
  const ya=enCot(p.c),q=QTY[p.c]??(ya?ya.q:1);
  return `<div class="addcot" data-c="${esc(p.c)}">
    <div class="addrow">
      <div class="stepper"><button type="button" data-qm aria-label="Una unidad menos">−</button><input type="text" inputmode="numeric" data-q value="${q}" aria-label="Unidades de ${esc(p.c)}"><button type="button" data-qp aria-label="Una unidad más">+</button></div>
      <button type="button" class="btn cot${ya?" upd":""}" data-add>${ya?"Actualizar cotización":"Agregar a la cotización"}</button>
    </div>
    <div data-extra>${addExtra(p,q)}</div>
  </div>`;
}
function addExtra(p,q){
  const ya=enCot(p.c),w=stockAviso(p,q);
  return (q>1?`<div class="lineval">${q} und: <b>${money(p.venta*q)}</b> transferencia · <b class="ef">${money(p.promo*q)}</b> efectivo</div>`:"")
    +(w?`<div class="swarn">⚠ ${esc(w)}</div>`:"")
    +(ya?`<div class="encot"><span>✓ En la cotización: ${ya.q} ${ya.q===1?"unidad":"unidades"}</span><button type="button" data-vercot>Ver cotización (${COT.items.length})</button></div>`:"");
}
function refrescarAdd(el){const p=BYC.get(el.dataset.c);if(!p)return;const ya=enCot(p.c),q=QTY[p.c]??(ya?ya.q:1);
  el.querySelector("[data-q]").value=q;const b=el.querySelector("[data-add]");b.textContent=ya?"Actualizar cotización":"Agregar a la cotización";b.classList.toggle("upd",!!ya);
  el.querySelector("[data-extra]").innerHTML=addExtra(p,q)}
function setQty(el,v){const c=el.dataset.c;QTY[c]=Math.max(1,Math.min(999,Math.round(v)||1));refrescarAdd(el)}

function abrirCot(){verCot=true;pintarCot();mostrarVista();window.scrollTo(0,0)}
function cerrarCot(){verCot=false;mostrarVista();render()}
function mostrarVista(){document.querySelector(".filters").hidden=verCot;$("count").hidden=verCot;$("list").hidden=verCot;$("ficha").hidden=verCot||!$("ficha").innerHTML;$("cotiz").hidden=!verCot;marcarBotonCot()}
function pintarCot(){
  const c=$("cotiz");
  const volver='<button type="button" class="volver" id="cvolver">← Volver al catálogo</button>';
  if(!COT.items.length){c.innerHTML=volver+'<div class="nada"><h2>La cotización está vacía</h2><p>Busca el repuesto, elige las unidades en la tarjeta y toca «Agregar a la cotización».</p></div>';$("cvolver").onclick=cerrarCot;return}
  c.innerHTML=volver+`
    <div class="bloque">
      <h3>Datos de la cotización</h3>
      <label class="campo"><span>Cliente</span><input id="ccli" type="text" autocomplete="off" placeholder="Nombre del cliente" value="${esc(COT.cliente)}"></label>
      <label class="campo"><span>Asesor</span><input id="cases" type="text" autocomplete="off" placeholder="Tu nombre" value="${esc(COT.asesor)}"></label>
      <p class="cfecha">Fecha: <b>${hoy()}</b> · ${COT.items.length} producto${COT.items.length>1?"s":""}</p>
    </div>
    <div style="display:grid;gap:12px">${COT.items.map((x,i)=>`
      <div class="citem">
        <div class="chead"><button type="button" class="clink" data-abrir="${i}">${esc(x.c)} ›</button><button type="button" class="quitar" data-quitar="${i}">Quitar</button></div>
        <div class="cnom">${esc(x.nom)}${x.det?`<small>${esc(x.det)}</small>`:""}</div>
        <div class="prow"><span>Transferencia c/u</span><b>${money(x.venta)}</b></div>
        <div class="prow ef"><span>Efectivo −5% c/u</span><b>${money(x.promo)}</b></div>
        <div class="cqrow"><span class="lab" style="margin:0">Unidades</span><div class="stepper"><button type="button" data-qm="${i}" aria-label="Una unidad menos">−</button><input type="text" inputmode="numeric" data-q="${i}" value="${x.q}" aria-label="Unidades de ${esc(x.c)}"><button type="button" data-qp="${i}" aria-label="Una unidad más">+</button></div></div>
        <div class="swarn" data-sw="${i}"></div>
        <div class="prow sub"><span>Subtotal transferencia</span><b data-vt="${i}"></b></div>
        <div class="prow sub ef"><span>Subtotal efectivo</span><b data-ve="${i}"></b></div>
      </div>`).join("")}
    </div>
    <div class="bloque totales" id="ctot"></div>
    <div class="acciones">
      <button class="btn wa" id="cimg" type="button">Enviar cotización como imagen</button>
      <a class="btn wa2" id="cwa" target="_blank" rel="noopener">Enviar cotización por WhatsApp</a>
      <button class="btn copiar" id="ccop" type="button">Copiar cotización</button>
      <button class="btn vaciar" id="cvac" type="button">Vaciar cotización</button>
    </div>`;
  $("cvolver").onclick=cerrarCot;
  $("ccli").addEventListener("input",e=>{COT.cliente=e.target.value;guardarCot();refrescarCot()});
  $("cases").addEventListener("input",e=>{COT.asesor=e.target.value;ls.set("motoya-asesor",COT.asesor);guardarCot();refrescarCot()});
  $("ccop").onclick=()=>copiar(textoCot(),"Cotización copiada");
  $("cimg").onclick=()=>enviarImagen(dibujarCot,"Cotizacion_MOTO-YA_"+hoy().replace(/\//g,"-"),"Cotización MOTO-YA");
  $("cvac").onclick=e=>{const b=e.currentTarget;
    if(!b.dataset.ok){b.dataset.ok="1";b.textContent="Toca otra vez para vaciar todo";b.classList.add("confirmar");setTimeout(()=>{if(b.isConnected){delete b.dataset.ok;b.textContent="Vaciar cotización";b.classList.remove("confirmar")}},4000);return}
    COT.items=[];COT.cliente="";guardarCot();pintarCot();aviso("Cotización vaciada")};
  refrescarCot();
}
function refrescarCot(){
  COT.items.forEach((x,i)=>{const t=document.querySelector(`[data-vt="${i}"]`),f=document.querySelector(`[data-ve="${i}"]`),w=document.querySelector(`[data-sw="${i}"]`);
    if(t)t.textContent=money(x.venta*x.q);if(f)f.textContent=money(x.promo*x.q);
    if(w){const s=stockAviso(BYC.get(x.c),x.q);w.textContent=s?"⚠ "+s:"";w.hidden=!s}});
  const t=totalesCot(),el=$("ctot");if(!el)return;
  el.innerHTML=`<h3>Totales</h3>
    <div class="prow"><span>Unidades</span><b>${t.und}</b></div>
    <div class="tbox tr"><span>Total transferencia</span><b>${money(t.tr)}</b></div>
    <div class="tbox ef"><span>Total efectivo (−5%)</span><b>${money(t.ef)}</b><em>¡Ahorras ${money(t.ahorro)}!</em></div>`;
  const a=$("cwa");if(a)a.href="https://wa.me/?text="+encodeURIComponent(textoCot());
}
function syncQ(i){const x=COT.items[i];if(!x)return;x.q=Math.max(1,Math.min(999,Math.round(x.q)||1));const inp=document.querySelector(`#cotiz [data-q="${i}"]`);if(inp)inp.value=x.q;guardarCot();refrescarCot()}

function textoCot(){
  const t=totalesCot(),L=["*MOTO-YA!*","*COTIZACIÓN* · "+hoy()];
  const enc=[COT.cliente.trim()?"*Cliente:* "+COT.cliente.trim():"",COT.asesor.trim()?"*Asesor:* "+COT.asesor.trim():""].filter(Boolean);
  if(enc.length)L.push(enc.join("\n"));
  L.push(COT.items.map((x,i)=>`*${i+1}. ${x.nom}*${x.det?" ("+x.det+")":""}\n${x.q} und × ${money(x.venta)} = *${money(x.venta*x.q)}*\n_En efectivo: ${x.q} und × ${money(x.promo)} = ${money(x.promo*x.q)}_`).join("\n\n"));
  L.push([`*TOTAL PAGO POR TRANSFERENCIA: ${money(t.tr)}*`,`*TOTAL PAGO EN EFECTIVO (−5%): ${money(t.ef)}*`,`_Pagando en efectivo ahorra ${money(t.ahorro)}_`].join("\n"));
  L.push("_Precios sujetos a cambio y a disponibilidad._");
  return L.join("\n\n");
}

// Imagen de la cotización (franjas navy/naranja, tabla y cajas de totales)
const F='Barlow,"Segoe UI",Roboto,Arial,sans-serif',FD='"Barlow Condensed","Arial Narrow",Arial,sans-serif';
const NAVY="#0e1f3d",ORANGE="#f58a1f",GRIS="#5a6780",TINTA="#141c2b",VERDE="#169247",AZUL="#1f5fb8";
function rr(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else{ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}}
function lineas(ctx,texto,ancho){const out=[];let l="";for(const w of String(texto).split(/\s+/)){const t=l?l+" "+w:w;if(ctx.measureText(t).width>ancho&&l){out.push(l);l=w}else l=t}if(l)out.push(l);return out}
function lienzo(planFn){const cv=document.createElement("canvas");const ctx=cv.getContext("2d");cv.width=1080;cv.height=10;const h=planFn(ctx,cv,false);cv.height=h;planFn(ctx,cv,true);return cv}
function dibujarCot(){
  const t=totalesCot();
  return lienzo((ctx,cv,draw)=>{
    const W=1080,M=60,H=cv.height;
    const txt=(s,x,y,font,col,al)=>{ctx.font=font;if(draw){ctx.fillStyle=col;ctx.textAlign=al||"left";ctx.fillText(s,x,y);ctx.textAlign="left"}};
    if(draw){
      ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
      ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(W,0);ctx.lineTo(W,120);ctx.bezierCurveTo(820,70,560,40,300,0);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(250,-8);ctx.bezierCurveTo(540,46,810,92,W+10,146);ctx.stroke();
    }
    const cx=M+120,cy=200,R=125,logo=document.querySelector(".hero .logo img");
    if(draw){ctx.save();ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=24;ctx.shadowOffsetY=8;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fill();ctx.restore();
      ctx.strokeStyle=NAVY;ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,R-10,0,7);ctx.stroke();
      if(logo&&logo.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(cx,cy,R-14,0,7);ctx.clip();const lw=196,lh=lw*logo.naturalHeight/logo.naturalWidth;ctx.drawImage(logo,cx-lw/2,cy-lh/2,lw,lh);ctx.restore()}}
    const bx=cx+R+10;
    if(draw){ctx.fillStyle=NAVY;rr(ctx,bx,165,W-bx+40,112,18);ctx.fill();ctx.fillStyle=ORANGE;ctx.fillRect(bx+40,287,W-bx-40,10)}
    ctx.font=`700 86px ${FD}`;const w1=ctx.measureText("COTI").width;
    txt("COTI",bx+36,252,`700 86px ${FD}`,"#fff");txt("ZACIÓN",bx+36+w1,252,`700 86px ${FD}`,ORANGE);
    txt("Fecha: "+hoy(),W-M,345,`600 30px ${F}`,GRIS,"right");
    let y=380;
    const colW=(W-2*M-40)/2;let yA=y,yB=y;
    const dato=(k,v,x,yy)=>{if(!v)return yy;txt(k,x,yy+34,`500 28px ${F}`,GRIS);ctx.font=`700 36px ${F}`;let z=yy+34;for(const l of lineas(ctx,v,colW)){z+=46;txt(l,x,z,`700 36px ${F}`,NAVY)}return z};
    yA=dato("Cliente:",COT.cliente.trim(),M,y);yB=dato("Asesor:",COT.asesor.trim(),M+colW+40,y);
    y=Math.max(yA,yB)+(Math.max(yA,yB)>y?40:0);
    const xC=545,xT=805,xE=W-M-22,nameW=xC-55-(M+22);
    if(draw){ctx.fillStyle=NAVY;rr(ctx,M,y,W-2*M,64,14);ctx.fill()}
    txt("Repuesto",M+22,y+42,`700 26px ${F}`,"#fff");txt("Cant.",xC,y+42,`700 26px ${F}`,"#fff","center");
    txt("Transferencia",xT,y+42,`700 26px ${F}`,"#fff","right");txt("Efectivo",xE,y+42,`700 26px ${F}`,"#fff","right");
    y+=64;
    COT.items.forEach((x,i)=>{
      ctx.font=`700 30px ${F}`;const nl=lineas(ctx,x.nom,nameW);
      ctx.font=`500 24px ${F}`;const sl=lineas(ctx,`${x.c}${x.det?" · "+x.det:""} · c/u ${money(x.venta)} / ${money(x.promo)}`,nameW);
      const rh=22+nl.length*38+sl.length*32+18;
      if(draw){ctx.fillStyle=i%2?"#ffffff":"#eef2f8";ctx.fillRect(M,y,W-2*M,rh);ctx.fillStyle="#d5dceb";ctx.fillRect(M,y+rh-2,W-2*M,2)}
      let yy=y+22;for(const l of nl){yy+=32;txt(l,M+22,yy,`700 30px ${F}`,TINTA);yy+=6}
      for(const l of sl){yy+=30;txt(l,M+22,yy,`500 24px ${F}`,GRIS);yy+=2}
      const ym=y+22+38;
      txt(String(x.q),xC,ym,`700 34px ${F}`,TINTA,"center");
      txt(money(x.venta*x.q),xT,ym,`700 32px ${F}`,NAVY,"right");
      txt(money(x.promo*x.q),xE,ym,`700 32px ${F}`,VERDE,"right");
      y+=rh;
    });
    y+=36;
    if(draw){ctx.save();ctx.shadowColor="rgba(31,95,184,.35)";ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle=AZUL;rr(ctx,M,y,W-2*M,150,22);ctx.fill();ctx.restore()}
    txt("TOTAL TRANSFERENCIA",M+36,y+62,`700 32px ${F}`,"#dbe8ff");
    txt(money(t.tr),W-M-36,y+122,`700 84px ${F}`,"#fff","right");
    y+=150+24;
    if(draw){ctx.fillStyle="#fff";rr(ctx,M,y,W-2*M,220,22);ctx.fill();ctx.strokeStyle=VERDE;ctx.lineWidth=6;rr(ctx,M+3,y+3,W-2*M-6,214,20);ctx.stroke()}
    txt("TOTAL EFECTIVO (−5%)",M+36,y+62,`700 32px ${F}`,NAVY);
    txt(money(t.ef),W-M-36,y+130,`700 84px ${F}`,NAVY,"right");
    if(draw){ctx.fillStyle="#d9eee1";ctx.fillRect(M+36,y+150,W-2*M-72,3)}
    txt("¡Ahorras "+money(t.ahorro)+" pagando en efectivo!",W/2,y+198,`700 36px ${F}`,VERDE,"center");
    y+=220+40;
    ctx.font=`400 26px ${F}`;for(const l of lineas(ctx,"Precios sujetos a cambio y a disponibilidad. El descuento del 5 % aplica solo para pago en efectivo.",W-2*M)){y+=36;txt(l,M,y,`400 26px ${F}`,GRIS)}
    y+=70;
    txt("Repuestos de calidad al mejor precio",W/2,y,`italic 700 40px ${F}`,NAVY,"center");
    y+=30;
    if(draw){ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(0,y+40);ctx.bezierCurveTo(320,y+110,700,y+20,W,y+60);ctx.lineTo(W,y+140);ctx.lineTo(0,y+140);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-10,y+22);ctx.bezierCurveTo(320,y+92,700,y+2,W+10,y+40);ctx.stroke()}
    return y+140;
  });
}
async function enviarImagen(dibujarFn,nombre,titulo){
  aviso("Preparando imagen…");
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(e){}
  const cv=dibujarFn();
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
  const file=new File([blob],nombre+".png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:titulo});return}}catch(e){if(e&&e.name==="AbortError")return}
  const v=$("visor");$("visorimg").src=URL.createObjectURL(blob);v.hidden=false;v.scrollTop=0;
}
function copiar(txt,ok){
  const fallback=()=>{const ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");aviso(ok||"Copiado")}catch(e){aviso("No se pudo copiar")}ta.remove()};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>aviso(ok||"Copiado"),fallback);else fallback();
}

// ===== Eventos de la interfaz =====
function conectarEventos(){
  const sel=$("veh");
  [...VEH,"BODEGA"].forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v==="BODEGA"?"Bodega":title(v);sel.appendChild(o)});
  const guardado=ls.get("motoya-veh");state.veh=(guardado&&(VEH.includes(guardado)||guardado==="BODEGA"))?guardado:(VEH[0]||"BODEGA");
  sel.value=state.veh;
  sel.addEventListener("change",()=>{state.veh=sel.value;ls.set("motoya-veh",sel.value);render();if(verCot)refrescarCot()});

  $("q").addEventListener("input",e=>{state.q=e.target.value;if(verCot){verCot=false;mostrarVista()}render()});
  $("clr").addEventListener("click",()=>{$("q").value="";state.q="";render();$("q").focus()});
  $("reset").addEventListener("click",()=>{state.fam=state.brand=state.model=null;render()});

  $("list").addEventListener("click",e=>{
    const z=e.target.closest("[data-zoom]");if(z){abrirZoom(z.dataset.zoom);return}
    const el=e.target.closest(".addcot");if(!el)return;const c=el.dataset.c,p=BYC.get(c);
    if(e.target.closest("[data-qm]")){setQty(el,(QTY[c]??(enCot(c)?.q||1))-1);return}
    if(e.target.closest("[data-qp]")){setQty(el,(QTY[c]??(enCot(c)?.q||1))+1);return}
    if(e.target.closest("[data-vercot]")){abrirCot();return}
    if(e.target.closest("[data-add]")){
      const q=QTY[c]??(enCot(c)?.q||1),ya=enCot(c);
      if(ya)ya.q=q;else COT.items.push({c,nom:nomDe(p),det:detDe(p),venta:p.venta,promo:p.promo,q});
      guardarCot();refrescarAdd(el);aviso(ya?"Cotización actualizada":"Agregado a la cotización")}
  });
  $("list").addEventListener("input",e=>{const i=e.target.closest("[data-q]");if(!i)return;const el=i.closest(".addcot"),v=parseInt(i.value.replace(/\D/g,""),10);if(v>0){QTY[el.dataset.c]=Math.min(999,v);el.querySelector("[data-extra]").innerHTML=addExtra(BYC.get(el.dataset.c),QTY[el.dataset.c])}});
  $("list").addEventListener("change",e=>{const i=e.target.closest("[data-q]");if(i)setQty(i.closest(".addcot"),parseInt(i.value.replace(/\D/g,""),10))});
  $("list").addEventListener("focusin",e=>{const i=e.target.closest("[data-q]");if(i)i.select()});

  $("botcot").addEventListener("click",()=>verCot?cerrarCot():abrirCot());
  $("botcot2").addEventListener("click",()=>verCot?cerrarCot():abrirCot());
  if("IntersectionObserver" in window)new IntersectionObserver(es=>{$("botcot2").hidden=es[0].isIntersecting}).observe($("botcot"));

  $("cotiz").addEventListener("click",e=>{
    const g=a=>{const el=e.target.closest(`[${a}]`);return el?+el.getAttribute(a):null};let i;
    if((i=g("data-quitar"))!==null){const x=COT.items[i];COT.items.splice(i,1);guardarCot();pintarCot();aviso("Se quitó "+x.c);return}
    if((i=g("data-qm"))!==null){COT.items[i].q--;syncQ(i);return}
    if((i=g("data-qp"))!==null){COT.items[i].q++;syncQ(i);return}
    if((i=g("data-abrir"))!==null){const c=COT.items[i].c;state.q=c;state.fam=state.brand=state.model=null;$("q").value=c;cerrarCot()}
  });
  $("cotiz").addEventListener("input",e=>{const inp=e.target.closest("[data-q]");if(!inp)return;const i=+inp.dataset.q,v=parseInt(inp.value.replace(/\D/g,""),10);if(v>0){COT.items[i].q=Math.min(999,v);guardarCot();refrescarCot()}});
  $("cotiz").addEventListener("change",e=>{const inp=e.target.closest("[data-q]");if(inp)syncQ(+inp.dataset.q)});
  $("cotiz").addEventListener("focusin",e=>{const inp=e.target.closest("[data-q]");if(inp)inp.select()});

  $("cerrarvisor").onclick=()=>{$("visor").hidden=true};
  $("cerrarzoom").onclick=cerrarZoom;
  $("zoom").addEventListener("click",e=>{if(e.target===$("zoom"))cerrarZoom()});
  window.addEventListener("popstate",()=>{if(!$("zoom").hidden)$("zoom").hidden=true});

  const net=()=>{const on=navigator.onLine;$("net").className="net "+(on?"on":"off");$("net").textContent=on?"Con internet":"Sin internet"};
  window.addEventListener("online",()=>{net();guardarFotos()});window.addEventListener("offline",net);net();
}
function abrirZoom(c){const p=BYC.get(c);if(!p||!p.img)return;$("zoomimg").src="img/"+p.img;$("zoomimg").alt=p.d;
  $("zoomtxt").innerHTML=esc(p.c)+" · "+esc(p.d)+(/-ref\./.test(p.img)?"<small>Imagen de referencia: el producto puede verse distinto.</small>":"");
  $("zoom").hidden=false;try{history.pushState({z:1},"")}catch(e){}}
function cerrarZoom(){if($("zoom").hidden)return;$("zoom").hidden=true;try{if(history.state&&history.state.z)history.back()}catch(e){}}

// ===== Instalación y actualización =====
let promptInstalar=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();promptInstalar=e;$("instalar").hidden=false});
window.addEventListener("appinstalled",()=>{$("instalar").hidden=true;aviso("¡App instalada! Ábrela desde el ícono MOTO-YA")});
$("instalar").addEventListener("click",async()=>{if(!promptInstalar)return;promptInstalar.prompt();try{await promptInstalar.userChoice}catch(e){}promptInstalar=null;$("instalar").hidden=true});

function registrarSW(){
  if(!("serviceWorker" in navigator))return;
  navigator.serviceWorker.register("sw.js").then(reg=>{
    const ofrecer=w=>{if(!w)return;$("updbar").hidden=false;$("updbtn").onclick=()=>{w.postMessage("activar");$("updbtn").disabled=true;$("updbtn").textContent="Actualizando…"}};
    if(reg.waiting&&navigator.serviceWorker.controller)ofrecer(reg.waiting);
    reg.addEventListener("updatefound",()=>{const w=reg.installing;w&&w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)ofrecer(w)})});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&navigator.onLine){reg.update().catch(()=>{});revisarDatos()}});
  }).catch(()=>{});
  let recargando=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(recargando)return;recargando=true;location.reload()});
}

// Si hay datos nuevos en el servidor mientras la app está abierta, los toma
async function revisarDatos(){
  try{const db=await cargarDatos();if(DB&&db.v!==DB.v){aplicarDatos(db,true)}}catch(e){}
}
function aplicarDatos(db,avisar){
  prepararDatos(db);cargarCot();
  $("corte").textContent="Precios y existencias al "+db.corte;
  $("foot").innerHTML="MOTO-YA app v"+APP_VERSION+" · Datos del SAM al "+esc(db.corte)+" · "+DATA.length+" productos.<br>Si algo no cuadra, confírmalo antes de vender.";
  const antes=ls.get("motoya-dv");ls.set("motoya-dv",db.v);
  if(avisar||(antes&&antes!==db.v))aviso("Datos actualizados al "+db.corte,3500);
  marcarBotonCot();render();if(verCot)pintarCot();
  guardarFotos();
}

// ===== Inicio =====
(async function iniciar(){
  registrarSW();
  await pedirPin();
  $("carga").hidden=false;$("carga").textContent="Cargando catálogo…";
  let db;
  try{db=await cargarDatos()}
  catch(e){$("carga").innerHTML="<b>No se pudieron cargar los datos.</b><br>Abre la app una vez con internet para descargarlos.";return}
  COT.asesor=ls.get("motoya-asesor")||"";
  prepararDatos(db);conectarEventos();
  $("carga").hidden=true;$("app").hidden=false;
  aplicarDatos(db,false);
  if(!COT.asesor){COT.asesor=ls.get("motoya-asesor")||""}
})();
