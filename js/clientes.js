/* Módulo Clientes (Supabase) */
const Clientes = (() => {
  const COL = "clientes";

  function render() {
    const filtro = $("#buscar-clientes").value;
    const items = Almacen.listar(COL).filter((c) =>
      coincide(filtro, [c.numero, c.nombre, c.nif, c.telefono, c.email, c.poblacion])
    );
    const tbody = $("#tabla-clientes");
    tbody.innerHTML = items
      .map(
        (c) => `<tr data-id="${c.id}">
          <td class="mono">${escapar(c.numero)}</td>
          <td><strong>${escapar(c.nombre)}</strong></td>
          <td>${escapar(c.nif)}</td>
          <td>${escapar(c.telefono)}</td>
          <td>${escapar(c.email)}</td>
          <td>${escapar(c.poblacion)}</td>
        </tr>`
      )
      .join("");
    $("#vacio-clientes").classList.toggle("oculto", items.length > 0);
  }

  function formularioHTML(c = {}) {
    return `<form class="formulario" id="form-cliente">
      <div class="campo-fila">
        <label class="campo"><span>Nombre / Razón social *</span><input id="cli-nombre" required value="${escapar(c.nombre)}" /></label>
        <label class="campo"><span>NIF / CIF</span><input id="cli-nif" value="${escapar(c.nif)}" /></label>
      </div>
      <div class="campo-fila">
        <label class="campo"><span>Teléfono</span><input id="cli-telefono" value="${escapar(c.telefono)}" /></label>
        <label class="campo"><span>Email</span><input id="cli-email" type="email" value="${escapar(c.email)}" /></label>
      </div>
      <label class="campo"><span>Dirección</span><input id="cli-direccion" value="${escapar(c.direccion)}" /></label>
      <div class="campo-fila-3">
        <label class="campo"><span>Población</span><input id="cli-poblacion" value="${escapar(c.poblacion)}" /></label>
        <label class="campo"><span>Código postal</span><input id="cli-cp" value="${escapar(c.cp)}" /></label>
        <label class="campo"><span>Provincia</span><input id="cli-provincia" value="${escapar(c.provincia)}" /></label>
      </div>
      <label class="campo"><span>Observaciones</span><textarea id="cli-observaciones">${escapar(c.observaciones)}</textarea></label>
    </form>`;
  }

  function leerFormulario() {
    return {
      nombre: valorCampo("cli-nombre"),
      nif: valorCampo("cli-nif"),
      telefono: valorCampo("cli-telefono"),
      email: valorCampo("cli-email"),
      direccion: valorCampo("cli-direccion"),
      poblacion: valorCampo("cli-poblacion"),
      cp: valorCampo("cli-cp"),
      provincia: valorCampo("cli-provincia"),
      observaciones: valorCampo("cli-observaciones"),
    };
  }

  function abrirEditor(cliente = null) {
    const botones = [{ texto: "Cancelar", onClick: Modal.cerrar }];
    if (cliente) {
      botones.push({
        texto: "Eliminar", clase: "btn-peligro-suave", onClick: async () => {
          const ok = await Confirmar.pedir(`¿Eliminar el cliente ${cliente.numero} - ${cliente.nombre}?`);
          if (!ok) return;
          try {
            await Almacen.eliminar(COL, cliente.id);
            Modal.cerrar(); render(); toast("Cliente eliminado.", "exito");
          } catch (err) {
            toast("Error al eliminar: " + (err.message || err), "error");
          }
        },
      });
    }
    botones.push({
      texto: cliente ? "Guardar cambios" : "Crear cliente", clase: "btn-primario", onClick: async () => {
        const datos = leerFormulario();
        if (!datos.nombre) { toast("El nombre es obligatorio.", "error"); return; }
        try {
          if (cliente) {
            await Almacen.actualizar(COL, cliente.id, datos);
            toast("Cliente actualizado.", "exito");
          } else {
            datos.numero = await Almacen.siguienteNumero("clientes", "CLI-", 4);
            await Almacen.insertar(COL, datos);
            toast(`Cliente ${datos.numero} creado.`, "exito");
          }
          Modal.cerrar(); render();
        } catch (err) {
          toast("Error al guardar: " + (err.message || err), "error");
        }
      },
    });
    Modal.abrir({
      titulo: cliente ? `Cliente ${cliente.numero}` : "Nuevo cliente",
      cuerpoHTML: formularioHTML(cliente || {}),
      botones,
    });
    $("#form-cliente").addEventListener("submit", (e) => { e.preventDefault(); botones[botones.length - 1].onClick(); });
  }

  function iniciar() {
    $("#buscar-clientes").addEventListener("input", render);
    $("#btn-nuevo-cliente").addEventListener("click", () => abrirEditor());
    $("#tabla-clientes").addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (fila) abrirEditor(Almacen.obtener(COL, fila.dataset.id));
    });
  }

  return { iniciar, render };
})();
