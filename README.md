# CRM Empresarial — HTML + CSS + JS vanilla + Supabase + Supabase Auth

Este CRM sigue siendo un proyecto **sencillo de HTML/CSS/JavaScript vanilla**. No usa React, Vue, Angular, Next.js, TypeScript, Vite ni Node.js. Todo el código está en archivos que se pueden abrir, leer y modificar directamente.

La persistencia de datos está en **Supabase** (PostgreSQL) y la autenticación se apoya en **Supabase Auth** (email + contraseña). La seguridad real está en **Row Level Security (RLS)**: aunque alguien obtenga la URL pública y la anon key, no podrá leer ni modificar datos sin haberse autenticado antes.

---

## 1. Crear el proyecto Supabase

1. Entra en <https://supabase.com/> y crea un proyecto (o abre uno existente).
2. Espera a que Supabase termine de aprovisionar la base de datos.

## 2. Ejecutar el esquema

1. En el proyecto de Supabase abre **SQL Editor**.
2. Copia el contenido completo de `supabase_schema.sql` y pégalo.
3. Ejecuta el script (**Run**). Crea:
   - Las tablas: `clientes`, `productos`, `presupuestos`, `presupuesto_items`, `pedidos`, `pedido_items`, `contadores`.
   - Los índices.
   - El trigger `updated_at`.
   - La función RPC `siguiente_numero` (numeración atómica en PostgreSQL).
   - Las políticas RLS para el rol `authenticated`.

## 3. Habilitar el proveedor Email en Supabase Auth

1. Ve a **Authentication → Providers**.
2. Verifica que **Email** está habilitado. Es el que usa el CRM.
3. (Opcional) En **Authentication → Emails** puedes personalizar la plantilla de recuperación de contraseña.

## 4. Crear el primer usuario

En este CRM **no hay auto-registro** por diseño de seguridad. Los usuarios los crea el administrador manualmente:

1. Ve a **Authentication → Users** en el panel de Supabase.
2. Pulsa **Add user → Create new user**.
3. Introduce **email** y **password** (mínimo 6 caracteres).
4. Marca **Auto Confirm User** para saltar el email de confirmación.
5. Guarda.

Repite el proceso para cada persona del equipo.

## 5. Configurar `js/supabase.js`

1. En Supabase ve a **Project Settings → API**.
2. Copia:
   - **Project URL**
   - **anon public** (también llamada *publishable key*)
3. Abre `js/supabase.js` y pégalos en las constantes:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
4. Guarda el archivo.

## 6. Abrir el CRM

Abre `index.html` en tu navegador (doble clic o servidor estático local). No hay que compilar, ni instalar dependencias, ni levantar servidor Node.

## 7. Iniciar sesión

Introduce el email y la contraseña del usuario creado en el paso 4. Al pulsar **Entrar**:
- Si las credenciales son correctas → se carga el CRM.
- Si son incorrectas → aparece el mensaje `Correo o contraseña incorrectos`.

La sesión queda **persistida** en `localStorage` bajo la clave `crm-supabase-auth`. Al recargar la página o volver otro día, entras directamente sin volver a autenticarte hasta que el token expire o hagas logout.

Para cerrar sesión, pulsa **Cerrar sesión** en la esquina inferior del sidebar.

---

## 8. Cómo funciona la seguridad (RLS)

- Todas las tablas tienen **RLS activado**.
- Las políticas se aplican **solo al rol `authenticated`** (usuario logueado con JWT válido).
- El rol `anon` (el que expone la anon key en el frontend) **no tiene ninguna política** → no puede leer ni escribir nada.
- Las tablas hijas (`presupuesto_items`, `pedido_items`) exigen además que el registro padre exista (política con `exists (...)`).
- La tabla `contadores` **no tiene políticas de lectura/escritura directa**. Solo se toca mediante la función `siguiente_numero`, que es `security definer` (se ejecuta con los permisos del propietario, no del usuario).

Consecuencia práctica:
- Si alguien copia la anon key y ejecuta `supabase.from("clientes").select("*")` sin haber iniciado sesión → recibe un array vacío / error de permisos.
- Solo tras `signInWithPassword` correcto se emite un JWT que activa el rol `authenticated` y desbloquea el acceso a los datos.

### Modelo de datos: equipo compartido

Este proyecto se ha configurado en **modo equipo**: todos los usuarios autenticados ven y editan los mismos clientes, productos, presupuestos y pedidos. La numeración (`CLI-0001`, `P-0001`, `PRE-0001`, `PED-0001`) también es global.

Si más adelante quieres aislar datos por usuario (cada persona ve solo lo suyo), habría que:
1. Añadir la columna `user_id uuid references auth.users(id) not null` a cada tabla.
2. Cambiar las políticas a `using (auth.uid() = user_id)` y `with check (auth.uid() = user_id)`.
3. Migrar los registros existentes asignándoles un `user_id`.

## 9. Qué NO se debe introducir NUNCA en el frontend

**Nunca** pegues en `js/supabase.js` (ni en ningún archivo del frontend):

- La **service_role key** (rompe RLS y expone toda la base de datos).
- La **secret key** o cualquier clave privada.
- La **database password** (`postgres://...`).
- Tokens de acceso personal de Supabase, GitHub, etc.

Si por accidente expusieras una de estas claves, entra en **Project Settings → API** de Supabase y **rota** (`Regenerate`) las claves inmediatamente.

## 10. Cómo crear nuevos usuarios más adelante

Repite el paso 4:
1. **Authentication → Users → Add user → Create new user**.
2. Email + password + Auto Confirm.
3. Guarda.

Para eliminar un usuario, en la misma pantalla selecciónalo y usa la opción **Delete user**. Al perder el acceso, deja de poder iniciar sesión en el CRM automáticamente en cuanto expire su JWT.

## 11. Recuperar contraseña

Si necesitas restablecer la contraseña de un usuario, tienes dos opciones:

- **Desde el panel de Supabase**: **Authentication → Users → (usuario) → Send password recovery** o **Reset password**.
- **Desde código** (opcional): la función `Auth.recuperar(email)` en `js/auth.js` invoca `supabase.auth.resetPasswordForEmail`. Puedes conectarla a un enlace en la pantalla de login si lo necesitas.

---

## 12. Estructura de archivos

```
/
├── index.html
├── supabase_schema.sql
├── README.md
│
├── css/
│   └── style.css
│
└── js/
    ├── app.js          # Arranque + control de sesion
    ├── auth.js         # Supabase Auth (login, logout, recuperacion)
    ├── supabase.js     # Inicializacion del cliente Supabase
    ├── almacen.js      # Cache + CRUD asincrono contra Supabase
    ├── clientes.js
    ├── productos.js
    ├── presupuestos.js
    ├── pedidos.js
    ├── documentos.js   # Editor compartido presupuesto/pedido
    └── ui.js           # Modal, confirmar, toasts, helpers
```

## 13. Diseño visual

El CSS (`css/style.css`), la estructura HTML y los componentes visuales del CRM (sidebar, tablas, modales, botones, toasts, badges) **no se han tocado**. Esta versión solo evoluciona la autenticación y la seguridad.
