import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
  where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let tareasListener = null;
let sprintListener = null;
let currentTab = "tablero";
let currentSprint = null;
let todasTareas = [];
let filtroPersona = "all";

const ESTADOS = {
  pendiente: { label: "Pendiente", color: "#888780", bg: "#F1EFE8", text: "#444441" },
  progreso:  { label: "En progreso", color: "#7F77DD", bg: "#EEEDFE", text: "#3C3489" },
  bloqueada: { label: "Bloqueada", color: "#E24B4A", bg: "#FAECE7", text: "#712B13" },
  hecha:     { label: "Hecha", color: "#1D9E75", bg: "#EAF3DE", text: "#27500A" }
};

const CATEGORIAS = {
  limpieza:     { label: "Limpieza", color: "#0F6E56", bg: "#E1F5EE" },
  compras:      { label: "Compras", color: "#185FA5", bg: "#E6F1FB" },
  mantenimiento:{ label: "Mantenimiento", color: "#5F5E5A", bg: "#F1EFE8" },
  economico:    { label: "Económico", color: "#993556", bg: "#FBEAF0" },
  furgo:        { label: "Furgo", color: "#854F0B", bg: "#FAEEDA" }
};

const PRIORIDADES = {
  alta:  { color: "#E24B4A" },
  media: { color: "#EF9F27" },
  baja:  { color: "#639922" }
};

export function initOrden(userData) {
  renderOrden(userData);
}

export function destroyOrden() {
  if (tareasListener) tareasListener();
  if (sprintListener) sprintListener();
}

function renderOrden(userData) {
  const el = document.getElementById("orden-content");
  el.innerHTML = `
    <div class="orden-filter-row">
      <span class="filter-label">Ver:</span>
      <div class="av-btn av-all sel" id="fo-all" onclick="ordenFiltro('all')">Todos</div>
      <div class="av-btn av-m" id="fo-m" onclick="ordenFiltro('M')">M</div>
      <div class="av-btn av-p" id="fo-p" onclick="ordenFiltro('P')">P</div>
    </div>
    <div class="sprint-info-bar" id="sprint-info-bar">Cargando sprint...</div>
    <div id="orden-tab-content"></div>
  `;
  loadSprint(userData);
  window.ordenFiltro = (f) => {
    filtroPersona = f;
    ["all","m","p"].forEach(x => document.getElementById("fo-"+x)?.classList.remove("sel"));
    document.getElementById("fo-"+f.toLowerCase())?.classList.add("sel");
    renderTabContent(userData);
  };
}

function loadSprint(userData) {
  const q = query(collection(db, "sprints"), where("activo", "==", true));
  sprintListener = onSnapshot(q, snap => {
    if (!snap.empty) {
      currentSprint = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      currentSprint = null;
    }
    loadTareas(userData);
    updateSprintBar();
  });
}

function updateSprintBar() {
  const bar = document.getElementById("sprint-info-bar");
  if (!bar) return;
  if (!currentSprint) {
    bar.innerHTML = `<span>Sin sprint activo</span><button onclick="crearSprint()" style="font-size:12px;padding:4px 10px">Crear sprint</button>`;
    return;
  }
  const hechas = todasTareas.filter(t => t.sprintId === currentSprint.id && t.estado === "hecha").length;
  const total = todasTareas.filter(t => t.sprintId === currentSprint.id).length;
  const pct = total > 0 ? Math.round(hechas/total*100) : 0;
  bar.innerHTML = `
    <div class="sprint-bar-left">
      <span class="sprint-bar-name">${currentSprint.nombre || "Sprint activo"}</span>
      <span class="sprint-bar-dates">${currentSprint.fechaInicio || ""} – ${currentSprint.fechaFin || ""}</span>
    </div>
    <div class="sprint-bar-right">
      <div class="sprint-bar-prog"><div class="sprint-bar-fill" style="width:${pct}%"></div></div>
      <span class="sprint-bar-pct">${hechas}/${total}</span>
    </div>`;
}

function loadTareas(userData) {
  if (tareasListener) tareasListener();
  const q = query(collection(db, "tareas"), orderBy("creadaEn", "desc"));
  tareasListener = onSnapshot(q, snap => {
    todasTareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSprintBar();
    renderTabContent(userData);
  });
}

export function renderTabContent(userData) {
  if (currentTab === "tablero") renderTablero(userData);
  else if (currentTab === "planif") renderPlanif(userData);
  else if (currentTab === "stats") renderStats(userData);
  else if (currentTab === "config") renderConfig(userData);
}

window.ordenSetTab = function(tab, userData) {
  currentTab = tab;
  renderTabContent(userData);
}

function getTareasSprint() {
  if (!currentSprint) return [];
  return todasTareas.filter(t => t.sprintId === currentSprint.id);
}

function filtrarPorPersona(tareas) {
  if (filtroPersona === "all") return tareas;
  return tareas.filter(t => t.asignadoA === filtroPersona);
}

// ── TABLERO (Vista lista) ──────────────────────────────────────────────
function renderTablero(userData) {
  const el = document.getElementById("orden-tab-content");
  const sprintTareas = filtrarPorPersona(getTareasSprint());
  const grupos = ["bloqueada","progreso","pendiente","hecha"];

  let html = `<div class="view-toggle-row">
    <button class="vt-btn active" onclick="setVistaTablero('lista', this)"><i class="ti ti-list"></i> Lista</button>
    <button class="vt-btn" onclick="setVistaTablero('kanban', this)"><i class="ti ti-layout-kanban"></i> Tablero</button>
  </div><div id="tablero-inner">`;

  grupos.forEach(estado => {
    const ts = sprintTareas.filter(t => t.estado === estado);
    const est = ESTADOS[estado];
    const isHecha = estado === "hecha";
    html += `
      <div class="grupo">
        <div class="grupo-header" onclick="toggleGrupo('g-${estado}')">
          <div class="grupo-left">
            <div class="grupo-dot" style="background:${est.color}"></div>
            <span class="grupo-name">${est.label}</span>
            <span class="grupo-cnt">${ts.length}</span>
          </div>
          <i class="ti ti-chevron-down grupo-chev ${isHecha ? '' : 'open'}" id="chev-${estado}"></i>
        </div>
        <div class="grupo-tasks ${isHecha ? '' : 'open'}" id="g-${estado}">
          ${ts.map(t => taskRow(t)).join("")}
          ${ts.length === 0 ? `<div class="task-empty">Sin tareas</div>` : ""}
        </div>
      </div>`;
  });

  html += `</div>
    <div class="fab-row">
      <button class="fab-btn" onclick="abrirNuevaTarea()"><i class="ti ti-plus"></i> Nueva tarea</button>
    </div>`;

  el.innerHTML = html;
  setupTableroHandlers(userData);
}

function taskRow(t) {
  const cat = CATEGORIAS[t.categoria] || CATEGORIAS.limpieza;
  const est = ESTADOS[t.estado] || ESTADOS.pendiente;
  const prio = PRIORIDADES[t.prioridad] || PRIORIDADES.media;
  const isHecha = t.estado === "hecha";
  return `
    <div class="task-row ${isHecha ? 'task-done' : ''}" onclick="abrirCambiarEstado('${t.id}', '${t.estado}', '${t.titulo}')">
      <div class="task-row-main">
        <span class="task-cat" style="color:${cat.color};background:${cat.bg}">${cat.label}</span>
        <span class="task-name">${t.titulo}</span>
        ${t.bloqueadaRazon ? `<span class="bloq-badge">${t.bloqueadaRazon}</span>` : ""}
      </div>
      <div class="task-row-right">
        <div class="task-av ${t.asignadoA === 'M' ? 'av-m' : 'av-p'}">${t.asignadoA || "?"}</div>
        <div class="prio-dot" style="background:${prio.color}"></div>
      </div>
    </div>`;
}

function setupTableroHandlers(userData) {
  window.toggleGrupo = (id) => {
    const el = document.getElementById(id);
    const estado = id.replace("g-", "");
    const chev = document.getElementById("chev-" + estado);
    if (!el) return;
    el.classList.toggle("open");
    chev?.classList.toggle("open");
  };

  window.setVistaTablero = (vista, btn) => {
    document.querySelectorAll(".vt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (vista === "kanban") renderKanban(userData);
    else renderTablero(userData);
  };

  window.abrirCambiarEstado = (id, estadoActual, titulo) => {
    const overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.innerHTML = `
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-title">${titulo}</div>
        <div class="sheet-sub">Cambiar estado</div>
        ${Object.entries(ESTADOS).map(([k,v]) => `
          <div class="status-opt ${k === estadoActual ? 'current' : ''}" onclick="cambiarEstado('${id}','${k}')">
            <div class="status-dot" style="background:${v.color}"></div>
            <span class="status-name">${v.label}</span>
            ${k === estadoActual ? '<i class="ti ti-check" style="color:#7F77DD"></i>' : ""}
          </div>`).join("")}
        ${estadoActual === "bloqueada" ? `
          <input type="text" id="bloq-razon" placeholder="¿Por qué está bloqueada?" style="margin-top:8px">` : ""}
        <button class="cancel-btn" onclick="this.closest('.overlay').remove()">Cancelar</button>
      </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById("screen-app").appendChild(overlay);
  };

  window.cambiarEstado = async (id, nuevoEstado) => {
    const data = { estado: nuevoEstado };
    if (nuevoEstado === "bloqueada") {
      const razon = document.getElementById("bloq-razon")?.value || "";
      data.bloqueadaRazon = razon;
    } else {
      data.bloqueadaRazon = "";
    }
    await updateDoc(doc(db, "tareas", id), data);
    document.querySelector(".overlay")?.remove();
  };

  window.abrirNuevaTarea = () => {
    const overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.innerHTML = `
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-title">Nueva tarea</div>
        <div class="sheet-form">
          <input type="text" id="nt-titulo" placeholder="Título de la tarea">
          <select id="nt-categoria">
            ${Object.entries(CATEGORIAS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("")}
          </select>
          <select id="nt-prioridad">
            <option value="alta">Alta</option>
            <option value="media" selected>Media</option>
            <option value="baja">Baja</option>
          </select>
          <div class="asignar-row">
            <div class="asignar-btn sel" id="asig-M" onclick="selAsignar('M')"><span class="av-m">M</span> Marc</div>
            <div class="asignar-btn" id="asig-P" onclick="selAsignar('P')"><span class="av-p">P</span> Pareja</div>
          </div>
          <select id="nt-sprint">
            <option value="backlog">Backlog (sin sprint)</option>
            ${currentSprint ? `<option value="${currentSprint.id}" selected>Sprint activo — ${currentSprint.nombre}</option>` : ""}
          </select>
          <input type="text" id="nt-bloq" placeholder="Razón si está bloqueada (opcional)">
          <button onclick="guardarNuevaTarea()">Guardar tarea</button>
        </div>
        <button class="cancel-btn" onclick="this.closest('.overlay').remove()">Cancelar</button>
      </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById("screen-app").appendChild(overlay);
    window._asignadoA = "M";
    window.selAsignar = (p) => {
      window._asignadoA = p;
      document.getElementById("asig-M").classList.toggle("sel", p === "M");
      document.getElementById("asig-P").classList.toggle("sel", p === "P");
    };
  };

  window.guardarNuevaTarea = async () => {
    const titulo = document.getElementById("nt-titulo")?.value.trim();
    if (!titulo) return;
    const sprintVal = document.getElementById("nt-sprint")?.value;
    const data = {
      titulo,
      categoria: document.getElementById("nt-categoria")?.value || "limpieza",
      prioridad: document.getElementById("nt-prioridad")?.value || "media",
      asignadoA: window._asignadoA || "M",
      estado: "pendiente",
      sprintId: sprintVal === "backlog" ? null : sprintVal,
      bloqueadaRazon: document.getElementById("nt-bloq")?.value || "",
      creadaEn: serverTimestamp(),
      creadaPor: auth.currentUser?.uid
    };
    await addDoc(collection(db, "tareas"), data);
    document.querySelector(".overlay")?.remove();
  };
}

// ── KANBAN ─────────────────────────────────────────────────────────────
function renderKanban(userData) {
  const inner = document.getElementById("tablero-inner");
  if (!inner) return;
  const sprintTareas = filtrarPorPersona(getTareasSprint());
  let html = `<div class="kanban-board">`;
  Object.entries(ESTADOS).forEach(([k, v]) => {
    const ts = sprintTareas.filter(t => t.estado === k);
    html += `
      <div class="k-col">
        <div class="k-col-header">
          <span class="k-col-title">${v.label}</span>
          <span class="k-col-cnt">${ts.length}</span>
        </div>
        ${ts.map(t => {
          const cat = CATEGORIAS[t.categoria] || CATEGORIAS.limpieza;
          const prio = PRIORIDADES[t.prioridad] || PRIORIDADES.media;
          return `<div class="k-card ${k === 'hecha' ? 'k-done' : ''}" onclick="abrirCambiarEstado('${t.id}','${k}','${t.titulo}')">
            <div class="k-cat" style="color:${cat.color}">${cat.label}</div>
            <div class="k-title">${t.titulo}</div>
            ${t.bloqueadaRazon ? `<span class="bloq-badge">${t.bloqueadaRazon}</span>` : ""}
            <div class="k-footer">
              <div class="task-av ${t.asignadoA === 'M' ? 'av-m' : 'av-p'}">${t.asignadoA || "?"}</div>
              <div class="prio-dot" style="background:${prio.color}"></div>
            </div>
          </div>`;
        }).join("")}
      </div>`;
  });
  html += `</div>`;
  inner.innerHTML = html;
}

// ── PLANIFICACIÓN ──────────────────────────────────────────────────────
function renderPlanif(userData) {
  const el = document.getElementById("orden-tab-content");
  const sprintTareas = getTareasSprint();
  const backlog = todasTareas.filter(t => !t.sprintId);

  let html = ``;

  if (currentSprint) {
    html += `<div class="card-block">
      <div class="card-block-header">
        <span class="card-block-title">Sprint activo — ${currentSprint.nombre}</span>
        <span class="pill purple">${sprintTareas.filter(t=>t.estado==='hecha').length}/${sprintTareas.length}</span>
      </div>
      ${sprintTareas.map(t => planifRow(t, true)).join("")}
      ${sprintTareas.length === 0 ? `<div class="task-empty">Sin tareas en el sprint</div>` : ""}
    </div>`;
  } else {
    html += `<div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Sin sprint activo</span></div>
      <button onclick="crearSprint()" style="width:100%;margin-top:8px">Crear sprint semanal</button>
    </div>`;
  }

  html += `<div class="card-block">
    <div class="card-block-header">
      <span class="card-block-title">Backlog</span>
      <span style="font-size:11px;color:#aaa">${backlog.length} tareas</span>
    </div>
    ${backlog.map(t => planifRow(t, false)).join("")}
    ${backlog.length === 0 ? `<div class="task-empty">Backlog vacío</div>` : ""}
    <button style="width:100%;margin-top:10px" onclick="abrirNuevaTarea()"><i class="ti ti-plus"></i> Nueva tarea al backlog</button>
  </div>`;

  el.innerHTML = html;

  window.moverASprint = async (id) => {
    if (!currentSprint) return alert("No hay sprint activo");
    await updateDoc(doc(db, "tareas", id), { sprintId: currentSprint.id });
  };

  window.quitarDeSprint = async (id) => {
    await updateDoc(doc(db, "tareas", id), { sprintId: null });
  };

  window.crearSprint = async () => {
    const nombre = prompt("Nombre del sprint (ej: Semana 20):");
    if (!nombre) return;
    const inicio = prompt("Fecha inicio (ej: 25 may):");
    const fin = prompt("Fecha fin (ej: 31 may):");
    await addDoc(collection(db, "sprints"), {
      nombre, fechaInicio: inicio, fechaFin: fin,
      activo: true, creadaEn: serverTimestamp()
    });
  };
}

function planifRow(t, enSprint) {
  const cat = CATEGORIAS[t.categoria] || CATEGORIAS.limpieza;
  const est = ESTADOS[t.estado] || ESTADOS.pendiente;
  return `
    <div class="planif-row">
      <i class="ti ti-grip-vertical planif-grip"></i>
      <div class="planif-info">
        <span class="task-cat" style="color:${cat.color};background:${cat.bg}">${cat.label}</span>
        <span class="planif-name">${t.titulo}</span>
      </div>
      <div class="task-av ${t.asignadoA === 'M' ? 'av-m' : 'av-p'}">${t.asignadoA || "?"}</div>
      ${enSprint
        ? `<button class="planif-btn" onclick="quitarDeSprint('${t.id}')"><i class="ti ti-minus"></i></button>`
        : `<button class="planif-btn" onclick="moverASprint('${t.id}')"><i class="ti ti-arrow-up"></i></button>`
      }
    </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────────
function renderStats(userData) {
  const el = document.getElementById("orden-tab-content");
  const sprint = getTareasSprint();
  const hechas = sprint.filter(t => t.estado === "hecha").length;
  const bloqueadas = sprint.filter(t => t.estado === "bloqueada").length;
  const backlog = todasTareas.filter(t => !t.sprintId).length;
  const porM = sprint.filter(t => t.asignadoA === "M");
  const porP = sprint.filter(t => t.asignadoA === "P");

  const catCount = {};
  todasTareas.forEach(t => { catCount[t.categoria] = (catCount[t.categoria]||0)+1; });

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Completadas</div><div class="stat-val">${hechas}</div><div class="stat-sub">este sprint</div></div>
      <div class="stat-card"><div class="stat-label">Total sprint</div><div class="stat-val">${sprint.length}</div><div class="stat-sub">${sprint.length > 0 ? Math.round(hechas/sprint.length*100) : 0}% hecho</div></div>
      <div class="stat-card"><div class="stat-label">Bloqueadas</div><div class="stat-val" style="color:#A32D2D">${bloqueadas}</div><div class="stat-sub">ahora mismo</div></div>
      <div class="stat-card"><div class="stat-label">Backlog</div><div class="stat-val">${backlog}</div><div class="stat-sub">sin sprint</div></div>
    </div>
    <div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Por persona este sprint</span></div>
      <div class="person-stats-grid">
        <div class="person-stat-card">
          <div class="person-stat-head"><div class="av-m task-av">M</div><span>Marc</span></div>
          <div class="person-stat-row"><span>Asignadas</span><span>${porM.length}</span></div>
          <div class="person-stat-row teal"><span>Hechas</span><span>${porM.filter(t=>t.estado==='hecha').length}</span></div>
          <div class="person-stat-row red"><span>Bloqueadas</span><span>${porM.filter(t=>t.estado==='bloqueada').length}</span></div>
        </div>
        <div class="person-stat-card">
          <div class="person-stat-head"><div class="av-p task-av">P</div><span>Pareja</span></div>
          <div class="person-stat-row"><span>Asignadas</span><span>${porP.length}</span></div>
          <div class="person-stat-row teal"><span>Hechas</span><span>${porP.filter(t=>t.estado==='hecha').length}</span></div>
          <div class="person-stat-row red"><span>Bloqueadas</span><span>${porP.filter(t=>t.estado==='bloqueada').length}</span></div>
        </div>
      </div>
    </div>
    <div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Tareas por categoría</span></div>
      <div class="cat-chips">
        ${Object.entries(catCount).map(([k,v]) => {
          const cat = CATEGORIAS[k] || CATEGORIAS.limpieza;
          return `<span class="cat-chip" style="background:${cat.bg};color:${cat.color}">${cat.label} ${v}</span>`;
        }).join("")}
      </div>
    </div>`;
}

// ── CONFIG ─────────────────────────────────────────────────────────────
function renderConfig(userData) {
  const el = document.getElementById("orden-tab-content");
  el.innerHTML = `
    <div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Sprint activo</span></div>
      ${currentSprint ? `
        <div class="config-row"><span>Nombre</span><span>${currentSprint.nombre}</span></div>
        <div class="config-row"><span>Fechas</span><span>${currentSprint.fechaInicio} – ${currentSprint.fechaFin}</span></div>
        <button style="width:100%;margin-top:10px;color:#A32D2D;border-color:#A32D2D" onclick="cerrarSprint()">Cerrar sprint</button>
      ` : `<button style="width:100%" onclick="crearSprint()">Crear nuevo sprint</button>`}
    </div>
    <div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Categorías</span></div>
      <div class="cat-chips">
        ${Object.entries(CATEGORIAS).map(([k,v]) =>
          `<span class="cat-chip" style="background:${v.bg};color:${v.color}">${v.label}</span>`
        ).join("")}
      </div>
    </div>
    <div class="card-block">
      <div class="card-block-header"><span class="card-block-title">Al cerrar sprint</span></div>
      <div class="config-row"><span>Mover no hechas al backlog</span>
        <div class="toggle on"><div class="toggle-thumb"></div></div>
      </div>
    </div>`;

  window.cerrarSprint = async () => {
    if (!currentSprint) return;
    if (!confirm("¿Cerrar el sprint? Las tareas no hechas volverán al backlog.")) return;
    const noHechas = getTareasSprint().filter(t => t.estado !== "hecha");
    for (const t of noHechas) {
      await updateDoc(doc(db, "tareas", t.id), { sprintId: null });
    }
    await updateDoc(doc(db, "sprints", currentSprint.id), { activo: false });
  };

  window.crearSprint = async () => {
    const nombre = prompt("Nombre del sprint (ej: Semana 20):");
    if (!nombre) return;
    const inicio = prompt("Fecha inicio (ej: 25 may):");
    const fin = prompt("Fecha fin (ej: 31 may):");
    if (currentSprint) {
      await updateDoc(doc(db, "sprints", currentSprint.id), { activo: false });
    }
    await addDoc(collection(db, "sprints"), {
      nombre, fechaInicio: inicio || "", fechaFin: fin || "",
      activo: true, creadaEn: serverTimestamp()
    });
  };
}
