import { onAuthChange, getUserData, login, register, logout as firebaseLogout } from "./auth.js";

let currentUser = null;
let currentUserData = null;

onAuthChange(async (user) => {
  if (user) {
    currentUser = user;
    currentUserData = await getUserData(user.uid);
    showApp();
  } else {
    currentUser = null;
    currentUserData = null;
    showScreen("screen-login");
  }
});

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showApp() {
  showScreen("screen-app");
  const name = currentUserData?.name || "Marc";
  document.getElementById("header-title-text").textContent = `Buenas, ${name}`;
  showView("home");
  updateHomePills();
}

window.showView = function(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + id).classList.add("active");
}

window.goHome = function() {
  document.getElementById("header-back").style.display = "none";
  document.getElementById("btn-logout").style.display = "flex";
  document.getElementById("casa-switcher").style.display = "none";
  document.getElementById("header-title-text").textContent = `Buenas, ${currentUserData?.name || ""}`;
  document.getElementById("header-title").querySelector("i").className = "ti ti-home";
  setBottomNav("home");
  showView("home");
}

window.enterSection = function(section) {
  document.getElementById("header-back").style.display = "flex";
  document.getElementById("btn-logout").style.display = "none";
  if (section === "casa") {
    document.getElementById("casa-switcher").style.display = "flex";
    switchCasa("orden");
  } else if (section === "furgo") {
    document.getElementById("casa-switcher").style.display = "none";
    document.getElementById("header-title-text").textContent = "Furgo";
    document.getElementById("header-title").querySelector("i").className = "ti ti-car";
    setBottomNav("furgo");
    showView("furgo");
  }
}

window.switchCasa = function(tab) {
  document.getElementById("spill-orden").classList.toggle("active", tab === "orden");
  document.getElementById("spill-eco").classList.toggle("active", tab === "eco");
  if (tab === "orden") {
    document.getElementById("header-title-text").textContent = "Casa";
    document.getElementById("header-title").querySelector("i").className = "ti ti-home";
    setBottomNav("orden");
    showView("orden");
    loadOrden();
  } else {
    document.getElementById("header-title-text").textContent = "Económico";
    document.getElementById("header-title").querySelector("i").className = "ti ti-coin";
    setBottomNav("eco");
    showView("eco");
    loadEco();
  }
}

function setBottomNav(section) {
  const nav = document.getElementById("bottom-nav");
  const navs = {
    home: `<div class="nav-item active" onclick="goHome()"><i class="ti ti-layout-grid"></i><span>Inicio</span></div>`,
    orden: `
      <div class="nav-item active" id="nav-tablero" onclick="ordenTab('tablero')"><i class="ti ti-layout-kanban"></i><span>Tablero</span></div>
      <div class="nav-item" id="nav-planif" onclick="ordenTab('planif')"><i class="ti ti-refresh"></i><span>Planificación</span></div>
      <div class="nav-item" id="nav-stats" onclick="ordenTab('stats')"><i class="ti ti-chart-bar"></i><span>Stats</span></div>
      <div class="nav-item" id="nav-cfg-orden" onclick="ordenTab('config')"><i class="ti ti-settings"></i><span>Config</span></div>`,
    eco: `
      <div class="nav-item active" id="nav-resumen" onclick="ecoTab('resumen')"><i class="ti ti-home"></i><span>Resumen</span></div>
      <div class="nav-item" id="nav-gastos" onclick="ecoTab('gastos')"><i class="ti ti-receipt"></i><span>Gastos</span></div>
      <div class="nav-item" id="nav-balance" onclick="ecoTab('balance')"><i class="ti ti-arrows-exchange"></i><span>Balance</span></div>
      <div class="nav-item" id="nav-cfg-eco" onclick="ecoTab('config')"><i class="ti ti-settings"></i><span>Config</span></div>`,
    furgo: `<div class="nav-item active" onclick="goHome()"><i class="ti ti-arrow-left"></i><span>Inicio</span></div>`
  };
  nav.innerHTML = navs[section] || navs.home;
}

window.logout = async function() {
  await firebaseLogout();
}

function loadOrden() {
  document.getElementById("orden-content").innerHTML = `<p class="loading-text">Cargando Orden...</p>`;
}

function loadEco() {
  document.getElementById("eco-content").innerHTML = `<p class="loading-text">Cargando Económico...</p>`;
}

function updateHomePills() {
  document.getElementById("home-pills-casa").innerHTML = `
    <span class="pill purple">Sprint activo</span>
    <span class="pill teal">Listo</span>`;
}

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  try {
    await login(email, password);
  } catch (e) {
    errEl.textContent = "Email o contraseña incorrectos";
  }
});

document.getElementById("btn-register").addEventListener("click", () => {
  showScreen("screen-register");
});

document.getElementById("btn-back-login").addEventListener("click", () => {
  showScreen("screen-login");
});

document.getElementById("btn-do-register").addEventListener("click", async () => {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("reg-error");
  errEl.textContent = "";
  if (!name || !email || !password) {
    errEl.textContent = "Rellena todos los campos";
    return;
  }
  try {
    await register(name, email, password);
  } catch (e) {
    errEl.textContent = "Error al crear la cuenta: " + e.message;
  }
});

window.ordenTab = function(tab) {
  document.querySelectorAll("#bottom-nav .nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("nav-" + (tab === "config" ? "cfg-orden" : tab))?.classList.add("active");
}

window.ecoTab = function(tab) {
  document.querySelectorAll("#bottom-nav .nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("nav-" + (tab === "config" ? "cfg-eco" : tab))?.classList.add("active");
}
