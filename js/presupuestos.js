/* Módulo Presupuestos (Supabase) */
const Presupuestos = (() => {
  const COL = "presupuestos";
  const ESTADOS = ["Pendiente", "Aceptado", "Rechazado"];
  let seleccionado = null;

  function render() {
    const filtro = $("#buscar-presupuestos").value;
    const items = Almacen.listar(COL)
      .slice()
      .reverse()
      .filter((p) => coincide(filtro, [p.numero, p.cliente_numero, p.cliente_nombre, p.estado, formatoFecha(p.fecha)]));
    $("#tabla-presupuestos").innerHTML = items
      .map(
        (p) => `<tr data-id="${p.id}" class="${p.id === seleccionado ? "seleccionada" : ""}">
          <td class="mono">${escapar(p.numero)}</td>
          <td>${formatoFecha(p.fecha)}</td>
          <td><strong>${escapar(p.cliente_nombre)}</strong> <span class="mono">${escapar(p.cliente_numero)}</span></td>
          <td class="col-der mono">${formatoMoneda(p.subtotal)}</td>
          <td class="col-der mono">${formatoMoneda(p.iva)}</td>
          <td class="col-der mono"><strong>${formatoMoneda(p.total)}</strong></td>
          <td>${badgeEstado(p.estado)}</td>
        </tr>`
      )
      .join("");
    $("#vacio-presupuestos").classList.toggle("oculto", items.length > 0);
    actualizarBotones();
  }

  function actualizarBotones() {
    const p = seleccionado ? Almacen.obtener(COL, seleccionado) : null;
    if (!p) seleccionado = null;
    $("#btn-convertir-presupuesto").classList.toggle("oculto", !(p && p.estado === "Aceptado" && !p.pedido_id));
  }

  function obtenerSeleccion(accion) {
    const p = seleccionado ? Almacen.obtener(COL, seleccionado) : null;
    if (!p) toast(`Selecciona un presupuesto de la lista para ${accion}.`, "aviso");
    return p;
  }

  function nuevo() {
    EditorDocumento.abrir({
      titulo: "Nuevo presupuesto",
      doc: {},
      estados: ESTADOS,
      onGuardar: async (datos) => {
        try {
          datos.numero = await Almacen.siguienteNumero("presupuestos", "PRE-", 4);
          const creado = await Almacen.insertar(COL, datos);
          seleccionado = creado.id;
          render();
          toast(`Presupuesto ${datos.numero} creado.`, "exito");
        } catch (err) {
          toast("Error al guardar: " + (err.message || err), "error");
        }
      },
    });
  }

  function modificar() {
    const p = obtenerSeleccion("modificarlo");
    if (!p) return;
    EditorDocumento.abrir({
      titulo: `Presupuesto ${p.numero}`,
      doc: p,
      estados: ESTADOS,
      onGuardar: async (datos) => {
        try {
          await Almacen.actualizar(COL, p.id, datos);
          render();
          toast("Presupuesto actualizado.", "exito");
        } catch (err) {
          toast("Error al guardar: " + (err.message || err), "error");
        }
      },
    });
  }

  async function eliminar() {
    const p = obtenerSeleccion("eliminarlo");
    if (!p) return;
    const ok = await Confirmar.pedir(`¿Eliminar el presupuesto ${p.numero} de ${p.cliente_nombre}?`);
    if (!ok) return;
    try {
      await Almacen.eliminar(COL, p.id);
      seleccionado = null;
      render();
      toast("Presupuesto eliminado.", "exito");
    } catch (err) {
      toast("Error al eliminar: " + (err.message || err), "error");
    }
  }

  async function convertir() {
    const p = obtenerSeleccion("convertirlo");
    if (!p) return;
    if (p.estado !== "Aceptado") { toast("Solo se pueden convertir presupuestos aceptados.", "aviso"); return; }
    if (p.pedido_id) { toast("Este presupuesto ya fue convertido en pedido.", "aviso"); return; }
    try {
      const numero = await Almacen.siguienteNumero("pedidos", "PED-", 4);
      const pedido = await Almacen.insertar("pedidos", {
        numero,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "Pendiente",
        cliente_id: p.cliente_id,
        cliente_numero: p.cliente_numero,
        cliente_nombre: p.cliente_nombre,
        observaciones: p.observaciones,
        lineas: p.lineas.map((l) => ({ ...l })),
        subtotal: p.subtotal, iva: p.iva, total: p.total,
        presupuesto_id: p.id, presupuesto_numero: p.numero,
      });
      await Almacen.actualizar(COL, p.id, { pedido_id: pedido.id, pedido_numero: numero });
      render();
      Pedidos.render();
      toast(`Pedido ${numero} creado a partir de ${p.numero}.`, "exito");
    } catch (err) {
      toast("Error al convertir: " + (err.message || err), "error");
    }
  }

  function iniciar() {
    $("#buscar-presupuestos").addEventListener("input", render);
    $("#btn-nuevo-presupuesto").addEventListener("click", nuevo);
    $("#btn-modificar-presupuesto").addEventListener("click", modificar);
    $("#btn-eliminar-presupuesto").addEventListener("click", eliminar);
    $("#btn-convertir-presupuesto").addEventListener("click", convertir);
    $("#tabla-presupuestos").addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (!fila) return;
      seleccionado = seleccionado === fila.dataset.id ? null : fila.dataset.id;
      render();
    });
    $("#tabla-presupuestos").addEventListener("dblclick", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (!fila) return;
      seleccionado = fila.dataset.id;
      modificar();
    });
  }

  return { iniciar, render };
})();
