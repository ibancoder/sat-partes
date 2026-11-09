import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Cliente = {
  nombre?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
};

type Jornada = {
  fecha: string;
  horas: number;
  notas?: string | null;
};

type Material = {
  descripcion: string;
  cantidad: number;
  unidad?: string | null;
};

type PartePDF = {
  numero: string | number;
  cliente?: Cliente | null;
  direccion_intervencion?: string;
  tecnico?: string;
  descripcion?: string;
  estado?: string;
  fecha_creacion?: string;
  fecha_cierre?: string | null;
  jornadas: Jornada[];
  materiales: Material[];
  firmaTecnico?: string | null;
  firmaCliente?: string | null;
};

function fechaBonita(fecha?: string | null) {
  if (!fecha) return "";

  const fechaLimpia = fecha.slice(0, 10); // Eliminar la parte de la hora si está presente
  const partes = fechaLimpia.split("-");

  if (partes.length !== 3) return "";

  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}
export function generarPartePDF(parte: PartePDF) {
  const pdf = new jsPDF();
  const ancho = pdf.internal.pageSize.getWidth();
  const margen = 12;
  let y = 10;

  // Colores corporativos
  const azul = [15, 53, 91] as [number, number, number];
  const azulClaro = [222, 233, 246] as [number, number, number];

  // Encabezado
  pdf.setTextColor(...azul);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text("TELETECNICS S.L.", margen, y + 5);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "italic");
  pdf.text("Tecnología del Transporte Interior", margen, y + 11);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    "C/ Àliga, 39 · 08290 Cerdanyola del Vallès (Barcelona)",
    110,
    y + 2,
  );
  pdf.text("Tel. 93 580 87 10 teletecnics@teletecnics.com", 110, y + 7);
  //pdf.text("teletecnics@teletecnics.com", 110, y + 12);

  y += 21;
  pdf.setDrawColor(0, 105, 175);
  pdf.setLineWidth(0.8);
  pdf.line(margen, y, ancho - margen, y);

  // Título
  y += 10;
  pdf.setFillColor(...azul);
  pdf.roundedRect(margen, y - 6, ancho - margen * 2, 15, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("PARTE DE TRABAJO", margen + 5, y + 4);
  pdf.setFontSize(12);
  pdf.text(`N.º ${parte.numero}`, ancho - margen - 5, y + 4, {
    align: "right",
  });

  y += 20;

  // Función para los títulos de sección
  function seccion(titulo: string) {
    pdf.setFillColor(...azul);
    pdf.roundedRect(margen, y, ancho - margen * 2, 8, 1.5, 1.5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(titulo.toUpperCase(), margen + 4, y + 5.5);
    y += 12;
  }

  function linea(etiqueta: string, valor?: string | number | null) {
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(etiqueta, margen + 3, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(valor ?? "—"), margen + 38, y);
    y += 5;
  }

  // Datos del cliente
  seccion("Datos del cliente");
  linea("Nombre:", parte.cliente?.nombre);
  linea("Dirección:", parte.cliente?.direccion);
  linea("Teléfono:", parte.cliente?.telefono);
  linea("Email:", parte.cliente?.email);

  y += 3;

  // Datos de intervención
  seccion("Datos de la intervención");
  linea("Dirección:", parte.direccion_intervencion);
  linea("Técnico:", parte.tecnico);
  linea("Fecha creación:", fechaBonita(parte.fecha_creacion));
  linea("Estado:", parte.estado);

  y += 3;

  // Trabajos realizados
  seccion("Trabajos realizados");
  pdf.setTextColor(30, 30, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const descripcion = pdf.splitTextToSize(
    parte.descripcion || "Sin descripción",
    ancho - margen * 2 - 6,
  );
  pdf.text(descripcion, margen + 3, y);
  y += descripcion.length * 5 + 7;

  // Jornadas
  seccion("Jornadas de trabajo");
  const totalHoras = parte.jornadas.reduce(
    (total, jornada) => total + Number(jornada.horas || 0),
    0,
  );

  autoTable(pdf, {
    startY: y,
    head: [["Fecha", "Horas", "Observaciones"]],
    body: parte.jornadas.map((j) => [
      fechaBonita(j.fecha),
      `${Number(j.horas).toFixed(2).replace(".", ",")} h`,
      j.notas || "",
    ]),
    foot: [["", `${totalHoras.toFixed(2).replace(".", ",")} h`, "Total horas"]],
    theme: "grid",
    headStyles: { fillColor: azul },
    footStyles: { fillColor: azulClaro, textColor: [20, 30, 45] },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: margen, right: margen },
  });

  y = (pdf as any).lastAutoTable.finalY + 8;

  // Materiales
  seccion("Materiales utilizados");
  autoTable(pdf, {
    startY: y,
    head: [["Descripción", "Cantidad", "Unidad"]],
    body: parte.materiales.map((m) => [
      m.descripcion,
      String(m.cantidad),
      m.unidad || "",
    ]),
    theme: "grid",
    headStyles: { fillColor: azul },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: margen, right: margen },
  });

  y = (pdf as any).lastAutoTable.finalY + 10;

  // Firmas: si no caben, pasan a una página nueva
  // if (y > 235) {
  //   pdf.addPage();
  //   y = 20;
  // }

  const anchoFirma = (ancho - margen * 2 - 10) / 2;

  function bloqueFirma(x: number, titulo: string, imagen?: string | null) {
    pdf.setFillColor(...azul);
    pdf.roundedRect(x, y, anchoFirma, 8, 1, 1, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(titulo, x + 3, y + 5.5);

    pdf.setDrawColor(170, 185, 205);
    pdf.roundedRect(x, y + 8, anchoFirma, 25, 2, 2);

    if (imagen) {
      try {
        pdf.addImage(imagen, "PNG", x + 5, y + 10, anchoFirma - 10, 17);
      } catch {
        // Si la imagen no se puede insertar, se conserva el espacio de firma.
      }
    }
  }

  bloqueFirma(margen, "FIRMA DEL TÉCNICO", parte.firmaTecnico);
  bloqueFirma(
    margen + anchoFirma + 10,
    "FIRMA DEL CLIENTE",
    parte.firmaCliente,
  );

  y += 43;
  pdf.setTextColor(30, 30, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Fecha de cierre: ${fechaBonita(parte.fecha_cierre) || "—"}`,
    margen,
    y,
  );

  // Número de página
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `TELETECNICS S.L. · Parte ${parte.numero} · Página ${i}/${paginas}`,
      ancho / 2,
      289,
      { align: "center" },
    );
  }

  pdf.save(`Parte-${parte.numero}.pdf`);
  return pdf.output("blob");
}
