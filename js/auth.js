/* Autenticacion real con Supabase Auth.
 *
 * - Login con email + password contra Supabase Auth.
 * - No hay auto-registro en el frontend: los usuarios los crea el
 *   administrador desde el panel de Supabase (Authentication > Users).
 * - La sesion la gestiona el propio SDK de Supabase (persistSession).
 * - Se expone un "onAuthStateChange" que app.js usa para mostrar/ocultar
 *   el CRM cuando la sesion cambia.
 */
const Auth = (() => {
  function sb() {
    if (!window.supabaseClient) throw new Error("Supabase no inicializado.");
    return window.supabaseClient;
  }

  async function login(email, password) {
    email = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("El correo no es valido.");
    }
    if (!password || password.length < 6) {
      throw new Error("La contrasena debe tener al menos 6 caracteres.");
    }
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) {
      // Mensajes tipicos: "Invalid login credentials", "Email not confirmed"...
      if (/Invalid login credentials/i.test(error.message)) {
        throw new Error("Correo o contrasena incorrectos.");
      }
      throw new Error(error.message || "No se ha podido iniciar sesion.");
    }
    return data.user;
  }

  async function logout() {
    const { error } = await sb().auth.signOut();
    if (error) console.error("[auth] signOut:", error);
  }

  async function recuperar(email) {
    email = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Introduce un correo valido para recuperar la contrasena.");
    }
    const { error } = await sb().auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message || "No se pudo enviar el correo.");
  }

  async function sesionActual() {
    const { data } = await sb().auth.getSession();
    return data.session || null;
  }

  function onCambioSesion(callback) {
    return sb().auth.onAuthStateChange((_event, session) => callback(session));
  }

  return { login, logout, recuperar, sesionActual, onCambioSesion };
})();

/* Pantalla de login: reutiliza la UI existente. Solo cambia el JS interno. */
const PantallaLogin = (() => {
  function mostrarError(msg) {
    const el = $("#login-error");
    el.textContent = msg;
    el.classList.remove("oculto");
  }
  function limpiarError() {
    $("#login-error").classList.add("oculto");
  }

  function iniciar(alEntrar) {
    // Modo unico: iniciar sesion. Ocultamos el campo "nombre" y el toggle
    // de "crear cuenta" porque los usuarios se crean desde el panel de
    // Supabase (no hay auto-registro en el CRM).
    $("#campo-nombre").classList.add("oculto");
    $("#login-titulo").textContent = "Iniciar sesion";
    $("#login-submit").textContent = "Entrar";
    const cambio = document.querySelector(".login-cambio");
    if (cambio) cambio.classList.add("oculto");

    $("#form-login").addEventListener("submit", async (e) => {
      e.preventDefault();
      limpiarError();
      const email = $("#login-email").value;
      const password = $("#login-password").value;
      const btn = $("#login-submit");
      const textoOriginal = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Entrando...";
      try {
        await Auth.login(email, password);
        $("#form-login").reset();
        // No llamamos a alEntrar() aqui: lo hara onAuthStateChange en app.js.
      } catch (err) {
        mostrarError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
      }
    });
  }

  return { iniciar, mostrarError, limpiarError };
})();
