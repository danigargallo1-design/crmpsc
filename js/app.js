/* Arranque del CRM.
 *
 * Flujo:
 *   1. Se comprueba supabase.auth.getSession().
 *   2. Si NO hay sesion -> pantalla de login. El CRM no se muestra ni se
 *      carga ningun dato.
 *   3. Si SI hay sesion -> se carga Almacen.cargarTodo() desde Supabase
 *      y se pinta el CRM.
 *   4. Se escucha onAuthStateChange para reaccionar a login/logout
 *      producidos en otra pestana o al expirar la sesion.
 */
(() => {
  const SECCIONES = {
    clientes: Clientes,
    presupuestos: Presupuestos,
    pedidos: Pedidos,
    productos: Productos,
  };

  let cargado = false;
  let cargando = false;

  function mostrarSeccion(nombre) {
    Object.keys(SECCIONES).forEach((s) =>
      $("#seccion-" + s).classList.toggle("oculto", s !== nombre)
    );
    $$(".nav-item").forEach((b) =>
      b.classList.toggle("activo", b.dataset.seccion === nombre)
    );
    SECCIONES[nombre].render();
    Almacen.guardar("seccion", nombre);
  }

  function pintarUsuario(session) {
    const user = session && session.user;
    const email = user ? user.email || "" : "";
    // Nombre para mostrar: usa metadata.nombre si existe, si no la parte
    // antes de la @ del email.
    const nombre =
      (user && user.user_metadata && user.user_metadata.nombre) ||
      (email ? email.split("@")[0] : "Usuario");
    $("#usuario-nombre").textContent = nombre;
    $("#usuario-email").textContent = email;
  }

  async function entrarConSesion(session) {
    pintarUsuario(session);
    $("#pantalla-login").classList.add("oculto");
    $("#app").classList.remove("oculto");

    if (cargado || cargando) {
      if (cargado) mostrarSeccion(Almacen.leer("seccion", "clientes"));
      return;
    }
    cargando = true;
    try {
      await Almacen.cargarTodo();
      cargado = true;
      mostrarSeccion(Almacen.leer("seccion", "clientes"));
    } catch (err) {
      console.error("[app] cargarTodo:", err);
      toast(
        "No se pudieron cargar los datos. Revisa tu conexion o el esquema en Supabase.",
        "error"
      );
    } finally {
      cargando = false;
    }
  }

  function volverALogin() {
    cargado = false;
    Almacen.limpiar();
    $("#app").classList.add("oculto");
    $("#pantalla-login").classList.remove("oculto");
    PantallaLogin.limpiarError();
    // Vaciar tablas para que no queden datos del anterior usuario visibles.
    ["clientes", "productos", "presupuestos", "pedidos"].forEach((n) => {
      const t = document.getElementById("tabla-" + n);
      if (t) t.innerHTML = "";
    });
  }

  async function salir() {
    try {
      await Auth.logout();
    } catch (err) {
      console.error("[app] logout:", err);
    }
    // onAuthStateChange se encargara de volverALogin(), pero lo hacemos
    // tambien aqui por si el evento tardase.
    volverALogin();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    Object.values(SECCIONES).forEach((m) => m.iniciar());
    PantallaLogin.iniciar();
    $$(".nav-item").forEach((b) =>
      b.addEventListener("click", () => mostrarSeccion(b.dataset.seccion))
    );
    $("#btn-logout").addEventListener("click", salir);

    // Escuchar cambios de sesion (login, logout, refresh, expiracion).
    Auth.onCambioSesion((session) => {
      if (session) entrarConSesion(session);
      else volverALogin();
    });

    // Estado inicial.
    try {
      const session = await Auth.sesionActual();
      if (session) {
        await entrarConSesion(session);
      } else {
        $("#pantalla-login").classList.remove("oculto");
      }
    } catch (err) {
      console.error("[app] getSession:", err);
      $("#pantalla-login").classList.remove("oculto");
    }
  });
})();
