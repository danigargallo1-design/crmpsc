/* Inicializacion centralizada del cliente Supabase.
 *
 * Pega aqui las credenciales PUBLICAS de tu proyecto Supabase.
 *
 *   SUPABASE_URL       -> Project URL      (Settings > API > Project URL)
 *   SUPABASE_ANON_KEY  -> anon/publishable (Settings > API > Project API keys)
 *
 * IMPORTANTE - Seguridad:
 *   - La anon/publishable key ES publica; puede estar en el frontend.
 *     La seguridad real la impone Row Level Security (RLS) en Supabase.
 *   - NUNCA pegues aqui la service_role key, ni la database password,
 *     ni ninguna clave privada. Si alguna vez la expones, revocala
 *     desde el panel de Supabase inmediatamente.
 */

const SUPABASE_URL = "https://ksngsuxkaevjrsvfrqig.supabase.co";          // Ejemplo: https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_jllzGxp8Q3E8eL0nMPUTQg_ScWJ34Ie";     // Ejemplo: eyJhbGciOi...

(function () {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[supabase] Faltan credenciales. Edita js/supabase.js y rellena SUPABASE_URL y SUPABASE_ANON_KEY."
    );
  }
  if (typeof window.supabase === "undefined") {
    console.error(
      "[supabase] La libreria @supabase/supabase-js no se ha cargado. Comprueba el <script> en index.html."
    );
    return;
  }
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL || "https://placeholder.supabase.co",
    SUPABASE_ANON_KEY || "placeholder",
    {
      auth: {
        // Persistimos la sesion en localStorage para que el usuario no
        // tenga que volver a iniciar sesion al recargar la pagina.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "crm-supabase-auth",
      },
    }
  );
})();
