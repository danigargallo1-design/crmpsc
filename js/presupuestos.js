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
 function descargarPDF() {
  const p = obtenerSeleccion("descargar el PDF");
  if (!p) return;

  const cliente = Almacen.obtener("clientes", p.cliente_id);

  if (!cliente) {
    toast("No se ha encontrado el cliente del presupuesto.", "error");
    return;
  }

  const ventana = window.open("", "_blank");

  if (!ventana) {
    toast("El navegador ha bloqueado la ventana del PDF.", "error");
    return;
  }

  const lineasHTML = (p.lineas || [])
    .map((linea) => {
      const cantidad = Number(linea.cantidad || 0);
      const precio = Number(linea.precio || 0);
      const importe = cantidad * precio;

      return `
        <tr>
          <td class="concepto">
            ${escaparPDF(linea.producto_nombre || "Servicio")}
          </td>

          <td class="cantidad">
            ${cantidad}
          </td>

          <td class="precio">
            ${formatoMonedaPDF(precio)}
          </td>

          <td class="importe">
            ${formatoMonedaPDF(importe)}
          </td>
        </tr>
      `;
    })
    .join("");

  const direccion = [
    cliente.direccion,
    cliente.cp,
    cliente.poblacion,
    cliente.provincia
  ]
    .filter(Boolean)
    .join(", ");

  const contacto = [
    cliente.telefono ? `Tel. ${cliente.telefono}` : "",
    cliente.email || ""
  ]
    .filter(Boolean)
    .join(" · ");

  const fecha = formatearFechaPDF(p.fecha);

  const html = `
<!DOCTYPE html>
<html lang="es">

<head>

  <meta charset="UTF-8">

  <title>
    Presupuesto ${escaparPDF(p.numero)} - HogarFix
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
    }

    body {
      background: #eef1f4;
      color: #18212b;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        Helvetica,
        sans-serif;
      font-size: 12px;
      line-height: 1.5;
    }

    /* =========================
       DOCUMENTO
       ========================= */

    .documento {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      background: #ffffff;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.10);
    }

    /* =========================
       CABECERA
       ========================= */

    .cabecera {
      padding: 30px 34px 26px;
      border-bottom: 3px solid #e5e9ed;

      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      gap: 30px;
    }

    .marca {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .logo {
      width: 155px;
      max-height: 65px;

      object-fit: contain;
      object-position: left center;

      margin-bottom: 12px;
    }

    .empresa-descripcion {
      color: #66727e;
      font-size: 11px;
      letter-spacing: 0.1px;
    }

    .cabecera-derecha {
      text-align: right;
      padding-top: 3px;
    }

    .documento-tipo {
      margin: 0;

      color: #17212b;

      font-size: 25px;
      line-height: 1;

      font-weight: 700;
      letter-spacing: -0.7px;
    }

    .documento-numero {
      margin-top: 9px;

      color: #68737e;

      font-size: 12px;
      font-weight: 500;
    }

    .documento-numero strong {
      color: #17212b;
    }

    /* =========================
       CONTENIDO
       ========================= */

    .contenido {
      padding: 30px 34px 34px;
    }

    /* =========================
       DATOS
       ========================= */

    .datos-grid {
      display: grid;

      grid-template-columns: 1fr 1fr;

      gap: 22px;
    }

    .datos-bloque {
      padding: 0 0 18px;

      border-bottom: 1px solid #e6eaee;
    }

    .datos-titulo {
      margin-bottom: 10px;

      color: #6c7782;

      font-size: 9px;
      font-weight: 700;

      letter-spacing: 1px;

      text-transform: uppercase;
    }

    .datos-principales {
      color: #17212b;

      font-size: 12px;

      line-height: 1.65;
    }

    .datos-principales strong {
      font-size: 13px;
      font-weight: 700;
    }

    .datos-secundarios {
      color: #64707b;
    }

    /* =========================
       INFORMACIÓN DOCUMENTO
       ========================= */

    .meta {
      display: grid;

      grid-template-columns: repeat(3, 1fr);

      margin-top: 24px;

      border: 1px solid #e1e6ea;

      border-radius: 6px;

      overflow: hidden;
    }

    .meta-item {
      padding: 13px 15px;

      border-right: 1px solid #e1e6ea;
    }

    .meta-item:last-child {
      border-right: none;
    }

    .meta-label {
      display: block;

      margin-bottom: 3px;

      color: #78838d;

      font-size: 8px;
      font-weight: 700;

      text-transform: uppercase;

      letter-spacing: 0.8px;
    }

    .meta-value {
      color: #17212b;

      font-size: 11px;
      font-weight: 600;
    }

    .estado {
      display: inline-block;

      padding: 3px 8px;

      border-radius: 999px;

      background: #f1f4f6;
      color: #44515d;

      font-size: 9px;
      font-weight: 700;

      text-transform: uppercase;
    }

    /* =========================
       CONCEPTOS
       ========================= */

    .seccion {
      margin-top: 32px;
    }

    .seccion-titulo {
      margin: 0 0 11px;

      color: #17212b;

      font-size: 11px;
      font-weight: 700;

      letter-spacing: 0.7px;

      text-transform: uppercase;
    }

    .tabla-lineas {
      width: 100%;

      border-collapse: collapse;

      border: 1px solid #dfe4e8;

      border-radius: 6px;

      overflow: hidden;
    }

    .tabla-lineas thead {
      background: #f4f6f7;
    }

    .tabla-lineas th {
      padding: 10px 11px;

      color: #596571;

      border-bottom: 1px solid #dfe4e8;

      font-size: 8.5px;
      font-weight: 700;

      letter-spacing: 0.5px;

      text-align: left;

      text-transform: uppercase;
    }

    .tabla-lineas td {
      padding: 12px 11px;

      color: #27323c;

      border-bottom: 1px solid #edf0f2;

      font-size: 11px;

      vertical-align: middle;
    }

    .tabla-lineas tbody tr {
      page-break-inside: avoid;
    }

    .tabla-lineas tbody tr:last-child td {
      border-bottom: none;
    }

    .tabla-lineas .concepto {
      width: 58%;

      font-weight: 500;
    }

    .tabla-lineas .cantidad {
      width: 12%;

      text-align: center;
    }

    .tabla-lineas .precio {
      width: 15%;

      text-align: right;

      white-space: nowrap;
    }

    .tabla-lineas .importe {
      width: 15%;

      text-align: right;

      white-space: nowrap;

      font-weight: 600;
    }

    /* =========================
       TOTALES
       ========================= */

    .totales-wrapper {
      display: flex;

      justify-content: flex-end;

      margin-top: 20px;
    }

    .totales {
      width: 285px;
    }

    .total-linea {
      display: flex;

      justify-content: space-between;

      padding: 5px 0;

      color: #596571;

      font-size: 11px;
    }

    .total-linea .valor {
      color: #27323c;

      font-weight: 600;
    }

    .total-final {
      display: flex;

      justify-content: space-between;

      align-items: baseline;

      margin-top: 8px;

      padding: 13px 0 0;

      border-top: 2px solid #17212b;

      color: #17212b;
    }

    .total-final .texto {
      font-size: 12px;

      font-weight: 700;

      text-transform: uppercase;

      letter-spacing: 0.4px;
    }

    .total-final .valor {
      font-size: 19px;

      font-weight: 800;

      letter-spacing: -0.4px;
    }

    /* =========================
       OBSERVACIONES
       ========================= */

    .observaciones {
      margin-top: 32px;

      padding: 15px 17px;

      background: #f7f8f9;

      border-left: 3px solid #d7dde2;

      page-break-inside: avoid;
    }

    .observaciones-titulo {
      margin-bottom: 6px;

      color: #17212b;

      font-size: 9px;
      font-weight: 700;

      letter-spacing: 0.8px;

      text-transform: uppercase;
    }

    .observaciones-texto {
      color: #5d6873;

      font-size: 11px;

      white-space: pre-line;
    }

    /* =========================
       CONDICIONES
       ========================= */

    .condiciones {
      margin-top: 30px;

      padding-top: 18px;

      border-top: 1px solid #e1e6ea;

      page-break-inside: avoid;
    }

    .condiciones-titulo {
      margin-bottom: 9px;

      color: #17212b;

      font-size: 9px;
      font-weight: 700;

      letter-spacing: 0.8px;

      text-transform: uppercase;
    }

    .condiciones ul {
      margin: 0;

      padding-left: 17px;

      color: #68737e;

      font-size: 10px;

      line-height: 1.65;
    }

    .condiciones li {
      padding-left: 3px;
    }

    /* =========================
       PIE
       ========================= */

    .pie {
      margin-top: 34px;

      padding-top: 14px;

      border-top: 1px solid #e1e6ea;

      display: flex;

      justify-content: space-between;

      gap: 20px;

      color: #7b858e;

      font-size: 9px;

      line-height: 1.5;
    }

    .pie-izquierda {
      text-align: left;
    }

    .pie-derecha {
      text-align: right;
    }

    /* =========================
       IMPRESIÓN
       ========================= */

    @page {
      size: A4;
      margin: 12mm;
    }

    @media print {

      body {
        background: #ffffff;
      }

      .documento {
        width: auto;

        min-height: auto;

        margin: 0;

        box-shadow: none;
      }

      .cabecera {
        padding-top: 8px;
      }

      .contenido {
        padding-bottom: 10px;
      }

    }

  </style>

</head>

<body>

  <div class="documento">

    <!-- CABECERA -->

    <header class="cabecera">

      <div class="marca">

        <img
          src="${window.location.origin}/assets/logo.png"
          class="logo"
          alt="HogarFix"
        >

        <div class="empresa-descripcion">
          Soluciones integrales de reformas y mantenimiento
        </div>

      </div>

      <div class="cabecera-derecha">

        <h1 class="documento-tipo">
          PRESUPUESTO
        </h1>

        <div class="documento-numero">
          Nº <strong>${escaparPDF(p.numero)}</strong>
        </div>

      </div>

    </header>


    <!-- CONTENIDO -->

    <main class="contenido">


      <!-- DATOS DEL PRESTADOR Y CLIENTE -->

      <section class="datos-grid">

        <div class="datos-bloque">

          <div class="datos-titulo">
            Datos del prestador
          </div>

          <div class="datos-principales">

            <strong>
              HogarFix Servicios S.L.
            </strong>

            <div class="datos-secundarios">

              CIF: B-12345678<br>

              Calle Mayor 45, Local 2<br>

              50001 Zaragoza, España<br>

              contacto@example.com

            </div>

          </div>

        </div>


        <div class="datos-bloque">

          <div class="datos-titulo">
            Datos del cliente
          </div>

          <div class="datos-principales">

            <strong>
              ${escaparPDF(cliente.nombre)}
            </strong>

            <div class="datos-secundarios">

              ${
                cliente.nif
                  ? `DNI/CIF: ${escaparPDF(cliente.nif)}<br>`
                  : ""
              }

              ${
                direccion
                  ? `${escaparPDF(direccion)}<br>`
                  : ""
              }

              ${
                contacto
                  ? escaparPDF(contacto)
                  : ""
              }

            </div>

          </div>

        </div>

      </section>


      <!-- INFORMACIÓN DEL DOCUMENTO -->

      <section class="meta">

        <div class="meta-item">

          <span class="meta-label">
            Fecha de emisión
          </span>

          <span class="meta-value">
            ${fecha}
          </span>

        </div>


        <div class="meta-item">

          <span class="meta-label">
            Validez
          </span>

          <span class="meta-value">
            30 días naturales
          </span>

        </div>


        <div class="meta-item">

          <span class="meta-label">
            Estado
          </span>

          <span class="estado">
            ${escaparPDF(p.estado || "Pendiente")}
          </span>

        </div>

      </section>


      <!-- CONCEPTOS -->

      <section class="seccion">

        <h2 class="seccion-titulo">
          Conceptos del presupuesto
        </h2>


        <table class="tabla-lineas">

          <thead>

            <tr>

              <th>
                Concepto
              </th>

              <th style="text-align: center;">
                Cant.
              </th>

              <th style="text-align: right;">
                Precio
              </th>

              <th style="text-align: right;">
                Importe
              </th>

            </tr>

          </thead>


          <tbody>

            ${lineasHTML}

          </tbody>

        </table>

      </section>


      <!-- TOTALES -->

      <section class="totales-wrapper">

        <div class="totales">

          <div class="total-linea">

            <span>
              Subtotal
            </span>

            <span class="valor">
              ${formatoMonedaPDF(p.subtotal)}
            </span>

          </div>


          <div class="total-linea">

            <span>
              IVA (21 %)
            </span>

            <span class="valor">
              ${formatoMonedaPDF(p.iva)}
            </span>

          </div>


          <div class="total-final">

            <span class="texto">
              Total
            </span>

            <span class="valor">
              ${formatoMonedaPDF(p.total)}
            </span>

          </div>

        </div>

      </section>


      <!-- OBSERVACIONES -->

      ${
        p.observaciones
          ? `
            <section class="observaciones">

              <div class="observaciones-titulo">
                Observaciones
              </div>

              <div class="observaciones-texto">
                ${escaparPDF(p.observaciones)}
              </div>

            </section>
          `
          : ""
      }


      <!-- CONDICIONES -->

      <section class="condiciones">

        <div class="condiciones-titulo">
          Condiciones comerciales y de pago
        </div>


        <ul>

          <li>
            <strong>Forma de pago:</strong>
            A convenir según acuerdo entre las partes.
          </li>

          <li>
            <strong>Plazo de ejecución:</strong>
            A determinar según disponibilidad y alcance definitivo del proyecto.
          </li>

          <li>
            <strong>Garantía:</strong>
            3 años de garantía en instalaciones conforme a la legislación vigente.
          </li>

        </ul>

      </section>


      <!-- PIE -->

      <footer class="pie">

        <div class="pie-izquierda">

          HogarFix Servicios S.L.<br>

          Soluciones integrales de reformas y mantenimiento

        </div>


        <div class="pie-derecha">

          Presupuesto ${escaparPDF(p.numero)}<br>

          Documento generado digitalmente

        </div>

      </footer>


    </main>

  </div>


  <script>

    window.onload = function () {

      setTimeout(function () {

        window.print();

      }, 600);

    };

  <\/script>

</body>

</html>
`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}


function escaparPDF(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatoMonedaPDF(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " €";
}


function formatearFechaPDF(fecha) {
  if (!fecha) return "";

  const partes = String(fecha).split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
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
    $("#btn-descargar-presupuesto").addEventListener("click", descargarPDF);
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
