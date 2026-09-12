/* Utilidades de interfaz: modal, confirmación, toasts, helpers */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const Modal = (() => {
  const fondo = $("#modal");
  let alCerrar = null;

  function abrir({ titulo, cuerpoHTML, botones = [], onCerrar = null }) {
    $("#modal-titulo").textContent = titulo;
    $("#modal-cuerpo").innerHTML = cuerpoHTML;
    const pie = $("#modal-pie");
    pie.innerHTML = "";
    botones.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (b.clase || "");
      btn.textContent = b.texto;
      btn.type = "button";
      if (b.id) btn.id = b.id;
      btn.addEventListener("click", b.onClick);
      pie.appendChild(btn);
    });
    alCerrar = onCerrar;
    fondo.classList.remove("oculto");
    const primero = $("#modal-cuerpo input, #modal-cuerpo select");
    if (primero) setTimeout(() => primero.focus(), 30);
  }

  function cerrar() {
    fondo.classList.add("oculto");
    if (alCerrar) alCerrar();
    alCerrar = null;
  }

  $("#modal-cerrar").addEventListener("click", cerrar);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !fondo.classList.contains("oculto")) cerrar(); });

  return { abrir, cerrar };
})();

const Confirmar = (() => {
  const fondo = $("#confirmar");
  let resolver = null;

  function pedir(mensaje, titulo = "Confirmar eliminación") {
    $("#confirmar-titulo").textContent = titulo;
    $("#confirmar-mensaje").textContent = mensaje;
    fondo.classList.remove("oculto");
    return new Promise((res) => { resolver = res; });
  }
  function terminar(valor) {
    fondo.classList.add("oculto");
    if (resolver) resolver(valor);
    resolver = null;
  }
  $("#confirmar-cancelar").addEventListener("click", () => terminar(false));
  $("#confirmar-aceptar").addEventListener("click", () => terminar(true));
  fondo.addEventListener("click", (e) => { if (e.target === fondo) terminar(false); });

  return { pedir };
})();

function toast(mensaje, tipo = "info") {
  const el = document.createElement("div");
  el.className = "toast toast-" + tipo;
  el.textContent = mensaje;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

function badgeEstado(estado) {
  const clase = "badge-" + estado.toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge ${clase}">${escapar(estado)}</span>`;
}

function coincide(texto, valores) {
  const t = texto.trim().toLowerCase();
  if (!t) return true;
  return valores.some((v) => String(v ?? "").toLowerCase().includes(t));
}

function valorCampo(id) { return $("#" + id).value.trim(); }
