/* Persistencia real en Supabase con cache local en memoria.
 *
 * - Lectura síncrona (listar/obtener) desde cache (previamente cargada de Supabase).
 * - Escritura asíncrona (insertar/actualizar/eliminar) contra Supabase; la cache se actualiza
 *   sólo cuando Supabase confirma el cambio.
 * - siguienteNumero(): usa la función RPC "siguiente_numero" de Postgres para evitar duplicados.
 *
 * Colecciones válidas: 'clientes', 'productos', 'presupuestos', 'pedidos'.
 */
const IVA = 0.21;

const Almacen = (() => {
  const PREFIJO = "crm_";

  // Cache en memoria (fuente de lectura síncrona para los módulos).
  const cache = {
    clientes: [],
    productos: [],
    presupuestos: [],
    pedidos: [],
  };

  function sb() {
    if (!window.supabaseClient) throw new Error("Supabase no inicializado.");
    return window.supabaseClient;
  }

  /* ---------- Preferencias locales (secciones, sesión local, etc.) ---------- */
  function leer(clave, porDefecto) {
    try {
      const v = localStorage.getItem(PREFIJO + clave);
      return v === null ? porDefecto : JSON.parse(v);
    } catch (e) {
      return porDefecto;
    }
  }
  function guardar(clave, valor) {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  }

  /* ---------- Lectura síncrona desde cache ---------- */
  function listar(coleccion) {
    return (cache[coleccion] || []).slice();
  }
  function obtener(coleccion, id) {
    return (cache[coleccion] || []).find((x) => x.id === id) || null;
  }

  /* ---------- Mapeos DB <-> app ---------- */
  function mapClienteDB(c) {
    return {
      id: c.id,
      numero: c.numero_cliente,
      nombre: c.nombre || "",
      nif: c.dni || "",
      telefono: c.telefono || "",
      email: c.email || "",
      direccion: c.direccion || "",
      poblacion: c.poblacion || "",
      cp: c.cp || "",
      provincia: c.provincia || "",
      observaciones: c.observaciones || "",
      creado: c.created_at,
      actualizado: c.updated_at,
    };
  }
  function clienteAppADB(c) {
    return {
      nombre: c.nombre || "",
      dni: c.nif || "",
      telefono: c.telefono || "",
      email: c.email || "",
      direccion: c.direccion || "",
      poblacion: c.poblacion || "",
      cp: c.cp || "",
      provincia: c.provincia || "",
      observaciones: c.observaciones || "",
    };
  }

  function mapProductoDB(p) {
    return {
      id: p.id,
      codigo: p.referencia,
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      precio: Number(p.precio) || 0,
      stock: p.stock == null ? null : Number(p.stock),
      creado: p.created_at,
      actualizado: p.updated_at,
    };
  }
  function productoAppADB(p) {
    return {
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      precio: Number(p.precio) || 0,
    };
  }

  function mapLineaDB(l) {
    return {
      producto_id: l.producto_id,
      producto_codigo: l.producto_codigo || "",
      producto_nombre: l.descripcion || "",
      cantidad: Number(l.cantidad) || 0,
      precio: Number(l.precio) || 0,
    };
  }

  function mapPresupuestoDB(p) {
    const cli = obtener("clientes", p.cliente_id) || {};
    return {
      id: p.id,
      numero: p.numero_presupuesto,
      fecha: p.fecha,
      estado: p.estado || "Pendiente",
      cliente_id: p.cliente_id,
      cliente_numero: cli.numero || "",
      cliente_nombre: cli.nombre || "",
      observaciones: p.observaciones || "",
      subtotal: Number(p.subtotal) || 0,
      iva: Number(p.iva) || 0,
      total: Number(p.total) || 0,
      pedido_id: p.pedido_id || null,
      pedido_numero: p.pedido_numero || null,
      lineas: (p.presupuesto_items || []).map(mapLineaDB),
      creado: p.created_at,
      actualizado: p.updated_at,
    };
  }

  function mapPedidoDB(p) {
    const cli = obtener("clientes", p.cliente_id) || {};
    const pre = p.presupuesto_id ? obtener("presupuestos", p.presupuesto_id) : null;
    return {
      id: p.id,
      numero: p.numero_pedido,
      fecha: p.fecha,
      estado: p.estado || "Pendiente",
      cliente_id: p.cliente_id,
      cliente_numero: cli.numero || "",
      cliente_nombre: cli.nombre || "",
      presupuesto_id: p.presupuesto_id || null,
      presupuesto_numero: pre ? pre.numero : (p.presupuesto_numero || null),
      observaciones: p.observaciones || "",
      subtotal: Number(p.subtotal) || 0,
      iva: Number(p.iva) || 0,
      total: Number(p.total) || 0,
      lineas: (p.pedido_items || []).map(mapLineaDB),
      creado: p.created_at,
      actualizado: p.updated_at,
    };
  }

  /* ---------- Carga inicial ---------- */
  async function cargarTodo() {
    const c = sb();
    const [rCli, rPro, rPres, rPed] = await Promise.all([
      c.from("clientes").select("*").order("numero_cliente", { ascending: true }),
      c.from("productos").select("*").order("referencia", { ascending: true }),
      c.from("presupuestos").select("*, presupuesto_items(*)").order("numero_presupuesto", { ascending: true }),
      c.from("pedidos").select("*, pedido_items(*)").order("numero_pedido", { ascending: true }),
    ]);
    if (rCli.error) throw rCli.error;
    if (rPro.error) throw rPro.error;
    if (rPres.error) throw rPres.error;
    if (rPed.error) throw rPed.error;
    cache.clientes = (rCli.data || []).map(mapClienteDB);
    cache.productos = (rPro.data || []).map(mapProductoDB);
    cache.presupuestos = (rPres.data || []).map(mapPresupuestoDB);
    cache.pedidos = (rPed.data || []).map(mapPedidoDB);
  }

  async function recargar(coleccion) {
    const c = sb();
    if (coleccion === "clientes") {
      const r = await c.from("clientes").select("*").order("numero_cliente");
      if (r.error) throw r.error;
      cache.clientes = (r.data || []).map(mapClienteDB);
    } else if (coleccion === "productos") {
      const r = await c.from("productos").select("*").order("referencia");
      if (r.error) throw r.error;
      cache.productos = (r.data || []).map(mapProductoDB);
    } else if (coleccion === "presupuestos") {
      const r = await c.from("presupuestos").select("*, presupuesto_items(*)").order("numero_presupuesto");
      if (r.error) throw r.error;
      cache.presupuestos = (r.data || []).map(mapPresupuestoDB);
    } else if (coleccion === "pedidos") {
      const r = await c.from("pedidos").select("*, pedido_items(*)").order("numero_pedido");
      if (r.error) throw r.error;
      cache.pedidos = (r.data || []).map(mapPedidoDB);
    }
  }

  /* ---------- Numeración segura vía RPC ---------- */
  async function siguienteNumero(kind, prefijo, digitos) {
    const c = sb();
    const { data, error } = await c.rpc("siguiente_numero", {
      p_kind: kind,
      p_prefijo: prefijo,
      p_digitos: digitos,
    });
    if (error) throw error;
    return data;
  }

  /* ---------- CRUD asíncrono ---------- */
  async function insertar(coleccion, doc) {
    const c = sb();

    if (coleccion === "clientes") {
      const payload = { ...clienteAppADB(doc), numero_cliente: doc.numero };
      const { data, error } = await c.from("clientes").insert(payload).select().single();
      if (error) throw error;
      const nuevo = mapClienteDB(data);
      cache.clientes.push(nuevo);
      return nuevo;
    }

    if (coleccion === "productos") {
      const payload = { ...productoAppADB(doc), referencia: doc.codigo };
      const { data, error } = await c.from("productos").insert(payload).select().single();
      if (error) throw error;
      const nuevo = mapProductoDB(data);
      cache.productos.push(nuevo);
      return nuevo;
    }

    if (coleccion === "presupuestos") {
      const cab = {
        numero_presupuesto: doc.numero,
        cliente_id: doc.cliente_id,
        fecha: doc.fecha,
        estado: doc.estado,
        observaciones: doc.observaciones || "",
        subtotal: doc.subtotal,
        iva: doc.iva,
        total: doc.total,
      };
      const rIns = await c.from("presupuestos").insert(cab).select().single();
      if (rIns.error) throw rIns.error;
      const items = (doc.lineas || []).map((l) => ({
        presupuesto_id: rIns.data.id,
        producto_id: l.producto_id,
        producto_codigo: l.producto_codigo,
        descripcion: l.producto_nombre,
        cantidad: l.cantidad,
        precio: l.precio,
        total: Math.round(l.cantidad * l.precio * 100) / 100,
      }));
      if (items.length) {
        const rItems = await c.from("presupuesto_items").insert(items);
        if (rItems.error) throw rItems.error;
      }
      await recargar("presupuestos");
      return obtener("presupuestos", rIns.data.id);
    }

    if (coleccion === "pedidos") {
      const cab = {
        numero_pedido: doc.numero,
        cliente_id: doc.cliente_id,
        presupuesto_id: doc.presupuesto_id || null,
        fecha: doc.fecha,
        estado: doc.estado,
        observaciones: doc.observaciones || "",
        subtotal: doc.subtotal,
        iva: doc.iva,
        total: doc.total,
      };
      const rIns = await c.from("pedidos").insert(cab).select().single();
      if (rIns.error) throw rIns.error;
      const items = (doc.lineas || []).map((l) => ({
        pedido_id: rIns.data.id,
        producto_id: l.producto_id,
        producto_codigo: l.producto_codigo,
        descripcion: l.producto_nombre,
        cantidad: l.cantidad,
        precio: l.precio,
        total: Math.round(l.cantidad * l.precio * 100) / 100,
      }));
      if (items.length) {
        const rItems = await c.from("pedido_items").insert(items);
        if (rItems.error) throw rItems.error;
      }
      await recargar("pedidos");
      return obtener("pedidos", rIns.data.id);
    }

    throw new Error("Colección no soportada: " + coleccion);
  }

  async function actualizar(coleccion, id, cambios) {
    const c = sb();

    if (coleccion === "clientes") {
      const payload = clienteAppADB({ ...obtener("clientes", id), ...cambios });
      const { data, error } = await c.from("clientes").update(payload).eq("id", id).select().single();
      if (error) throw error;
      const idx = cache.clientes.findIndex((x) => x.id === id);
      const actualizado = mapClienteDB(data);
      if (idx >= 0) cache.clientes[idx] = actualizado; else cache.clientes.push(actualizado);
      return actualizado;
    }

    if (coleccion === "productos") {
      const payload = productoAppADB({ ...obtener("productos", id), ...cambios });
      const { data, error } = await c.from("productos").update(payload).eq("id", id).select().single();
      if (error) throw error;
      const idx = cache.productos.findIndex((x) => x.id === id);
      const actualizado = mapProductoDB(data);
      if (idx >= 0) cache.productos[idx] = actualizado; else cache.productos.push(actualizado);
      return actualizado;
    }

    if (coleccion === "presupuestos") {
      // Si cambian líneas: reemplazamos ítems por completo.
      if (Array.isArray(cambios.lineas)) {
        const del = await c.from("presupuesto_items").delete().eq("presupuesto_id", id);
        if (del.error) throw del.error;
        const items = cambios.lineas.map((l) => ({
          presupuesto_id: id,
          producto_id: l.producto_id,
          producto_codigo: l.producto_codigo,
          descripcion: l.producto_nombre,
          cantidad: l.cantidad,
          precio: l.precio,
          total: Math.round(l.cantidad * l.precio * 100) / 100,
        }));
        if (items.length) {
          const ins = await c.from("presupuesto_items").insert(items);
          if (ins.error) throw ins.error;
        }
      }
      const cab = {};
      if (cambios.cliente_id !== undefined) cab.cliente_id = cambios.cliente_id;
      if (cambios.fecha !== undefined) cab.fecha = cambios.fecha;
      if (cambios.estado !== undefined) cab.estado = cambios.estado;
      if (cambios.observaciones !== undefined) cab.observaciones = cambios.observaciones || "";
      if (cambios.subtotal !== undefined) cab.subtotal = cambios.subtotal;
      if (cambios.iva !== undefined) cab.iva = cambios.iva;
      if (cambios.total !== undefined) cab.total = cambios.total;
      if (cambios.pedido_id !== undefined) cab.pedido_id = cambios.pedido_id;
      if (cambios.pedido_numero !== undefined) cab.pedido_numero = cambios.pedido_numero;
      if (Object.keys(cab).length) {
        const up = await c.from("presupuestos").update(cab).eq("id", id);
        if (up.error) throw up.error;
      }
      await recargar("presupuestos");
      return obtener("presupuestos", id);
    }

    if (coleccion === "pedidos") {
      if (Array.isArray(cambios.lineas)) {
        const del = await c.from("pedido_items").delete().eq("pedido_id", id);
        if (del.error) throw del.error;
        const items = cambios.lineas.map((l) => ({
          pedido_id: id,
          producto_id: l.producto_id,
          producto_codigo: l.producto_codigo,
          descripcion: l.producto_nombre,
          cantidad: l.cantidad,
          precio: l.precio,
          total: Math.round(l.cantidad * l.precio * 100) / 100,
        }));
        if (items.length) {
          const ins = await c.from("pedido_items").insert(items);
          if (ins.error) throw ins.error;
        }
      }
      const cab = {};
      if (cambios.cliente_id !== undefined) cab.cliente_id = cambios.cliente_id;
      if (cambios.presupuesto_id !== undefined) cab.presupuesto_id = cambios.presupuesto_id;
      if (cambios.fecha !== undefined) cab.fecha = cambios.fecha;
      if (cambios.estado !== undefined) cab.estado = cambios.estado;
      if (cambios.observaciones !== undefined) cab.observaciones = cambios.observaciones || "";
      if (cambios.subtotal !== undefined) cab.subtotal = cambios.subtotal;
      if (cambios.iva !== undefined) cab.iva = cambios.iva;
      if (cambios.total !== undefined) cab.total = cambios.total;
      if (Object.keys(cab).length) {
        const up = await c.from("pedidos").update(cab).eq("id", id);
        if (up.error) throw up.error;
      }
      await recargar("pedidos");
      return obtener("pedidos", id);
    }

    throw new Error("Colección no soportada: " + coleccion);
  }

  async function eliminar(coleccion, id) {
    const c = sb();
    const mapa = {
      clientes: "clientes",
      productos: "productos",
      presupuestos: "presupuestos",
      pedidos: "pedidos",
    };
    const tabla = mapa[coleccion];
    if (!tabla) throw new Error("Colección no soportada: " + coleccion);
    const { error } = await c.from(tabla).delete().eq("id", id);
    if (error) throw error;
    if (cache[coleccion]) cache[coleccion] = cache[coleccion].filter((x) => x.id !== id);
  }

  /* ---------- Limpieza de cache (logout) ---------- */
  function limpiar() {
    cache.clientes = [];
    cache.productos = [];
    cache.presupuestos = [];
    cache.pedidos = [];
  }

  return {
    leer,
    guardar,
    listar,
    obtener,
    insertar,
    actualizar,
    eliminar,
    siguienteNumero,
    cargarTodo,
    recargar,
    limpiar,
  };
})();

/* Cálculos y formateadores (idénticos a la versión previa) */
function calcularTotales(lineas) {
  const subtotal = lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precio), 0);
  const iva = subtotal * IVA;
  return {
    subtotal: redondear(subtotal),
    iva: redondear(iva),
    total: redondear(subtotal + iva),
  };
}
function redondear(n) { return Math.round(n * 100) / 100; }
function formatoMoneda(n) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
}
function formatoFecha(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES");
}
