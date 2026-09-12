/* Editor compartido de presupuestos y pedidos */
const EditorDocumento = (() => {
  let estado = null;

  function opcionesClientes(sel) {
    return Almacen.listar("clientes")
      .map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${escapar(c.numero)} - ${escapar(c.nombre)}</option>`)
      .join("");
  }
  function opcionesProductos() {
    return Almacen.listar("productos")
      .map((p) => `<option value="${p.id}">${escapar(p.codigo)} - ${escapar(p.nombre)} (${formatoMoneda(p.precio)})</option>`)
      .join("");
  }

  function html(doc, estados) {
    return `<div class="formulario">
      <div class="campo-fila">
        <label class="campo"><span>Cliente *</span>
          <select id="doc-cliente"><option value="">— Selecciona un cliente —</option>${opcionesClientes(doc.cliente_id)}</select>
        </label>
        <div class="campo-fila">
          <label class="campo"><span>Fecha</span><input type="date" id="doc-fecha" value="${doc.fecha}" /></label>
          <label class="campo"><span>Estado</span>
            <select id="doc-estado">${estados.map((e) => `<option ${e === doc.estado ? "selected" : ""}>${e}</option>`).join("")}</select>
          </label>
        </div>
      </div>
      <div class="doc-cliente" id="doc-cliente-info"></div>

      <p class="seccion-titulo">Líneas</p>
      <div class="doc-anadir">
        <label class="campo"><span>Producto</span>
          <select id="doc-producto"><option value="">— Selecciona un producto —</option>${opcionesProductos()}</select>
        </label>
        <label class="campo campo-cantidad"><span>Cantidad</span><input type="number" id="doc-cantidad" min="1" step="1" value="1" /></label>
        <button type="button" class="btn" id="doc-anadir-linea">Añadir línea</button>
      </div>
      <div class="doc-lineas">
        <table>
          <thead><tr>
            <th style="width:90px">Código</th><th>Producto</th>
            <th style="width:90px" class="col-der">Cantidad</th><th style="width:120px" class="col-der">Precio</th>
            <th style="width:120px" class="col-der">Importe</th><th style="width:40px"></th>
          </tr></thead>
          <tbody id="doc-lineas"></tbody>
        </table>
      </div>

      <label class="campo"><span>Observaciones</span><textarea id="doc-observaciones">${escapar(doc.observaciones)}</textarea></label>

      <div class="doc-totales"><table>
        <tr><td>Subtotal</td><td id="doc-subtotal"></td></tr>
        <tr><td>IVA 21 %</td><td id="doc-iva"></td></tr>
        <tr class="total"><td>Total</td><td id="doc-total"></td></tr>
      </table></div>
    </div>`;
  }

  function renderCliente() {
    const c = Almacen.obtener("clientes", $("#doc-cliente").value);
    const el = $("#doc-cliente-info");
    if (!c) { el.classList.add("oculto"); return; }
    el.classList.remove("oculto");
    el.innerHTML = `
      <div><strong>${escapar(c.nombre)}</strong> · ${escapar(c.nif || "sin NIF")}</div>
      <div>${escapar(c.telefono || "")} ${c.email ? "· " + escapar(c.email) : ""}</div>
      <div>${escapar([c.direccion, c.cp, c.poblacion, c.provincia].filter(Boolean).join(", "))}</div>`;
  }

  function renderLineas() {
    const tbody = $("#doc-lineas");
    if (!estado.lineas.length) {
      tbody.innerHTML = `<tr class="vacio"><td colspan="6">Sin líneas. Añade productos al documento.</td></tr>`;
    } else {
      tbody.innerHTML = estado.lineas
        .map(
          (l, i) => `<tr>
            <td class="mono">${escapar(l.producto_codigo)}</td>
            <td>${escapar(l.producto_nombre)}</td>
            <td><input type="number" min="1" step="1" data-idx="${i}" data-campo="cantidad" value="${l.cantidad}" /></td>
            <td><input type="number" min="0" step="0.01" data-idx="${i}" data-campo="precio" value="${l.precio}" /></td>
            <td class="col-der mono">${formatoMoneda(l.cantidad * l.precio)}</td>
            <td><button type="button" class="btn-icono" data-quitar="${i}" title="Quitar">&times;</button></td>
          </tr>`
        )
        .join("");
    }
    const t = calcularTotales(estado.lineas);
    $("#doc-subtotal").textContent = formatoMoneda(t.subtotal);
    $("#doc-iva").textContent = formatoMoneda(t.iva);
    $("#doc-total").textContent = formatoMoneda(t.total);
  }

  function enlazar() {
    $("#doc-cliente").addEventListener("change", renderCliente);
    $("#doc-anadir-linea").addEventListener("click", () => {
      const p = Almacen.obtener("productos", $("#doc-producto").value);
      const cantidad = parseInt($("#doc-cantidad").value, 10);
      if (!p) { toast("Selecciona un producto.", "aviso"); return; }
      if (!cantidad || cantidad < 1) { toast("La cantidad debe ser al menos 1.", "aviso"); return; }
      const existente = estado.lineas.find((l) => l.producto_id === p.id);
      if (existente) existente.cantidad += cantidad;
      else estado.lineas.push({ producto_id: p.id, producto_codigo: p.codigo, producto_nombre: p.nombre, cantidad, precio: Number(p.precio) });
      $("#doc-producto").value = ""; $("#doc-cantidad").value = 1;
      renderLineas();
    });
    $("#doc-lineas").addEventListener("input", (e) => {
      const inp = e.target.closest("input[data-idx]");
      if (!inp) return;
      const l = estado.lineas[Number(inp.dataset.idx)];
      const v = parseFloat(inp.value);
      if (isNaN(v)) return;
      l[inp.dataset.campo] = inp.dataset.campo === "cantidad" ? Math.max(1, Math.round(v)) : Math.max(0, v);
      const t = calcularTotales(estado.lineas);
      inp.closest("tr").children[4].textContent = formatoMoneda(l.cantidad * l.precio);
      $("#doc-subtotal").textContent = formatoMoneda(t.subtotal);
      $("#doc-iva").textContent = formatoMoneda(t.iva);
      $("#doc-total").textContent = formatoMoneda(t.total);
    });
    $("#doc-lineas").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quitar]");
      if (!btn) return;
      estado.lineas.splice(Number(btn.dataset.quitar), 1);
      renderLineas();
    });
  }

  function leer() {
    const cliente = Almacen.obtener("clientes", $("#doc-cliente").value);
    if (!cliente) throw new Error("Selecciona un cliente.");
    if (!estado.lineas.length) throw new Error("Añade al menos una línea.");
    return {
      cliente_id: cliente.id,
      cliente_numero: cliente.numero,
      cliente_nombre: cliente.nombre,
      fecha: $("#doc-fecha").value || new Date().toISOString().slice(0, 10),
      estado: $("#doc-estado").value,
      observaciones: valorCampo("doc-observaciones"),
      lineas: estado.lineas.map((l) => ({ ...l })),
      ...calcularTotales(estado.lineas),
    };
  }

  /* abrir({ titulo, doc, estados, onGuardar(datos), extraBotones }) */
  function abrir({ titulo, doc, estados, onGuardar, extraBotones = [] }) {
    if (!Almacen.listar("clientes").length) { toast("Primero crea al menos un cliente.", "aviso"); return; }
    if (!Almacen.listar("productos").length) { toast("Primero crea al menos un producto.", "aviso"); return; }
    const base = {
      cliente_id: "", fecha: new Date().toISOString().slice(0, 10), estado: estados[0],
      observaciones: "", lineas: [], ...doc,
    };
    estado = { lineas: base.lineas.map((l) => ({ ...l })) };

    Modal.abrir({
      titulo,
      cuerpoHTML: html(base, estados),
      botones: [
        { texto: "Cancelar", onClick: Modal.cerrar },
        ...extraBotones,
        {
          texto: "Guardar", clase: "btn-primario", onClick: () => {
            try { onGuardar(leer()); Modal.cerrar(); }
            catch (err) { toast(err.message, "error"); }
          },
        },
      ],
    });
    enlazar();
    renderCliente();
    renderLineas();
  }

  return { abrir };
})();
