/* Módulo Productos (Supabase) */
const Productos = (() => {
  const COL = "productos";

  function render() {
    const filtro = $("#buscar-productos").value;
    const items = Almacen.listar(COL).filter((p) => coincide(filtro, [p.codigo, p.nombre, p.descripcion]));
    $("#tabla-productos").innerHTML = items
      .map(
        (p) => `<tr data-id="${p.id}">
          <td class="mono">${escapar(p.codigo)}</td>
          <td><strong>${escapar(p.nombre)}</strong></td>
          <td>${escapar(p.descripcion)}</td>
          <td class="col-der mono">${formatoMoneda(p.precio)}</td>
          <td class="col-der mono">${formatoMoneda(p.precio * (1 + IVA))}</td>
        </tr>`
      )
      .join("");
    $("#vacio-productos").classList.toggle("oculto", items.length > 0);
  }

  function formularioHTML(p = {}) {
    return `<form class="formulario" id="form-producto">
      <div class="campo-fila">
        <label class="campo"><span>Nombre *</span><input id="pro-nombre" required value="${escapar(p.nombre)}" /></label>
        <label class="campo"><span>Precio sin IVA (€) *</span><input id="pro-precio" type="number" step="0.01" min="0" required value="${p.precio ?? ""}" /></label>
      </div>
      <label class="campo"><span>Descripción</span><textarea id="pro-descripcion">${escapar(p.descripcion)}</textarea></label>
      <p class="subtitulo">El IVA aplicado es siempre del 21 %.</p>
    </form>`;
  }

  function abrirEditor(producto = null) {
    const botones = [{ texto: "Cancelar", onClick: Modal.cerrar }];
    if (producto) {
      botones.push({
        texto: "Eliminar", clase: "btn-peligro-suave", onClick: async () => {
          const ok = await Confirmar.pedir(`¿Eliminar el producto ${producto.codigo} - ${producto.nombre}?`);
          if (!ok) return;
          try {
            await Almacen.eliminar(COL, producto.id);
            Modal.cerrar(); render(); toast("Producto eliminado.", "exito");
          } catch (err) {
            toast("Error al eliminar: " + (err.message || err), "error");
          }
        },
      });
    }
    botones.push({
      texto: producto ? "Guardar cambios" : "Crear producto", clase: "btn-primario", onClick: async () => {
        const datos = {
          nombre: valorCampo("pro-nombre"),
          precio: parseFloat(valorCampo("pro-precio")),
          descripcion: valorCampo("pro-descripcion"),
        };
        if (!datos.nombre) { toast("El nombre es obligatorio.", "error"); return; }
        if (isNaN(datos.precio) || datos.precio < 0) { toast("Indica un precio válido.", "error"); return; }
        try {
          if (producto) {
            await Almacen.actualizar(COL, producto.id, datos);
            toast("Producto actualizado.", "exito");
          } else {
            datos.codigo = await Almacen.siguienteNumero("productos", "P-", 4);
            await Almacen.insertar(COL, datos);
            toast(`Producto ${datos.codigo} creado.`, "exito");
          }
          Modal.cerrar(); render();
        } catch (err) {
          toast("Error al guardar: " + (err.message || err), "error");
        }
      },
    });
    Modal.abrir({
      titulo: producto ? `Producto ${producto.codigo}` : "Nuevo producto",
      cuerpoHTML: formularioHTML(producto || {}),
      botones,
    });
    $("#form-producto").addEventListener("submit", (e) => { e.preventDefault(); botones[botones.length - 1].onClick(); });
  }

  function iniciar() {
    $("#buscar-productos").addEventListener("input", render);
    $("#btn-nuevo-producto").addEventListener("click", () => abrirEditor());
    $("#tabla-productos").addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (fila) abrirEditor(Almacen.obtener(COL, fila.dataset.id));
    });
  }

  return { iniciar, render };
})();
