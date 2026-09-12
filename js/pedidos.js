/* Módulo Pedidos (Supabase) */
const Pedidos = (() => {
  const COL = "pedidos";
  const ESTADOS = ["Pendiente", "En proceso", "Completado", "Cancelado"];
  let seleccionado = null;

  function render() {
    const filtro = $("#buscar-pedidos").value;
    const items = Almacen.listar(COL)
      .slice()
      .reverse()
      .filter((p) => coincide(filtro, [p.numero, p.cliente_numero, p.cliente_nombre, p.estado, p.presupuesto_numero, formatoFecha(p.fecha)]));
    $("#tabla-pedidos").innerHTML = items
      .map(
        (p) => `<tr data-id="${p.id}" class="${p.id === seleccionado ? "seleccionada" : ""}">
          <td class="mono">${escapar(p.numero)}</td>
          <td>${formatoFecha(p.fecha)}</td>
          <td><strong>${escapar(p.cliente_nombre)}</strong> <span class="mono">${escapar(p.cliente_numero)}</span></td>
          <td class="mono">${p.presupuesto_numero ? escapar(p.presupuesto_numero) : "Manual"}</td>
          <td class="col-der mono">${formatoMoneda(p.subtotal)}</td>
          <td class="col-der mono">${formatoMoneda(p.iva)}</td>
          <td class="col-der mono"><strong>${formatoMoneda(p.total)}</strong></td>
          <td>${badgeEstado(p.estado)}</td>
        </tr>`
      )
      .join("");
    $("#vacio-pedidos").classList.toggle("oculto", items.length > 0);
    if (seleccionado && !Almacen.obtener(COL, seleccionado)) seleccionado = null;
  }

  function obtenerSeleccion(accion) {
    const p = seleccionado ? Almacen.obtener(COL, seleccionado) : null;
    if (!p) toast(`Selecciona un pedido de la lista para ${accion}.`, "aviso");
    return p;
  }

  function nuevo() {
    EditorDocumento.abrir({
      titulo: "Nuevo pedido",
      doc: {},
      estados: ESTADOS,
      onGuardar: async (datos) => {
        try {
          datos.numero = await Almacen.siguienteNumero("pedidos", "PED-", 4);
          const creado = await Almacen.insertar(COL, datos);
          seleccionado = creado.id;
          render();
          toast(`Pedido ${datos.numero} creado.`, "exito");
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
      titulo: `Pedido ${p.numero}${p.presupuesto_numero ? " · origen " + p.presupuesto_numero : ""}`,
      doc: p,
      estados: ESTADOS,
      onGuardar: async (datos) => {
        try {
          await Almacen.actualizar(COL, p.id, datos);
          render();
          toast("Pedido actualizado.", "exito");
        } catch (err) {
          toast("Error al guardar: " + (err.message || err), "error");
        }
      },
    });
  }

  async function eliminar() {
    const p = obtenerSeleccion("eliminarlo");
    if (!p) return;
    const ok = await Confirmar.pedir(`¿Eliminar el pedido ${p.numero} de ${p.cliente_nombre}?`);
    if (!ok) return;
    try {
      await Almacen.eliminar(COL, p.id);
      if (p.presupuesto_id) {
        await Almacen.actualizar("presupuestos", p.presupuesto_id, { pedido_id: null, pedido_numero: null });
      }
      seleccionado = null;
      render();
      Presupuestos.render();
      toast("Pedido eliminado.", "exito");
    } catch (err) {
      toast("Error al eliminar: " + (err.message || err), "error");
    }
  }

  function iniciar() {
    $("#buscar-pedidos").addEventListener("input", render);
    $("#btn-nuevo-pedido").addEventListener("click", nuevo);
    $("#btn-modificar-pedido").addEventListener("click", modificar);
    $("#btn-eliminar-pedido").addEventListener("click", eliminar);
    $("#tabla-pedidos").addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (!fila) return;
      seleccionado = seleccionado === fila.dataset.id ? null : fila.dataset.id;
      render();
    });
    $("#tabla-pedidos").addEventListener("dblclick", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (!fila) return;
      seleccionado = fila.dataset.id;
      modificar();
    });
  }

  return { iniciar, render };
})();
