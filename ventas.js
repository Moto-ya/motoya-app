/* MOTO-YA app · Ventas: menú principal, servicios, tienda, recibos, clientes y cierre diario.
   Todo se guarda en este celular hasta que el vendedor envía el cierre del día por WhatsApp.
   En el SAM, el botón "Importar cierres" pasa los recibos a VENTAS, TIENDA y ARQUEO_DIARIO. */
"use strict";

// ===== Datos de ventas =====
let TND=[],TBYC=new Map(),TV=[],RUTAS=[],RDIA={};
const VST={rec:"motoya-recibos",cli:"motoya-clientes",cie:"motoya-cierres",ruta:"motoya-ruta",tcart:"motoya-tcart"};
let RECS=[],CLIS=[],CIES={},TCART=[],VEND=new Map(),VISTA="home",ULTREC=null;
const PAGOS=["EFECTIVO","NEQUI","DAVIPLATA"];
const DIAS=["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
const MOD_NOM={R:"Repuestos y Servicios",T:"Tienda"};

function jget(k,d){try{const v=JSON.parse(ls.get(k)||"null");return v==null?d:v}catch(e){return d}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){aviso("⚠ El celular no tiene espacio para guardar. Haz el cierre del día.",6000);return false}}
const guardarRecs=()=>{jset(VST.rec,RECS);calcVendido()};
const guardarClis=()=>jset(VST.cli,CLIS);
const guardarCies=()=>jset(VST.cie,CIES);
const guardarTCart=()=>jset(VST.tcart,TCART);

function cargarVentas(){
  RECS=jget(VST.rec,[]);CLIS=jget(VST.cli,[]);CIES=jget(VST.cie,{});TCART=jget(VST.tcart,[]);
  // Limpieza: recibos de más de 40 días que ya salieron en un cierre final
  const lim=new Date();lim.setDate(lim.getDate()-40);const limISO=iso(lim);
  const antes=RECS.length;RECS=RECS.filter(r=>!(r.cer&&r.f<limISO));if(RECS.length!==antes)jset(VST.rec,RECS);
}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
const fdm=s=>s?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"";
const horaAhora=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
const telFmt=t=>t&&t.length===10?t.slice(0,3)+" "+t.slice(3,6)+" "+t.slice(6):t||"";
const limpio=s=>(s??"").toString().replace(/[;\r\n\t]+/g," ").trim();
function vcod(v){const w=norm(v).split(/\s+/).filter(Boolean);if(!w.length)return"MV";const u=w[w.length-1].replace(/[^A-Z0-9]/g,"");return u.length<=3?u:u.slice(0,3)}

// Servicios del SAM como "productos" del catálogo (familia SERVICIOS)
function serviciosComoProductos(db){
  return (db.s||[]).map(s=>({c:s.c,cp:"",d:s.d,mk:"MOTO-YA",pr:"SERVICIO",venta:+s.precio||0,promo:+s.precio||0,min:+s.min||0,
    f:"SERVICIOS",ojo:"",est:"UNIVERSAL",ap:[],st:{b:0,m:[],g:[]},srv:true,inc:s.inc||"",fams:s.fam||""}));
}
function prepararVentas(db){
  TV=db.tv||[];RUTAS=db.rutas||[];RDIA=db.rd||{};
  TND=(db.t||[]).map(t=>({...t,precio:+t.precio||0,min:+t.min||0,st:t.st||[],hay:norm([t.c,t.d,t.cat,t.pr].join(" "))}));
  TBYC=new Map(TND.map(t=>[t.c,t]));
  TCART=TCART.filter(x=>TBYC.has(x.c));
  calcVendido();
}

// Lo vendido en este celular después del último corte del SAM se descuenta de la existencia
function corteTs(){const v=(DB&&DB.v)||"";if(v.length<12)return 0;
  return new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8),+v.slice(8,10),+v.slice(10,12),+v.slice(12,14)||0).getTime()}
function calcVendido(){VEND=new Map();const ct=corteTs();
  RECS.forEach(r=>{if(r.an||r.ts<=ct)return;r.it.forEach(x=>{if(x.t==="S")return;const k=r.veh+"|"+x.c;VEND.set(k,(VEND.get(k)||0)+x.q)})})}
const vendidoLocal=(c,v)=>VEND.get(v+"|"+c)||0;
function stockT(t,v){const i=TV.indexOf(v);return (i<0?0:(+t.st[i]||0))-vendidoLocal(t.c,v)}

// ===== Navegación entre pantallas =====
const VISTAS=["home","app","vtnd","vcob","vrec","vlist","vcli","vcie","vsel","vhis"];
function verSinHist(id){VISTAS.forEach(x=>{const e=$(x);if(e)e.hidden=x!==id});VISTA=id;window.scrollTo(0,0);
  if(id==="home")pintarHome();if(id==="app"){render();if(verCot)pintarCot()}if(id==="vtnd")pintarTienda()}
function ver(id,reemplazar){verSinHist(id);try{(reemplazar?history.replaceState:history.pushState).call(history,{v:id},"")}catch(e){}}
window.addEventListener("popstate",e=>{if(!$("zoom").hidden||!$("visor").hidden){$("visor").hidden=true;return}
  const s=e.state,dest=s&&s.v?s.v:"home";if(dest!==VISTA)verSinHist(dest)});

// ===== Menú principal =====
function rutaHoy(){const g=jget(VST.ruta,null);if(g&&g.f===hoyISO()&&g.r)return g.r;return RDIA[DIAS[new Date().getDay()]]||""}
function pendientesCierre(veh,mod){const hoy=hoyISO(),f=new Set();RECS.forEach(r=>{if(r.veh===veh&&!r.cer&&r.f<hoy&&(!mod||r.mod===mod))f.add(r.f)});return[...f].sort()}
function pintarHome(){
  const hv=$("hveh");
  if(!hv.options.length){hv.innerHTML='<option value="">Elige el móvil</option>'+VEH.map(v=>`<option value="${esc(v)}">${esc(title(v))}</option>`).join("")}
  hv.value=VEH.includes(state.veh)?state.veh:"";
  const hr=$("hruta"),r=rutaHoy();
  const lista=[...RUTAS];if(r&&!lista.includes(r))lista.unshift(r);
  hr.innerHTML='<option value="">Elige la ruta</option>'+lista.map(x=>`<option value="${esc(x)}">${esc(title(x))}</option>`).join("");
  hr.value=r;
  $("hases").value=ls.get("motoya-asesor")||"";
  const veh=VEH.includes(state.veh)?state.veh:"";
  const tieneT=!!veh&&TV.includes(veh);
  $("goTnd").disabled=!tieneT;
  $("goTndNota").textContent=!veh?"Elige el móvil":(tieneT?"Bebidas, snacks y varios":"Este móvil no tiene tienda");
  const hoy=hoyISO(),rh=RECS.filter(x=>x.veh===veh&&x.f===hoy&&!x.an);
  $("bRecN").textContent=rh.length;$("bRecT").textContent=money(rh.reduce((a,x)=>a+x.tot,0));
  const pc=CLIS.filter(c=>!c.g).length;$("bCliN").textContent=pc;$("bCliN").hidden=!pc;
  const pend=veh?modsDe(veh).map(m=>[m,pendientesCierre(veh,m)]).filter(x=>x[1].length):[];
  $("hpend").hidden=!pend.length;
  if(pend.length)$("hpend").innerHTML="⚠ Falta enviar "+pend.map(([m,d])=>"el cierre de "+(m==="T"?"tienda":"repuestos")+" del "+d.map(fdm).join(", ")).join(" y ")+'. <button type="button" id="hpendBtn">Hacer cierre</button>';
  $("hcorte").textContent=DB?"Datos del SAM al "+DB.corte:"";
}
function elegirVeh(v){state.veh=v;ls.set("motoya-veh",v);const s=$("veh");if(s)s.value=v;calcVendido()}
function necesitaVeh(){if(VEH.includes(state.veh))return false;aviso("Primero elige en el menú en qué móvil vas");ver("home");return true}

// ===== Servicio en el catálogo =====
function cardServicio(p){
  const fams=(p.fams||"").split(",").map(s=>s.trim()).filter(Boolean);
  return `<article class="card srvcard">
    <div class="cardhead"><span class="fam">Servicio · mano de obra</span><span class="code">${esc(p.c)}</span></div>
    <h2 class="desc">${esc(p.d)}</h2>
    ${p.inc?`<p class="srvinc">${esc(p.inc)}</p>`:""}
    <div class="price one"><div class="pbox tr"><span class="lab">Mano de obra</span><div class="big">${p.venta?money(p.venta):"Sin precio"}</div><small>Los repuestos se cobran aparte</small></div></div>
    ${fams.length?`<div class="srvfam"><span class="lab">Repuestos que se usan (venta cruzada)</span><div>${fams.map(f=>`<button type="button" class="chip" data-famsrv="${esc(f)}">${esc(sc(f))}</button>`).join("")}</div></div>`:""}
    ${p.venta?addHtml(p):'<div class="swarn">⚠ Este servicio no tiene precio en el SAM (hoja SERVICIOS).</div>'}
  </article>`;
}

// ===== Tienda =====
let TQ="",TCAT=null;
function pintarTienda(){
  const veh=state.veh;$("tveh").textContent=title(veh||"");
  const th=RECS.filter(r=>r.veh===veh&&r.f===hoyISO()&&r.mod==="T"&&!r.an);
  $("thoy").textContent=th.length?"Hoy: "+th.length+" venta"+(th.length>1?"s":"")+" · "+money(th.reduce((a,r)=>a+r.tot,0)):"Hoy todavía no hay ventas de tienda";
  if(!TND.length){$("tlist").innerHTML='<div class="empty">Aún no hay productos de tienda.<br>En el SAM: créalos en la hoja TIENDA y exporta la app.</div>';$("tcats").innerHTML="";pintarTBar();return}
  const cnt={};TND.forEach(t=>{const k=t.cat||"VARIOS";cnt[k]=(cnt[k]||0)+1});const cats=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
  $("tcats").innerHTML=cats.map(c=>`<button type="button" class="chip" data-tcat="${esc(c)}" aria-pressed="${TCAT===c}">${esc(sc(c))}</button>`).join("");
  const q=norm(TQ).split(/\s+/).filter(Boolean);
  const res=TND.filter(t=>(!TCAT||(t.cat||"VARIOS")===TCAT)&&q.every(x=>t.hay.includes(x)));
  $("tlist").innerHTML=res.length?res.map(t=>{
    const s=stockT(t,veh),enc=TCART.find(x=>x.c===t.c);
    return `<button type="button" class="ttile${enc?" on":""}" data-tadd="${esc(t.c)}">
      ${enc?`<span class="tq">${enc.q}</span>`:""}
      <span class="tnom">${esc(t.d)}</span>${t.pr?`<span class="tpr">${esc(t.pr)}</span>`:""}
      <span class="tprecio">${money(t.precio)}</span>
      <span class="tst ${s>0?"si":"no"}">${s>0?"Hay "+s:"Sin existencia"}</span>
    </button>`}).join(""):'<div class="empty">No hay productos con esa búsqueda.</div>';
  pintarTBar();
}
function pintarTBar(){
  const und=TCART.reduce((a,x)=>a+x.q,0),tot=TCART.reduce((a,x)=>a+(TBYC.get(x.c)?.precio||0)*x.q,0);
  $("tbar").hidden=!und;
  $("tbarTxt").innerHTML=`<b>${und}</b> und · <b>${money(tot)}</b>`;
}

// ===== Cobro (registrar la venta) =====
let COB=null;
function lineaR(x){const p=BYC.get(x.c);if(!p)return null;
  return{c:p.c,d:p.d,t:p.srv?"S":"R",q:x.q,venta:p.venta,promo:p.promo,min:+p.min||0,p:null,ed:false}}
function lineaT(x){const t=TBYC.get(x.c);if(!t)return null;
  return{c:t.c,d:t.d+(t.pr?" "+t.pr:""),t:"T",q:x.q,venta:t.precio,promo:t.precio,min:+t.min||0,p:null,ed:false}}
const precioBase=(l,pago)=>l.t==="R"&&pago==="EFECTIVO"?l.promo:l.venta;
function disponible(l){if(l.t==="S")return Infinity;if(l.t==="T"){const t=TBYC.get(l.c);return t?stockT(t,state.veh):0}
  const p=BYC.get(l.c);return p?stockDe(p,state.veh):0}

function abrirCobro(mod){
  if(necesitaVeh())return;
  if(mod==="T"&&!TV.includes(state.veh)){aviso("Este móvil no tiene tienda");return}
  const lines=(mod==="T"?TCART.map(lineaT):COT.items.map(lineaR)).filter(Boolean);
  if(!lines.length){aviso("No hay productos en la venta");return}
  COB={mod,pago:"EFECTIVO",lines,cli:mod==="R"?(COT.cliente||""):"",tel:""};
  COB.lines.forEach(l=>l.p=precioBase(l,COB.pago));
  pintarCobro();ver("vcob");
}
function pintarCobro(){
  const c=COB,ruta=rutaHoy();
  $("vcob").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="${c.mod==="T"?"vtnd":"app"}">← Volver</button>
    <h2 class="vtit">Registrar venta <span>${esc(MOD_NOM[c.mod])}</span></h2>
    <p class="vsub">${esc(title(state.veh))} · ${ruta?"Ruta "+esc(title(ruta)):'<b class="malo">Sin ruta: elígela en el menú</b>'} · ${hoy()}</p>
    <div class="bloque"><h3>Medio de pago</h3><div class="pagos">${PAGOS.map(p=>`<button type="button" class="pago" data-pago="${p}" aria-pressed="${c.pago===p}">${sc(p)}</button>`).join("")}</div>
      ${c.mod==="R"?'<p class="nota">En efectivo los repuestos salen con el 5% de descuento. Los servicios no tienen descuento.</p>':""}</div>
    <div class="cobl">${c.lines.map((l,i)=>`
      <div class="cobi" data-i="${i}">
        <div class="cobn"><b>${esc(l.d)}</b><small>${esc(l.c)}${l.t==="S"?" · servicio":""}</small><button type="button" class="quitar" data-cquitar="${i}">Quitar</button></div>
        <div class="cobrow">
          <div class="stepper"><button type="button" data-cqm="${i}" aria-label="Una menos">−</button><input type="text" inputmode="numeric" data-cq="${i}" value="${l.q}"><button type="button" data-cqp="${i}" aria-label="Una más">+</button></div>
          ${c.mod==="T"?`<div class="cprecio fijo"><span>Precio c/u</span><b>${money(l.p)}</b></div>`:`<label class="cprecio"><span>Precio c/u</span><input type="text" inputmode="numeric" data-cp="${i}" value="${l.p}"></label>`}
        </div>
        <div class="cobsub"><span data-cerr="${i}" class="cerr"></span><b data-csub="${i}"></b></div>
      </div>`).join("")}</div>
    ${c.mod==="T"?"":`<div class="bloque"><h3>Cliente <small>(opcional)</small></h3>
      <label class="campo"><span>Celular (10 dígitos)</span><input id="ctel" type="tel" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="3001234567" value="${esc(c.tel)}"></label>
      <label class="campo"><span>Nombre</span><input id="cnom" type="text" autocomplete="off" placeholder="Nombre del cliente" value="${esc(c.cli)}"></label>
      <p class="nota" id="ctelmsg">Con el celular se le envía el recibo por WhatsApp y queda en Clientes.</p></div>`}
    <div class="cobtot"><span>Total</span><b id="ctotal"></b></div>
    <button type="button" class="btn venta grande" id="cregistrar">Registrar venta</button>
  </div>`;
  refrescarCobro();
}
function refrescarCobro(){
  const c=COB;let tot=0,ok=true;
  c.lines.forEach((l,i)=>{
    const sub=l.q*l.p;tot+=sub;
    const s=document.querySelector(`[data-csub="${i}"]`);if(s)s.textContent=money(sub);
    const e=document.querySelector(`[data-cerr="${i}"]`);if(!e)return;
    let m="";
    if(!(l.p>0)){m="Escribe el precio";ok=false}
    else if(l.min>0&&l.p<Math.min(l.min,precioBase(l,c.pago))){m="No puede ser menor a "+money(Math.min(l.min,precioBase(l,c.pago)));ok=false}
    else{const d=disponible(l);if(l.q>d)m="⚠ "+(d>0?"Solo hay "+d+" en tu móvil":"No hay en tu móvil")+": queda marcado"}
    e.textContent=m;e.classList.toggle("bloquea",!!m&&!m.startsWith("⚠"));
    const inp=document.querySelector(`[data-cp="${i}"]`);if(inp&&document.activeElement!==inp)inp.value=l.p;
    const base=precioBase(l,c.pago);if(inp)inp.classList.toggle("neg",l.p!==base);
  });
  c.tot=tot;c.ok=ok;
  $("ctotal").textContent=money(tot);
  const b=$("cregistrar");b.textContent=ok?"Registrar venta · "+money(tot):"Revisa los precios";b.disabled=!ok;
}
function nuevoNumero(veh,f){
  const pre=vcod(veh)+"-"+f.slice(2,4)+f.slice(5,7)+f.slice(8,10)+"-";
  const n=RECS.filter(r=>r.n.startsWith(pre)).reduce((m,r)=>Math.max(m,parseInt(r.n.slice(pre.length),10)||0),0);
  return pre+String(n+1).padStart(3,"0");
}
function registrarVenta(){
  const c=COB;if(!c||!c.ok)return;
  const tel=c.mod==="T"?"":(c.tel||"").replace(/\D/g,"");
  if(tel&&tel.length!==10){aviso("El celular debe tener 10 dígitos");$("ctel").focus();return}
  const veh=state.veh,f=hoyISO();
  const rec={n:nuevoNumero(veh,f),f,h:horaAhora(),ts:Date.now(),veh,ruta:rutaHoy(),ases:(ls.get("motoya-asesor")||"").trim(),
    mod:c.mod,pago:c.pago,cli:c.mod==="T"?"":limpio(c.cli),tel,an:false,mot:"",cer:false,
    it:c.lines.map(l=>({c:l.c,d:l.d,t:l.t,q:l.q,p:l.p,promo:l.t==="R"&&c.pago==="EFECTIVO"?1:0,neg:l.p!==precioBase(l,c.pago)?1:0,sin:l.q>disponible(l)?1:0}))};
  rec.tot=rec.it.reduce((a,x)=>a+x.q*x.p,0);
  RECS.push(rec);guardarRecs();
  if(tel)anotarCliente(tel,rec.cli,rec);
  if(c.mod==="T"){TCART=[];guardarTCart()}else{COT.items=[];COT.cliente="";guardarCot();verCot=false;mostrarVista()}
  COB=null;ULTREC=rec.n;
  if(rec.mod==="T"){ver("vtnd",true);aviso("✓ Venta registrada: "+money(rec.tot),2500);return}
  pintarRecibo(rec);ver("vrec",true);
}

// ===== Clientes =====
function anotarCliente(tel,nom,rec){
  let c=CLIS.find(x=>x.tel===tel);
  if(!c){c={tel,nom:"",f1:rec.f,fu:rec.f,veh:rec.veh,n:0,tot:0,g:false,ult:""};CLIS.push(c)}
  if(nom)c.nom=nom;c.fu=rec.f;c.veh=rec.veh;c.n++;c.tot+=rec.tot;c.ult=rec.n;
  guardarClis();
}
function intentContacto(c){
  const nom=c.nom||("Cliente MOTO-YA "+c.tel.slice(-4));
  const nota="Cliente MOTO-YA desde "+fdm(c.f1)+" · "+title(c.veh||"");
  return "intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/contact;S.name="+encodeURIComponent(nom)+
         ";S.phone="+encodeURIComponent("+57"+c.tel)+";S.notes="+encodeURIComponent(nota)+";end";
}
function vcf(c){const nom=c.nom||("Cliente MOTO-YA "+c.tel.slice(-4));
  return ["BEGIN:VCARD","VERSION:3.0","FN:"+nom,"N:"+nom+";;;;","TEL;TYPE=CELL:+57"+c.tel,"NOTE:Cliente MOTO-YA desde "+fdm(c.f1),"END:VCARD"].join("\r\n")}
let CLITAB="p",CLIQ="";
function pintarClientes(){
  const q=norm(CLIQ);
  const lista=CLIS.filter(c=>(CLITAB==="t"||!c.g)&&(!q||norm(c.nom+" "+c.tel).includes(q))).sort((a,b)=>b.fu.localeCompare(a.fu));
  const np=CLIS.filter(c=>!c.g).length;
  $("vcli").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="home">← Menú</button>
    <h2 class="vtit">Clientes <span>${CLIS.length}</span></h2>
    <div class="tabs"><button type="button" data-clitab="p" aria-pressed="${CLITAB==="p"}">Por guardar (${np})</button><button type="button" data-clitab="t" aria-pressed="${CLITAB==="t"}">Todos</button></div>
    <div class="searchbox"><input id="cliq" type="search" placeholder="Buscar por nombre o celular" value="${esc(CLIQ)}" autocomplete="off"></div>
    ${CLITAB==="p"?'<p class="nota">Toca «Guardar en contactos»: se abre el contacto nuevo con el nombre y el número listos. Revisa y guarda.</p>':""}
    <div class="clil">${lista.length?lista.map(c=>{const i=CLIS.indexOf(c);return `
      <div class="clii">
        <div class="clih"><b>${esc(c.nom||"Sin nombre")}</b><span>${telFmt(c.tel)}</span></div>
        <div class="clim">${c.n} compra${c.n>1?"s":""} · ${money(c.tot)} · última ${fdm(c.fu)} (${esc(c.ult)})</div>
        <label class="campo mini"><span>Nombre</span><input type="text" data-clinom="${i}" value="${esc(c.nom)}" placeholder="Escribe el nombre" autocomplete="off"></label>
        <div class="clib">
          ${c.g?'<span class="ok">✓ Guardado</span>':`<a class="btn mini wa" href="${esc(intentContacto(c))}" data-cliint="${i}">Guardar en contactos</a>`}
          <a class="btn mini wa2" href="https://wa.me/57${c.tel}" target="_blank" rel="noopener">WhatsApp</a>
          ${c.g?`<button type="button" class="btn mini gris" data-clig="${i}" data-v="0">Marcar por guardar</button>`:`<button type="button" class="btn mini gris" data-clig="${i}" data-v="1">Ya lo guardé</button><button type="button" class="btn mini gris" data-clivcf="${i}">Descargar contacto</button>`}
        </div>
      </div>`}).join(""):'<div class="empty">'+(CLITAB==="p"?"No hay clientes por guardar. ✓":"Todavía no hay clientes.")+'</div>'}</div>
  </div>`;
}

// ===== Recibo =====
function pintarRecibo(r){
  $("vrec").innerHTML=`<div class="wrap vwrap">
    <div class="recok"><span>✓</span><div><b>Venta registrada</b><small>Recibo ${esc(r.n)}</small></div></div>
    <div class="bloque">
      <div class="prow"><span>Total</span><b class="grande">${money(r.tot)}</b></div>
      <div class="prow"><span>Medio de pago</span><b>${sc(r.pago)}</b></div>
      ${r.it.map(x=>`<div class="recl"><span>${x.q} × ${esc(x.d)}</span><b>${money(x.q*x.p)}</b></div>`).join("")}
      ${r.it.some(x=>x.sin)?'<p class="nota malo">⚠ Hay productos sin existencia en el sistema: quedan marcados para el conteo.</p>':""}
    </div>
    <div class="bloque"><h3>Enviar el recibo por WhatsApp</h3>
      ${r.tel?`<p class="nota">Cliente: <b>${esc(r.cli||"Sin nombre")}</b> · ${telFmt(r.tel)}</p>
        <a class="btn wa2 paso" href="https://wa.me/57${r.tel}" target="_blank" rel="noopener"><i>1</i>Abrir el chat del cliente</a>
        <button type="button" class="btn wa paso" data-recimg="${esc(r.n)}"><i>2</i>Enviar la imagen del recibo</button>
        <p class="nota">Primero abre el chat; luego, al enviar la imagen, el cliente aparece de primero en la lista de WhatsApp.</p>`
       :`<label class="campo"><span>Celular del cliente</span><input id="rtel" type="tel" inputmode="numeric" maxlength="10" placeholder="3001234567"></label>
        <label class="campo"><span>Nombre</span><input id="rnom" type="text" placeholder="Nombre del cliente" autocomplete="off"></label>
        <button type="button" class="btn gris" id="rtelok">Guardar celular</button>
        <button type="button" class="btn wa paso" data-recimg="${esc(r.n)}">Enviar la imagen del recibo</button>`}
    </div>
    <div class="acciones">
      <button type="button" class="btn venta" data-volver="${r.mod==="T"?"vtnd":"app"}">Nueva venta</button>
      <button type="button" class="btn gris" data-volver="home">Menú</button>
    </div>
  </div>`;
}
function dibujarRecibo(r){
  return lienzo((ctx,cv,draw)=>{
    const W=1080,M=60,H=cv.height;
    const txt=(s,x,y,font,col,al)=>{ctx.font=font;if(draw){ctx.fillStyle=col;ctx.textAlign=al||"left";ctx.fillText(s,x,y);ctx.textAlign="left"}};
    if(draw){
      ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
      ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(W,0);ctx.lineTo(W,120);ctx.bezierCurveTo(820,70,560,40,300,0);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(250,-8);ctx.bezierCurveTo(540,46,810,92,W+10,146);ctx.stroke();
    }
    const cx=M+120,cy=200,R=125,logo=document.querySelector("#home .logo img")||document.querySelector(".hero .logo img");
    if(draw){ctx.save();ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=24;ctx.shadowOffsetY=8;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fill();ctx.restore();
      ctx.strokeStyle=NAVY;ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,R-10,0,7);ctx.stroke();
      if(logo&&logo.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(cx,cy,R-14,0,7);ctx.clip();const lw=196,lh=lw*logo.naturalHeight/logo.naturalWidth;ctx.drawImage(logo,cx-lw/2,cy-lh/2,lw,lh);ctx.restore()}}
    const bx=cx+R+10;
    if(draw){ctx.fillStyle=NAVY;rr(ctx,bx,165,W-bx+40,112,18);ctx.fill();ctx.fillStyle=ORANGE;ctx.fillRect(bx+40,287,W-bx-40,10)}
    ctx.font=`700 86px ${FD}`;const w1=ctx.measureText("RECI").width;
    txt("RECI",bx+36,252,`700 86px ${FD}`,"#fff");txt("BO",bx+36+w1,252,`700 86px ${FD}`,ORANGE);
    txt("N° "+r.n,W-M,345,`700 32px ${F}`,NAVY,"right");
    txt(fdm(r.f)+" · "+r.h,W-M,385,`600 28px ${F}`,GRIS,"right");
    let y=410;
    const colW=(W-2*M-40)/2;
    const dato=(k,v,x,yy)=>{if(!v)return yy;txt(k,x,yy+34,`500 28px ${F}`,GRIS);ctx.font=`700 34px ${F}`;let z=yy+34;for(const l of lineas(ctx,v,colW)){z+=44;txt(l,x,z,`700 34px ${F}`,NAVY)}return z};
    const yA=dato("Cliente:",r.cli||(r.tel?telFmt(r.tel):""),M,y),yB=dato("Atendió:",[r.ases,title(r.veh)].filter(Boolean).join(" · "),M+colW+40,y);
    y=Math.max(yA,yB)+(Math.max(yA,yB)>y?36:0);
    const xC=640,xE=W-M-22,nameW=xC-60-(M+22);
    if(draw){ctx.fillStyle=NAVY;rr(ctx,M,y,W-2*M,64,14);ctx.fill()}
    txt("Producto / servicio",M+22,y+42,`700 26px ${F}`,"#fff");txt("Cant.",xC,y+42,`700 26px ${F}`,"#fff","center");txt("Valor",xE,y+42,`700 26px ${F}`,"#fff","right");
    y+=64;
    r.it.forEach((x,i)=>{
      ctx.font=`700 30px ${F}`;const nl=lineas(ctx,x.d,nameW);
      ctx.font=`500 24px ${F}`;const sl=lineas(ctx,`${x.c}${x.t==="S"?" · mano de obra":""} · c/u ${money(x.p)}`,nameW);
      const rh=22+nl.length*38+sl.length*32+18;
      if(draw){ctx.fillStyle=i%2?"#ffffff":"#eef2f8";ctx.fillRect(M,y,W-2*M,rh);ctx.fillStyle="#d5dceb";ctx.fillRect(M,y+rh-2,W-2*M,2)}
      let yy=y+22;for(const l of nl){yy+=32;txt(l,M+22,yy,`700 30px ${F}`,TINTA);yy+=6}
      for(const l of sl){yy+=30;txt(l,M+22,yy,`500 24px ${F}`,GRIS);yy+=2}
      const ym=y+22+38;
      txt(String(x.q),xC,ym,`700 34px ${F}`,TINTA,"center");
      txt(money(x.q*x.p),xE,ym,`700 32px ${F}`,NAVY,"right");
      y+=rh;
    });
    y+=36;
    if(draw){ctx.save();ctx.shadowColor="rgba(14,31,61,.35)";ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle=NAVY;rr(ctx,M,y,W-2*M,170,22);ctx.fill();ctx.restore()}
    txt("TOTAL PAGADO",M+36,y+62,`700 32px ${F}`,"#dbe8ff");
    txt("Medio de pago: "+sc(r.pago),M+36,y+120,`600 30px ${F}`,ORANGE);
    txt(money(r.tot),W-M-36,y+122,`700 84px ${F}`,"#fff","right");
    y+=170+30;
    if(r.it.some(x=>x.promo)){txt("Incluye 5% de descuento por pago en efectivo en repuestos.",M,y+30,`500 26px ${F}`,VERDE);y+=50}
    ctx.font=`400 26px ${F}`;for(const l of lineas(ctx,"Soporte de venta de MOTO-YA. Conserve este recibo para cambios y garantías.",W-2*M)){y+=36;txt(l,M,y,`400 26px ${F}`,GRIS)}
    y+=70;
    txt("¡Gracias por su compra!",W/2,y,`italic 700 44px ${F}`,NAVY,"center");
    y+=30;
    if(draw){ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(0,y+40);ctx.bezierCurveTo(320,y+110,700,y+20,W,y+60);ctx.lineTo(W,y+140);ctx.lineTo(0,y+140);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-10,y+22);ctx.bezierCurveTo(320,y+92,700,y+2,W+10,y+40);ctx.stroke()}
    return y+140;
  });
}
const recPorN=n=>RECS.find(r=>r.n===n);
function enviarRecibo(n){const r=recPorN(n);if(r)enviarImagen(()=>dibujarRecibo(r),"Recibo_"+r.n,"Recibo MOTO-YA "+r.n)}

// ===== Recibos del día =====
// ===== Ventas del día (lista) =====
// LISTMOD: null = todos los módulos (menú, con anulación) · "R"/"T" = solo ese módulo (encabezado, solo consulta)
let LISTF=null,ANULAR=null,LISTMOD=null,LISTRO=false,LISTBACK="home";
function abrirVentas(mod,ro,back){if(necesitaVeh())return;LISTF=null;ANULAR=null;LISTMOD=mod;LISTRO=ro;LISTBACK=back;pintarLista();ver("vlist")}
function pintarLista(){
  const veh=state.veh,f=LISTF||hoyISO(),deMod=r=>!LISTMOD||r.mod===LISTMOD;
  const fechas=[...new Set(RECS.filter(r=>r.veh===veh&&deMod(r)).map(r=>r.f).concat([hoyISO()]))].sort().reverse();
  const rs=RECS.filter(r=>r.veh===veh&&r.f===f&&deMod(r)).sort((a,b)=>b.ts-a.ts);
  const s=resumenDia(veh,f,LISTMOD);
  const tit=LISTMOD?"Ventas de hoy":"Recibos";
  $("vlist").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="${LISTBACK}">← ${LISTBACK==="home"?"Menú":"Volver"}</button>
    <h2 class="vtit">${tit} <span>${LISTMOD?esc(MOD_NOM[LISTMOD]):esc(title(veh))}</span></h2>
    ${LISTMOD?`<p class="vsub">${esc(title(veh))} · solo consulta</p>`:""}
    <label class="campo"><span>Día</span><select id="listf">${fechas.map(x=>`<option value="${x}"${x===f?" selected":""}>${fdm(x)}${x===hoyISO()?" (hoy)":""}</option>`).join("")}</select></label>
    <div class="bloque">
      <div class="prow"><span>${s.n} venta${s.n===1?"":"s"}${s.an?" · "+s.an+" anulada(s)":""}</span><b class="grande">${money(s.tot)}</b></div>
      ${LISTMOD==="R"?`<div class="prow"><span>Repuestos</span><b>${money(s.R)}</b></div><div class="prow"><span>Servicios</span><b>${money(s.S)}</b></div>`:""}
      ${!LISTMOD?`<div class="prow"><span>Repuestos y servicios</span><b>${money(s.R+s.S)}</b></div><div class="prow"><span>Tienda</span><b>${money(s.T)}</b></div>`:""}
      ${PAGOS.map(p=>`<div class="prow"><span>${sc(p)}</span><b>${money(s.pago[p]||0)}</b></div>`).join("")}
    </div>
    <div class="recs">${rs.length?rs.map(r=>`
      <div class="reci${r.an?" anul":""}">
        <div class="rech"><b>${esc(r.n)}</b><span>${r.h} · ${sc(r.pago)}</span><b>${money(r.tot)}</b></div>
        ${!LISTMOD||r.cli||r.tel?`<div class="recm">${!LISTMOD?(r.mod==="T"?"Tienda":"Repuestos/servicios"):""}${r.cli||r.tel?(!LISTMOD?" · ":"")+esc(r.cli||"")+" "+telFmt(r.tel):""}</div>`:""}
        <div class="recm">${r.it.map(x=>x.q+"× "+esc(x.d)).join(" · ")}</div>
        ${r.an?`<div class="malo">ANULADO: ${esc(r.mot)}</div>`:(LISTRO?"":`
        <div class="clib">${r.mod==="T"?"":`<button type="button" class="btn mini wa" data-recimg="${esc(r.n)}">Enviar imagen</button>`}
          ${r.cer?'<span class="nota">Ya salió en el cierre</span>':`<button type="button" class="btn mini rojo" data-anular="${esc(r.n)}">Anular</button>`}</div>
        ${ANULAR===r.n?`<div class="anubox"><label class="campo mini"><span>Motivo de la anulación</span><input id="anumot" type="text" placeholder="Ej. el cliente se arrepintió" autocomplete="off"></label>
          <button type="button" class="btn mini rojo" data-anularok="${esc(r.n)}">Confirmar anulación</button><button type="button" class="btn mini gris" data-anularno>Cancelar</button></div>`:""}`)}
      </div>`).join(""):'<div class="empty">No hay ventas este día.</div>'}</div>
  </div>`;
}

// ===== Cierre del día (uno por módulo) =====
let CIEF=null,CIEMOD="R",CIEBACK="home",CIEPEND=null;
const modsDe=veh=>TV.includes(veh)?["R","T"]:["R"];
const claveCie=(veh,f,mod)=>veh+"|"+f+"|"+mod;
function resumenDia(veh,f,mod){
  const rs=RECS.filter(r=>r.veh===veh&&r.f===f&&(!mod||r.mod===mod)),ok=rs.filter(r=>!r.an);
  const s={rs,ok,n:ok.length,an:rs.length-ok.length,R:0,S:0,T:0,pago:{EFECTIVO:0,NEQUI:0,DAVIPLATA:0},sin:0,tot:0};
  ok.forEach(r=>{r.it.forEach(x=>{s[x.t]+=x.q*x.p;if(x.sin)s.sin++});s.pago[r.pago]=(s.pago[r.pago]||0)+r.tot;s.tot+=r.tot});
  return s;
}
// Menú › Cierre del día: elegir el módulo
function pintarSelCierre(){
  const veh=state.veh,hoy=hoyISO();
  $("vsel").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="home">← Menú</button>
    <h2 class="vtit">Cierre del día <span>${esc(title(veh))}</span></h2>
    <p class="vsub">Cada módulo se cierra por separado, con su propia entrega de efectivo.</p>
    ${modsDe(veh).map(m=>{const s=resumenDia(veh,hoy,m),p=pendientesCierre(veh,m).filter(x=>x<hoy),c=CIES[claveCie(veh,hoy,m)];
      const sinCerrar=s.rs.some(r=>!r.cer);
      return `<div class="bloque selcie">
        <h3>${esc(MOD_NOM[m])}</h3>
        <div class="prow"><span>Hoy: ${s.n} venta${s.n===1?"":"s"}</span><b>${money(s.tot)}</b></div>
        ${p.length?`<p class="nota malo">⚠ Falta el cierre del ${p.map(fdm).join(", ")}</p>`:""}
        ${c&&c.fin&&!sinCerrar?`<p class="nota bien">✓ Cierre de hoy enviado a las ${c.hora}</p>`:""}
        <button type="button" class="btn venta" data-abrircie="${m}">Hacer cierre de ${m==="T"?"la tienda":"repuestos y servicios"}</button>
      </div>`}).join("")}
  </div>`;
}
function abrirCierre(mod,back){if(necesitaVeh())return;if(mod==="T"&&!TV.includes(state.veh)){aviso("Este móvil no tiene tienda");return}
  CIEF=null;CIEMOD=mod;CIEBACK=back;CIEPEND=null;pintarCierre();ver("vcie")}
function pintarCierre(){
  const veh=state.veh,mod=CIEMOD,pend=pendientesCierre(veh,mod),f=CIEF||(pend.find(x=>x<hoyISO())||hoyISO());
  const fechas=[...new Set(pend.concat([hoyISO(),f]))].sort();
  const s=resumenDia(veh,f,mod),prev=CIES[claveCie(veh,f,mod)];
  const sinCerrar=s.rs.filter(r=>!r.cer).length;
  $("vcie").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="${CIEBACK}">← ${CIEBACK==="home"?"Menú":"Volver"}</button>
    <h2 class="vtit">Cierre <span>${esc(MOD_NOM[mod])}</span></h2>
    <p class="vsub">${esc(title(veh))}</p>
    <label class="campo"><span>Día</span><select id="cief">${fechas.map(x=>`<option value="${x}"${x===f?" selected":""}>${fdm(x)}${x===hoyISO()?" (hoy)":(pend.includes(x)?" · pendiente":"")}</option>`).join("")}</select></label>
    ${prev&&prev.fin?`<p class="nota ${sinCerrar?"malo":"bien"}">${sinCerrar?"⚠ Ya se envió un cierre de este día, pero hay "+sinCerrar+" venta(s) nuevas: vuelve a enviarlo.":"✓ Cierre enviado el "+fdm(prev.fecha)+" a las "+prev.hora+". Puedes reenviarlo si hace falta."}</p>`:""}
    <div class="bloque">
      <h3>Ventas del día</h3>
      <div class="prow"><span>Ventas</span><b>${s.n}${s.an?" (+"+s.an+" anuladas)":""}</b></div>
      ${mod==="R"?`<div class="prow"><span>Repuestos</span><b>${money(s.R)}</b></div><div class="prow"><span>Servicios</span><b>${money(s.S)}</b></div>`:""}
      ${PAGOS.map(p=>`<div class="prow"><span>${sc(p)}</span><b>${money(s.pago[p]||0)}</b></div>`).join("")}
      <div class="tbox tr"><span>Total vendido</span><b>${money(s.tot)}</b></div>
      ${s.sin?`<p class="nota malo">⚠ ${s.sin} línea(s) vendidas sin existencia en el sistema: revísalas en el conteo.</p>`:""}
    </div>
    <div class="bloque">
      <h3>Entrega de efectivo</h3>
      <label class="campo"><span>Efectivo que entrego ($)</span><input id="cieef" type="text" inputmode="numeric" placeholder="${Math.round(s.pago.EFECTIVO||0)}" value="${prev&&prev.ef!=null?prev.ef:""}"></label>
      <p class="nota" id="ciedif"></p>
      <label class="campo"><span>Observaciones</span><input id="cieobs" type="text" placeholder="${mod==="T"?"Ej. compré hielo con la caja":"Ej. pagué parqueadero con la caja"}" value="${esc(prev?prev.obs||"":"")}" autocomplete="off"></label>
      <p class="nota">${mod==="T"?"Si compraste mercancía de tienda con la caja, queda en la hoja TIENDA del SAM y el arqueo de la tienda la descuenta.":"Si pagaste gastos con la caja, regístralos en el SAM (GASTOS, «sale de la caja: SI»); el arqueo los descuenta."}</p>
    </div>
    <button type="button" class="btn venta grande" id="cieenv" ${s.rs.length?"":"disabled"}>Enviar cierre (imagen + archivo)</button>
    ${CIEPEND?`<div class="bloque paso2"><h3>Si no llegaron los dos, envíalos por separado</h3>
      <button type="button" class="btn wa paso" id="ciepimg"><i>1</i>Enviar la imagen del cierre</button>
      <button type="button" class="btn wa2 paso" id="ciepfile"><i>2</i>Enviar el archivo para el SAM</button></div>`:""}
    <button type="button" class="btn gris" id="cieresp" ${s.rs.length?"":"disabled"}>Enviar respaldo (sin cerrar el día)</button>
    <p class="nota">En WhatsApp elige el chat del administrador. La imagen es para leer; el archivo se carga en el SAM con «Importar cierres».</p>
  </div>`;
  difCierre();
}
function difCierre(){const s=resumenDia(state.veh,$("cief").value,CIEMOD),v=$("cieef").value.replace(/\D/g,"");
  const el=$("ciedif");if(!v){el.textContent="Efectivo de ventas: "+money(s.pago.EFECTIVO||0);el.className="nota";return}
  const d=+v-(s.pago.EFECTIVO||0);el.textContent=d===0?"✓ Cuadra con el efectivo vendido":(d<0?"Faltan "+money(-d):"Sobran "+money(d))+" frente al efectivo vendido ("+money(s.pago.EFECTIVO||0)+")";
  el.className="nota "+(d===0?"bien":"malo")}
function archivoCierre(veh,f,mod,fin,ef,obs){
  const s=resumenDia(veh,f,mod),L=["MOTOYA-CIERRE;1"],now=new Date();
  L.push(["CIERRE",veh,f,limpio(rutaHoy()),limpio(ls.get("motoya-asesor")||""),fin?1:0,ef===""?"":ef,limpio(obs),iso(now)+" "+horaAhora(),APP_VERSION,mod].join(";"));
  const tels=new Set();
  s.rs.forEach(r=>{
    L.push(["R",r.n,r.f,r.h,r.veh,limpio(r.ruta),r.pago,limpio(r.cli),r.tel||"",r.an?1:0,limpio(r.mot),limpio(r.ases),r.mod].join(";"));
    r.it.forEach(x=>L.push(["L",r.n,x.t,x.c,limpio(x.d),x.q,x.p,x.promo,x.neg,x.sin].join(";")));
    if(r.tel&&!r.an)tels.add(r.tel);
  });
  CLIS.filter(c=>tels.has(c.tel)).forEach(c=>L.push(["C",c.tel,limpio(c.nom),c.f1,c.fu,c.veh].join(";")));
  return L.join("\r\n")+"\r\n";
}
function fotoCierre(veh,f,mod,ef,obs,fin){
  const s=resumenDia(veh,f,mod);
  return{veh,f,mod,fin,fecha:hoyISO(),hora:horaAhora(),ef:ef===""?null:+ef,obs:limpio(obs),ases:(ls.get("motoya-asesor")||"").trim(),ruta:rutaHoy(),
    n:s.n,an:s.an,tot:s.tot,R:s.R,S:s.S,T:s.T,pago:{...s.pago},sin:s.sin,dif:ef===""?null:(+ef-(s.pago.EFECTIVO||0))};
}
async function compartir(files,titulo){
  try{if(navigator.canShare&&navigator.canShare({files})){await navigator.share({files,title:titulo});return"ok"}}
  catch(e){return e&&e.name==="AbortError"?"cancelado":"error"}
  return"no";
}
function descargar(file){const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove()}
async function archivosCierre(fin){
  const veh=state.veh,f=$("cief").value,ef=$("cieef").value.replace(/\D/g,""),obs=$("cieobs").value,mod=CIEMOD;
  const base=`CIERRE_${vcod(veh)}_${mod==="T"?"TIENDA":"REPUESTOS"}_${f}${fin?"":"_respaldo"}`;
  const txt=new File([archivoCierre(veh,f,mod,fin,ef,obs)],base+".txt",{type:"text/plain"});
  const snap=fotoCierre(veh,f,mod,ef,obs,fin);
  const blob=await new Promise(ok=>dibujarCierre(snap).toBlob(ok,"image/png"));
  const png=new File([blob],base+".png",{type:"image/png"});
  return{veh,f,mod,ef,obs,txt,png,snap};
}
function marcarCerrado(a){
  RECS.forEach(r=>{if(r.veh===a.veh&&r.f===a.f&&r.mod===a.mod)r.cer=true});guardarRecs();
  CIES[claveCie(a.veh,a.f,a.mod)]=a.snap;guardarCies();
}
let CIEARCH=null;
async function enviarCierre(fin){
  const ef=$("cieef").value.replace(/\D/g,"");
  if(fin&&ef===""){aviso("Escribe el efectivo que entregas (0 si no hay)",3500);$("cieef").focus();return}
  const a=await archivosCierre(fin);
  if(!fin){const r=await compartir([a.txt],a.txt.name);if(r==="no"||r==="error"){descargar(a.txt);aviso("Respaldo descargado: envíalo por WhatsApp",4000)}else if(r==="ok")aviso("Respaldo enviado");return}
  CIEARCH=a;
  const r=await compartir([a.png,a.txt],a.txt.name);
  if(r==="cancelado"){aviso("No se envió");return}
  marcarCerrado(a);CIEF=a.f;
  CIEPEND=true;                         // siempre se ofrece el envío por separado por si WhatsApp no tomó los dos
  if(r!=="ok"){aviso("Envíalos por separado con los botones 1 y 2",4500)}else aviso("Cierre enviado ✓",3000);
  pintarCierre();
}
async function enviarParte(cual){
  let a=CIEARCH;if(!a){a=await archivosCierre(true);marcarCerrado(a);CIEARCH=a}
  const file=cual==="img"?a.png:a.txt,r=await compartir([file],file.name);
  if(r==="no"||r==="error"){descargar(file);aviso("Archivo descargado: envíalo por WhatsApp",4000)}
}

// ===== Imágenes del cierre y del mes =====
function tarjeta(o){
  // o: {t1,t2,lineas:[der], datos:[[k,v,clase]], total:[k,v], tabla:{cab:[],filas:[[...]]}, pie}
  return lienzo((ctx,cv,draw)=>{
    const W=1080,M=60,H=cv.height;
    const txt=(s,x,y,font,col,al)=>{ctx.font=font;if(draw){ctx.fillStyle=col;ctx.textAlign=al||"left";ctx.fillText(s,x,y);ctx.textAlign="left"}};
    if(draw){ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
      ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(W,0);ctx.lineTo(W,120);ctx.bezierCurveTo(820,70,560,40,300,0);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(250,-8);ctx.bezierCurveTo(540,46,810,92,W+10,146);ctx.stroke()}
    const cx=M+120,cy=200,R=125,logo=document.querySelector("#home .logo img")||document.querySelector(".hero .logo img");
    if(draw){ctx.save();ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=24;ctx.shadowOffsetY=8;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fill();ctx.restore();
      ctx.strokeStyle=NAVY;ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,R-10,0,7);ctx.stroke();
      if(logo&&logo.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(cx,cy,R-14,0,7);ctx.clip();const lw=196,lh=lw*logo.naturalHeight/logo.naturalWidth;ctx.drawImage(logo,cx-lw/2,cy-lh/2,lw,lh);ctx.restore()}}
    const bx=cx+R+10;
    if(draw){ctx.fillStyle=NAVY;rr(ctx,bx,165,W-bx+40,112,18);ctx.fill();ctx.fillStyle=ORANGE;ctx.fillRect(bx+40,287,W-bx-40,10)}
    ctx.font=`700 80px ${FD}`;const w1=ctx.measureText(o.t1).width;
    txt(o.t1,bx+36,250,`700 80px ${FD}`,"#fff");txt(o.t2,bx+36+w1,250,`700 80px ${FD}`,ORANGE);
    let y=345;
    o.lineas.forEach((l,i)=>{txt(l,W-M,y,i?`600 28px ${F}`:`700 32px ${F}`,i?GRIS:NAVY,"right");y+=40});
    y+=10;
    (o.datos||[]).forEach(([k,v,cl],i)=>{
      if(draw&&i%2===0){ctx.fillStyle="#eef2f8";ctx.fillRect(M,y,W-2*M,62)}
      txt(k,M+22,y+42,`600 30px ${F}`,TINTA);txt(v,W-M-22,y+42,`700 32px ${F}`,cl==="malo"?"#c0392b":cl==="bien"?VERDE:NAVY,"right");y+=62});
    if(o.total){y+=26;
      if(draw){ctx.save();ctx.shadowColor="rgba(14,31,61,.35)";ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle=NAVY;rr(ctx,M,y,W-2*M,150,22);ctx.fill();ctx.restore()}
      txt(o.total[0],M+36,y+88,`700 32px ${F}`,"#dbe8ff");txt(o.total[1],W-M-36,y+102,`700 76px ${F}`,"#fff","right");y+=150+20}
    if(o.tabla&&o.tabla.filas.length){y+=16;const cols=o.tabla.cab.length,xs=[M+22];for(let i=1;i<cols;i++)xs.push(M+22+(W-2*M-44)*(i/(cols-1)));
      if(draw){ctx.fillStyle=NAVY;rr(ctx,M,y,W-2*M,58,14);ctx.fill()}
      o.tabla.cab.forEach((c,i)=>txt(c,i?xs[i]:xs[0],y+38,`700 24px ${F}`,"#fff",i?"right":"left"));y+=58;
      o.tabla.filas.forEach((f,j)=>{if(draw){ctx.fillStyle=j%2?"#fff":"#eef2f8";ctx.fillRect(M,y,W-2*M,50)}
        f.forEach((c,i)=>txt(String(c),i?xs[i]:xs[0],y+34,`600 24px ${F}`,TINTA,i?"right":"left"));y+=50});}
    if(o.pie){ctx.font=`400 26px ${F}`;for(const l of lineas(ctx,o.pie,W-2*M)){y+=40;txt(l,M,y,`400 26px ${F}`,GRIS)}}
    y+=40;
    if(draw){ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(0,y+40);ctx.bezierCurveTo(320,y+110,700,y+20,W,y+60);ctx.lineTo(W,y+140);ctx.lineTo(0,y+140);ctx.fill();
      ctx.strokeStyle=ORANGE;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-10,y+22);ctx.bezierCurveTo(320,y+92,700,y+2,W+10,y+40);ctx.stroke()}
    return y+140;
  });
}
function dibujarCierre(c){
  const datos=[["Ventas",String(c.n)+(c.an?` (+${c.an} anuladas)`:"")]];
  if(c.mod==="R"){datos.push(["Repuestos",money(c.R)],["Servicios",money(c.S)])}
  PAGOS.forEach(p=>datos.push([sc(p),money(c.pago[p]||0)]));
  datos.push(["Efectivo entregado",c.ef==null?"—":money(c.ef)]);
  if(c.dif!=null)datos.push(["Diferencia",c.dif===0?"Cuadra":(c.dif<0?"Faltan ":"Sobran ")+money(Math.abs(c.dif)),c.dif===0?"bien":"malo"]);
  return tarjeta({t1:"CIE",t2:"RRE",lineas:[MOD_NOM[c.mod]+" · "+title(c.veh),"Día "+fdm(c.f)+(c.ases?" · "+c.ases:""),"Enviado "+fdm(c.fecha)+" "+c.hora],
    datos,total:["TOTAL VENDIDO",money(c.tot)],pie:(c.sin?`⚠ ${c.sin} línea(s) vendidas sin existencia en el sistema. `:"")+(c.obs?"Observaciones: "+c.obs:"")});
}
function cierresDelMes(veh,mod,mes){return Object.values(CIES).filter(c=>c&&c.fin&&c.mod===mod&&c.veh===veh&&c.f&&c.f.slice(0,7)===mes).sort((a,b)=>a.f.localeCompare(b.f))}
function totalesMes(l){const t={dias:l.length,tot:0,ef:0,ent:0,dif:0,pago:{EFECTIVO:0,NEQUI:0,DAVIPLATA:0}};
  l.forEach(c=>{t.tot+=c.tot;t.ef+=c.pago.EFECTIVO||0;t.ent+=c.ef||0;t.dif+=c.dif||0;PAGOS.forEach(p=>t.pago[p]+=c.pago[p]||0)});return t}
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const nomMes=m=>MESES[+m.slice(5,7)-1]+" "+m.slice(0,4);
const difTxt=d=>d==null?"—":(d===0?"0":(d<0?"-":"+")+money(Math.abs(d)));
function dibujarMes(veh,mod,mes){
  const l=cierresDelMes(veh,mod,mes),t=totalesMes(l);
  return tarjeta({t1:"MES ",t2:MESES[+mes.slice(5,7)-1].slice(0,3).toUpperCase(),lineas:[MOD_NOM[mod]+" · "+title(veh),"Resumen de "+nomMes(mes),"Generado "+hoy()],
    datos:[["Días cerrados",String(t.dias)],...PAGOS.map(p=>[sc(p),money(t.pago[p])]),["Efectivo entregado",money(t.ent)],
      ["Diferencia acumulada",t.dif===0?"Cuadra":(t.dif<0?"Faltan ":"Sobran ")+money(Math.abs(t.dif)),t.dif===0?"bien":"malo"]],
    total:["TOTAL VENDIDO EN EL MES",money(t.tot)],
    tabla:{cab:["Día","Vendido","Efectivo","Entregado","Dif."],filas:l.map(c=>[fdm(c.f).slice(0,5),money(c.tot),money(c.pago.EFECTIVO||0),c.ef==null?"—":money(c.ef),difTxt(c.dif)])},
    pie:"Resumen informativo de MOTO-YA app. El cierre oficial del mes está en el SAM (RESUMEN_CIERRES)."});
}

// ===== Historial de cierres =====
let HISMES=null;
function pintarHistorial(){
  const veh=state.veh,meses=[...new Set(Object.values(CIES).filter(c=>c&&c.fin&&c.veh===veh&&c.f).map(c=>c.f.slice(0,7)).concat([hoyISO().slice(0,7)]))].sort().reverse();
  const mes=HISMES&&meses.includes(HISMES)?HISMES:meses[0];
  $("vhis").innerHTML=`<div class="wrap vwrap">
    <button type="button" class="volver" data-volver="home">← Menú</button>
    <h2 class="vtit">Historial <span>${esc(title(veh))}</span></h2>
    <label class="campo"><span>Mes</span><select id="hismes">${meses.map(m=>`<option value="${m}"${m===mes?" selected":""}>${nomMes(m)}</option>`).join("")}</select></label>
    ${modsDe(veh).map(mod=>{const l=cierresDelMes(veh,mod,mes),t=totalesMes(l);return `
      <div class="bloque">
        <h3>${esc(MOD_NOM[mod])}</h3>
        <div class="prow"><span>Días cerrados</span><b>${t.dias}</b></div>
        <div class="prow"><span>Total vendido</span><b>${money(t.tot)}</b></div>
        <div class="prow"><span>Efectivo vendido</span><b>${money(t.ef)}</b></div>
        <div class="prow"><span>Efectivo entregado</span><b>${money(t.ent)}</b></div>
        <div class="prow"><span>Diferencia acumulada</span><b class="${t.dif===0?"bien":"malo"}">${t.dif===0?"Cuadra":(t.dif<0?"Faltan ":"Sobran ")+money(Math.abs(t.dif))}</b></div>
        ${l.length?`<div class="hisl">${l.map(c=>`<div class="hisi"><span>${fdm(c.f)}</span><span>${money(c.tot)}</span><span class="${c.dif?"malo":"bien"}">${c.dif===0?"✓":difTxt(c.dif)}</span>
            <button type="button" class="btn mini gris" data-hisimg="${esc(claveCie(c.veh,c.f,c.mod))}">Imagen</button></div>`).join("")}</div>
          <button type="button" class="btn wa" data-hismesimg="${mod}">Enviar resumen del mes (imagen)</button>`:'<p class="nota">No hay cierres enviados este mes.</p>'}
      </div>`}).join("")}
    <p class="nota">Aquí quedan los cierres enviados desde este celular. El cierre oficial del mes está en el SAM.</p>
  </div>`;
}

// ===== Eventos =====
function conectarVentas(){
  $("hveh").addEventListener("change",e=>{if(e.target.value)elegirVeh(e.target.value);pintarHome()});
  $("hruta").addEventListener("change",e=>{jset(VST.ruta,{f:hoyISO(),r:e.target.value});pintarHome()});
  $("hases").addEventListener("input",e=>{ls.set("motoya-asesor",e.target.value);COT.asesor=e.target.value;guardarCot()});
  $("goRep").addEventListener("click",()=>{if(!VEH.includes(state.veh)&&state.veh!=="BODEGA"){if(necesitaVeh())return}ver("app")});
  $("goTnd").addEventListener("click",()=>{if(necesitaVeh())return;ver("vtnd")});
  $("goRec").addEventListener("click",()=>abrirVentas(null,false,"home"));
  $("goHis").addEventListener("click",()=>{if(necesitaVeh())return;HISMES=null;pintarHistorial();ver("vhis")});
  $("rVentas").addEventListener("click",()=>abrirVentas("R",true,"app"));
  $("rCierre").addEventListener("click",()=>abrirCierre("R","app"));
  $("tVentas").addEventListener("click",()=>abrirVentas("T",true,"vtnd"));
  $("tCierre").addEventListener("click",()=>abrirCierre("T","vtnd"));
  $("vsel").addEventListener("click",e=>{const b=e.target.closest("[data-abrircie]");if(b)abrirCierre(b.dataset.abrircie,"vsel")});
  const vh=$("vhis");
  vh.addEventListener("change",e=>{if(e.target.id==="hismes"){HISMES=e.target.value;pintarHistorial()}});
  vh.addEventListener("click",e=>{let b=e.target.closest("[data-hisimg]");if(b){const c=CIES[b.dataset.hisimg];if(c)enviarImagen(()=>dibujarCierre(c),"Cierre_"+vcod(c.veh)+"_"+c.mod+"_"+c.f,"Cierre MOTO-YA");return}
    b=e.target.closest("[data-hismesimg]");if(b){const mes=$("hismes").value,mod=b.dataset.hismesimg;enviarImagen(()=>dibujarMes(state.veh,mod,mes),"Mes_"+vcod(state.veh)+"_"+mod+"_"+mes,"Resumen del mes MOTO-YA")}});
  $("goCli").addEventListener("click",()=>{CLITAB=CLIS.some(c=>!c.g)?"p":"t";pintarClientes();ver("vcli")});
  $("goCie").addEventListener("click",()=>{if(necesitaVeh())return;pintarSelCierre();ver("vsel")});
  $("hpend").addEventListener("click",e=>{if(e.target.closest("#hpendBtn")){pintarSelCierre();ver("vsel")}});
  $("toMenu").addEventListener("click",()=>ver("home"));
  $("ttoMenu").addEventListener("click",()=>ver("home"));

  // Volver (cualquier pantalla)
  document.addEventListener("click",e=>{const v=e.target.closest("[data-volver]");if(v){ver(v.dataset.volver);return}
    const im=e.target.closest("[data-recimg]");if(im){enviarRecibo(im.dataset.recimg)}});

  // Catálogo: chips de repuestos del servicio
  $("list").addEventListener("click",e=>{const b=e.target.closest("[data-famsrv]");if(!b)return;state.fam=b.dataset.famsrv;state.brand=state.model=null;state.q="";$("q").value="";render();window.scrollTo(0,0)},true);

  // Tienda
  $("tq").addEventListener("input",e=>{TQ=e.target.value;pintarTienda()});
  $("tcats").addEventListener("click",e=>{const b=e.target.closest("[data-tcat]");if(!b)return;TCAT=TCAT===b.dataset.tcat?null:b.dataset.tcat;pintarTienda()});
  $("tlist").addEventListener("click",e=>{const b=e.target.closest("[data-tadd]");if(!b)return;const c=b.dataset.tadd,x=TCART.find(y=>y.c===c);
    if(x)x.q++;else TCART.push({c,q:1});guardarTCart();pintarTienda();if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){} });
  $("tbarVer").addEventListener("click",()=>abrirCobro("T"));
  $("tbarVaciar").addEventListener("click",e=>{const b=e.currentTarget;if(!b.dataset.ok){b.dataset.ok="1";b.textContent="¿Vaciar?";setTimeout(()=>{delete b.dataset.ok;b.textContent="Vaciar"},3000);return}
    delete b.dataset.ok;b.textContent="Vaciar";TCART=[];guardarTCart();pintarTienda()});

  // Cobro
  const vc=$("vcob");
  vc.addEventListener("click",e=>{if(!COB)return;const g=a=>{const el=e.target.closest(`[${a}]`);return el?el.getAttribute(a):null};let v;
    if((v=g("data-pago"))!==null){COB.pago=v;COB.lines.forEach(l=>{if(!l.ed)l.p=precioBase(l,v)});
      vc.querySelectorAll("[data-pago]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pago===v));refrescarCobro();return}
    if((v=g("data-cqm"))!==null){const l=COB.lines[+v];l.q=Math.max(1,l.q-1);vc.querySelector(`[data-cq="${v}"]`).value=l.q;sincCarro();refrescarCobro();return}
    if((v=g("data-cqp"))!==null){const l=COB.lines[+v];l.q=Math.min(999,l.q+1);vc.querySelector(`[data-cq="${v}"]`).value=l.q;sincCarro();refrescarCobro();return}
    if((v=g("data-cquitar"))!==null){COB.lines.splice(+v,1);sincCarro();if(!COB.lines.length){ver(COB.mod==="T"?"vtnd":"app");COB=null;return}pintarCobro();return}
    if(e.target.closest("#cregistrar"))registrarVenta();
  });
  vc.addEventListener("input",e=>{if(!COB)return;const t=e.target;
    if(t.dataset.cq!==undefined){const v=parseInt(t.value.replace(/\D/g,""),10);if(v>0){COB.lines[+t.dataset.cq].q=Math.min(999,v);sincCarro();refrescarCobro()}return}
    if(t.dataset.cp!==undefined){const l=COB.lines[+t.dataset.cp],v=parseInt(t.value.replace(/\D/g,""),10)||0;l.p=v;l.ed=true;refrescarCobro();return}
    if(t.id==="ctel"){t.value=t.value.replace(/\D/g,"").slice(0,10);COB.tel=t.value;
      if(t.value.length===10){const c=CLIS.find(x=>x.tel===t.value);if(c&&c.nom&&!$("cnom").value){$("cnom").value=c.nom;COB.cli=c.nom}
        $("ctelmsg").textContent=c?"Cliente conocido: "+c.n+" compra(s), última el "+fdm(c.fu)+".":"Cliente nuevo: quedará en Clientes para guardarlo."}
      else $("ctelmsg").textContent="Con el celular se le envía el recibo por WhatsApp y queda en Clientes.";return}
    if(t.id==="cnom")COB.cli=t.value;
  });
  vc.addEventListener("focusin",e=>{if(e.target.matches("[data-cq],[data-cp]"))e.target.select()});
  vc.addEventListener("change",e=>{const t=e.target;if(t.dataset.cp!==undefined&&COB){const l=COB.lines[+t.dataset.cp];t.value=l.p;refrescarCobro()}});

  // Recibo recién hecho: agregar celular después
  $("vrec").addEventListener("click",e=>{if(!e.target.closest("#rtelok"))return;const r=recPorN(ULTREC);if(!r)return;
    const tel=$("rtel").value.replace(/\D/g,"");if(tel.length!==10){aviso("El celular debe tener 10 dígitos");return}
    r.tel=tel;r.cli=limpio($("rnom").value)||r.cli;guardarRecs();anotarCliente(tel,r.cli,r);pintarRecibo(r)});

  // Lista de recibos
  const vl=$("vlist");
  vl.addEventListener("change",e=>{if(e.target.id==="listf"){LISTF=e.target.value;ANULAR=null;pintarLista()}});
  vl.addEventListener("click",e=>{const g=a=>{const el=e.target.closest(`[${a}]`);return el?el.getAttribute(a):null};let v;
    if((v=g("data-anular"))!==null){ANULAR=v;pintarLista();setTimeout(()=>$("anumot")&&$("anumot").focus(),50);return}
    if(g("data-anularno")!==null){ANULAR=null;pintarLista();return}
    if((v=g("data-anularok"))!==null){const m=limpio($("anumot").value);if(!m){aviso("Escribe el motivo");return}
      const r=recPorN(v);if(r&&!r.cer){r.an=true;r.mot=m;guardarRecs();
        if(r.tel){const c=CLIS.find(x=>x.tel===r.tel);if(c){c.n=Math.max(0,c.n-1);c.tot=Math.max(0,c.tot-r.tot);guardarClis()}}
        aviso("Recibo "+v+" anulado")}
      ANULAR=null;pintarLista()}
  });

  // Clientes
  const vcl=$("vcli");
  vcl.addEventListener("click",e=>{const g=a=>{const el=e.target.closest(`[${a}]`);return el?el.getAttribute(a):null};let v;
    if((v=g("data-clitab"))!==null){CLITAB=v;pintarClientes();return}
    if((v=g("data-clig"))!==null){const c=CLIS[+v];c.g=e.target.closest("[data-clig]").dataset.v==="1";guardarClis();pintarClientes();aviso(c.g?"Marcado como guardado":"Marcado por guardar");return}
    if((v=g("data-clivcf"))!==null){const c=CLIS[+v],b=new Blob([vcf(c)],{type:"text/vcard"}),a=document.createElement("a");
      a.href=URL.createObjectURL(b);a.download=(c.nom||"cliente_"+c.tel).replace(/[^\wÁÉÍÓÚÑáéíóúñ ]+/g,"")+".vcf";document.body.appendChild(a);a.click();a.remove();
      aviso("Abre el archivo descargado para guardar el contacto",4000);return}
    if((v=g("data-cliint"))!==null){setTimeout(()=>{aviso("Cuando lo guardes, toca «Ya lo guardé»",4000)},800)}
  });
  vcl.addEventListener("input",e=>{const t=e.target;
    if(t.id==="cliq"){CLIQ=t.value;const pos=t.selectionStart;pintarClientes();const n=$("cliq");n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}return}
    if(t.dataset.clinom!==undefined){const c=CLIS[+t.dataset.clinom];c.nom=limpio(t.value);guardarClis();
      const a=t.closest(".clii").querySelector("[data-cliint]");if(a)a.href=intentContacto(c);const h=t.closest(".clii").querySelector(".clih b");if(h)h.textContent=c.nom||"Sin nombre"}
  });

  // Cierre
  const vci=$("vcie");
  vci.addEventListener("change",e=>{if(e.target.id==="cief"){CIEF=e.target.value;CIEPEND=null;CIEARCH=null;pintarCierre()}});
  vci.addEventListener("input",e=>{if(e.target.id==="cieef"){e.target.value=e.target.value.replace(/\D/g,"");difCierre()}});
  vci.addEventListener("click",e=>{if(e.target.closest("#cieenv"))enviarCierre(true);else if(e.target.closest("#cieresp"))enviarCierre(false);
    else if(e.target.closest("#ciepimg"))enviarParte("img");else if(e.target.closest("#ciepfile"))enviarParte("txt")});
  vci.addEventListener("input",e=>{if(e.target.id==="cieef"||e.target.id==="cieobs"){CIEARCH=null}});
}
// El carrito sigue al cobro (si vuelve atrás no pierde lo cambiado)
function sincCarro(){if(!COB)return;
  if(COB.mod==="T"){TCART=COB.lines.map(l=>({c:l.c,q:l.q}));guardarTCart()}
  else{COT.items=COT.items.filter(x=>COB.lines.some(l=>l.c===x.c));COT.items.forEach(x=>{const l=COB.lines.find(y=>y.c===x.c);if(l)x.q=l.q});guardarCot()}}

function iniciarVentas(){cargarVentas();prepararVentas(DB);conectarVentas();try{history.replaceState({v:"home"},"")}catch(e){}verSinHist("home")}
