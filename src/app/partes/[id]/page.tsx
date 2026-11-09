"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import { generarPartePDF } from "@/lib/generarPartePDF";
import SignatureCanvas from "react-signature-canvas";
import { useRef } from "react";

type ParteDetalle = {
  id: string;
  numero: string;
  tecnico: string;
  direccion_intervencion: string | null;
  descripcion: string | null;
  estado: string;
  fecha_creacion: string;
  fecha_cierre: string | null;
  cliente_id: string;
};

type Cliente = {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
};

type Jornada = {
  id: number;
  fecha: string;
  horas: number;
  notas: string | null;
};

type Material = {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
};

function fechaLegible(fecha: string) {
  if (!fecha) return "—";

  return new Date(`${fecha.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES");
}

export default function DetalleParte({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState("");

  useEffect(() => {
    params.then((valores) => setId(valores.id));
  }, [params]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [parte, setParte] = useState<ParteDetalle | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);

  const [jornadaEditando, setJornadaEditando] = useState<
    string | number | null
  >(null);
  const [fechaEdicionJornada, setFechaEdicionJornada] = useState("");
  const [horasEdicionJornada, setHorasEdicionJornada] = useState("");
  const [notasEdicionJornada, setNotasEdicionJornada] = useState("");
  const [guardandoEdicionJornada, setGuardandoEdicionJornada] = useState(false);

  const [materiales, setMateriales] = useState<Material[]>([]);

  // Referencias a los canvas de firma para el técnico y el cliente
  const firmaTecnicoRef = useRef<SignatureCanvas | null>(null);
  const firmaClienteRef = useRef<SignatureCanvas | null>(null);

  const [guardandoFirmas, setGuardandoFirmas] = useState(false);
  const [mensajeFirmas, setMensajeFirmas] = useState("");
  const [firmasGuardadas, setFirmasGuardadas] = useState(false);

  //fin referencias a los canvas de firma

  const [materialEditando, setMaterialEditando] = useState<string | null>(null);
  const [descripcionEdicionMaterial, setDescripcionEdicionMaterial] =
    useState("");
  const [cantidadEdicionMaterial, setCantidadEdicionMaterial] = useState("1");
  const [unidadEdicionMaterial, setUnidadEdicionMaterial] = useState("unidad");
  const [guardandoEdicionMaterial, setGuardandoEdicionMaterial] =
    useState(false);

  const [mostrarFormularioMaterial, setMostrarFormularioMaterial] =
    useState(false);
  const [descripcionMaterial, setDescripcionMaterial] = useState("");
  const [cantidadMaterial, setCantidadMaterial] = useState("1");
  const [unidadMaterial, setUnidadMaterial] = useState("unidad");
  const [guardandoMaterial, setGuardandoMaterial] = useState(false);
  const [mensajeMaterial, setMensajeMaterial] = useState("");

  const [mostrarFormularioJornada, setMostrarFormularioJornada] =
    useState(false);
  const [fechaJornada, setFechaJornada] = useState("");
  useEffect(() => {
    const fecha = new Date();
    const offset = fecha.getTimezoneOffset();

    setFechaJornada(
      new Date(fecha.getTime() - offset * 60000).toISOString().slice(0, 10),
    );
  }, []);

  const [horasJornada, setHorasJornada] = useState("");
  const [notasJornada, setNotasJornada] = useState("");
  const [guardandoJornada, setGuardandoJornada] = useState(false);
  const [mensajeJornada, setMensajeJornada] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargarDetalle() {
      setCargando(true);
      setError("");

      try {
        const { data: datosParte, error: errorParte } = await supabase
          .from("partes")
          .select(
            "id, numero, tecnico, direccion_intervencion, descripcion, estado, fecha_creacion,fecha_cierre, cliente_id",
          )
          .eq("id", id)
          .single();

        if (errorParte) throw errorParte;

        const [
          { data: datosCliente, error: errorCliente },
          { data: datosJornadas, error: errorJornadas },
          { data: datosMateriales, error: errorMateriales },
        ] = await Promise.all([
          supabase
            .from("clientes")
            .select("nombre, direccion, telefono, email")
            .eq("id", datosParte.cliente_id)
            .single(),
          supabase
            .from("jornadas")
            .select("id, fecha, horas, notas")
            .eq("parte_id", id)
            .order("fecha", { ascending: true }),
          supabase
            .from("materiales")
            .select("id, descripcion, cantidad, unidad")
            .eq("parte_id", id),
        ]);

        if (errorCliente) throw errorCliente;
        if (errorJornadas) throw errorJornadas;
        if (errorMateriales) throw errorMateriales;

        if (!activo) return;

        setParte(datosParte);
        setCliente(datosCliente);
        setJornadas((datosJornadas ?? []) as Jornada[]);
        setMateriales((datosMateriales ?? []) as Material[]);
      } catch (e) {
        if (activo) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar el detalle del parte.",
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    if (id) {
      void cargarDetalle();
    } else {
      setCargando(true);
    }

    return () => {
      activo = false;
    };
  }, [id]);

  async function guardarJornada() {
    setMensajeJornada("");
    setError("");

    const horas = Number(horasJornada);

    if (!fechaJornada) {
      setMensajeJornada("Selecciona la fecha de la visita.");
      return;
    }

    if (
      !horasJornada.trim() ||
      !Number.isFinite(horas) ||
      horas <= 0 ||
      horas > 24
    ) {
      setMensajeJornada(
        "Introduce unas horas válidas, mayores que 0 y hasta 24.",
      );
      return;
    }

    setGuardandoJornada(true);

    try {
      const { data, error: errorInsertar } = await supabase
        .from("jornadas")
        .insert({
          parte_id: id,
          fecha: fechaJornada,
          horas,
          notas: notasJornada.trim() || null,
        })
        .select("id, fecha, horas, notas")
        .single();

      if (errorInsertar) throw errorInsertar;

      setJornadas((anteriores) =>
        [...anteriores, data as Jornada].sort((a, b) =>
          a.fecha.localeCompare(b.fecha),
        ),
      );

      setHorasJornada("");
      setNotasJornada("");
      setMostrarFormularioJornada(false);
      setMensajeJornada("Jornada guardada correctamente.");
    } catch (e) {
      setMensajeJornada(
        e instanceof Error
          ? `No se pudo guardar la jornada: ${e.message}`
          : "No se pudo guardar la jornada.",
      );
    } finally {
      setGuardandoJornada(false);
    }
  }

  async function actualizarJornada() {
    if (jornadaEditando === null) return;

    setError("");

    const horas = Number(horasEdicionJornada);

    if (!fechaEdicionJornada) {
      setError("Selecciona la fecha de la jornada.");
      return;
    }

    if (
      !horasEdicionJornada.trim() ||
      !Number.isFinite(horas) ||
      horas <= 0 ||
      horas > 24
    ) {
      setError("Las horas deben ser mayores que 0 y no superar 24.");
      return;
    }

    setGuardandoEdicionJornada(true);

    try {
      const { data, error: errorActualizar } = await supabase
        .from("jornadas")
        .update({
          fecha: fechaEdicionJornada,
          horas,
          notas: notasEdicionJornada.trim() || null,
        })
        .eq("id", jornadaEditando)
        .eq("parte_id", id)
        .select("id, fecha, horas, notas")
        .single();

      if (errorActualizar) throw errorActualizar;

      setJornadas((anteriores) =>
        anteriores
          .map((jornada) =>
            jornada.id === data.id ? (data as Jornada) : jornada,
          )
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      );

      setJornadaEditando(null);
      setFechaEdicionJornada("");
      setHorasEdicionJornada("");
      setNotasEdicionJornada("");
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo actualizar la jornada: ${e.message}`
          : "No se pudo actualizar la jornada.",
      );
    } finally {
      setGuardandoEdicionJornada(false);
    }
  }

  async function eliminarJornada(jornadaId: string | number) {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar esta jornada? Esta acción no se puede deshacer.",
    );

    if (!confirmar) return;

    setError("");

    const { error: errorEliminar } = await supabase
      .from("jornadas")
      .delete()
      .eq("id", jornadaId)
      .eq("parte_id", id);

    if (errorEliminar) {
      setError(`No se pudo eliminar la jornada: ${errorEliminar.message}`);
      return;
    }

    setJornadas((anteriores) =>
      anteriores.filter((jornada) => jornada.id !== jornadaId),
    );
  }

  async function guardarMaterial() {
    setMensajeMaterial("");
    setError("");

    const descripcion = descripcionMaterial.trim();
    const cantidad = Number(cantidadMaterial);

    if (!descripcion) {
      setMensajeMaterial("Introduce la descripción del material.");
      return;
    }

    if (
      !cantidadMaterial.trim() ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      setMensajeMaterial("Introduce una cantidad válida mayor que cero.");
      return;
    }

    setGuardandoMaterial(true);

    try {
      const { data, error: errorInsertar } = await supabase
        .from("materiales")
        .insert({
          parte_id: id,
          descripcion,
          cantidad,
          unidad: unidadMaterial.trim() || null,
        })
        .select("id, descripcion, cantidad, unidad")
        .single();

      if (errorInsertar) throw errorInsertar;

      setMateriales((anteriores) => [...anteriores, data as Material]);
      setDescripcionMaterial("");
      setCantidadMaterial("1");
      setUnidadMaterial("unidad");
      setMostrarFormularioMaterial(false);
      setMensajeMaterial("Material guardado correctamente.");
    } catch (e) {
      setMensajeMaterial(
        e instanceof Error
          ? `No se pudo guardar el material: ${e.message}`
          : "No se pudo guardar el material.",
      );
    } finally {
      setGuardandoMaterial(false);
    }
  }

  async function actualizarMaterial(materialId: string) {
    setError("");
    setMensajeMaterial("");

    const descripcion = descripcionEdicionMaterial.trim();
    const cantidad = Number(cantidadEdicionMaterial);

    if (!descripcion) {
      setMensajeMaterial("Introduce la descripción del material.");
      return;
    }

    if (
      !cantidadEdicionMaterial.trim() ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      setMensajeMaterial("Introduce una cantidad válida mayor que cero.");
      return;
    }

    setGuardandoEdicionMaterial(true);

    try {
      const { data, error: errorActualizar } = await supabase
        .from("materiales")
        .update({
          descripcion,
          cantidad,
          unidad: unidadEdicionMaterial.trim() || null,
        })
        .eq("id", materialId)
        .eq("parte_id", id)
        .select("id, descripcion, cantidad, unidad")
        .single();

      if (errorActualizar) throw errorActualizar;

      setMateriales((anteriores) =>
        anteriores.map((material) =>
          material.id === materialId ? (data as Material) : material,
        ),
      );

      setMaterialEditando(null);
      setDescripcionEdicionMaterial("");
      setCantidadEdicionMaterial("1");
      setUnidadEdicionMaterial("unidad");
      setMensajeMaterial("Material actualizado correctamente.");
    } catch (e) {
      setMensajeMaterial(
        e instanceof Error
          ? `No se pudo actualizar el material: ${e.message}`
          : "No se pudo actualizar el material.",
      );
    } finally {
      setGuardandoEdicionMaterial(false);
    }
  }

  async function eliminarMaterial(materialId: string) {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar este material? Esta acción no se puede deshacer.",
    );

    if (!confirmar) return;

    setError("");
    setMensajeMaterial("");

    const { error: errorEliminar } = await supabase
      .from("materiales")
      .delete()
      .eq("id", materialId)
      .eq("parte_id", id);

    if (errorEliminar) {
      setMensajeMaterial(
        `No se pudo eliminar el material: ${errorEliminar.message}`,
      );
      return;
    }

    setMateriales((anteriores) =>
      anteriores.filter((material) => material.id !== materialId),
    );

    setMensajeMaterial("Material eliminado correctamente.");
  }

  async function guardarFirmas() {
    setMensajeFirmas("");
    setError("");

    const firmaTecnico = firmaTecnicoRef.current;
    const firmaCliente = firmaClienteRef.current;

    if (!firmaTecnico || firmaTecnico.isEmpty()) {
      setMensajeFirmas("Falta la firma del técnico.");
      return;
    }

    if (!firmaCliente || firmaCliente.isEmpty()) {
      setMensajeFirmas("Falta la firma del cliente.");
      return;
    }

    if (!parte) {
      setMensajeFirmas("No se ha podido cargar el parte.");
      return;
    }

    setGuardandoFirmas(true);

    try {
      const { data: usuarioData, error: errorUsuario } =
        await supabase.auth.getUser();

      if (errorUsuario) throw errorUsuario;

      const usuario = usuarioData.user;

      if (!usuario) {
        throw new Error("Debes iniciar sesión para guardar las firmas.");
      }

      const fechaFirma = new Date().toISOString();
      const identificador = `${usuario.id}/${id}/${Date.now()}`;

      const imagenTecnico = await new Promise<Blob>((resolve, reject) => {
        firmaTecnico.getCanvas().toBlob((blob) => {
          if (blob) resolve(blob);
          else
            reject(
              new Error(
                "No se pudo generar la imagen de la firma del técnico.",
              ),
            );
        }, "image/png");
      });

      const imagenCliente = await new Promise<Blob>((resolve, reject) => {
        firmaCliente.getCanvas().toBlob((blob) => {
          if (blob) resolve(blob);
          else
            reject(
              new Error(
                "No se pudo generar la imagen de la firma del cliente.",
              ),
            );
        }, "image/png");
      });

      const rutaTecnico = `${identificador}-tecnico.png`;
      const rutaCliente = `${identificador}-cliente.png`;

      const { error: errorSubidaTecnico } = await supabase.storage
        .from("firmas")
        .upload(rutaTecnico, imagenTecnico, {
          contentType: "image/png",
          upsert: false,
        });

      if (errorSubidaTecnico) throw errorSubidaTecnico;

      const { error: errorSubidaCliente } = await supabase.storage
        .from("firmas")
        .upload(rutaCliente, imagenCliente, {
          contentType: "image/png",
          upsert: false,
        });

      if (errorSubidaCliente) {
        await supabase.storage.from("firmas").remove([rutaTecnico]);
        throw errorSubidaCliente;
      }

      const { error: errorRegistro } = await supabase.from("firmas").upsert(
        {
          parte_id: id,
          ruta_firma_tecnico: rutaTecnico,
          ruta_firma_cliente: rutaCliente,
          firmado_at: fechaFirma,
        },
        { onConflict: "parte_id" },
      );

      if (errorRegistro) {
        await supabase.storage
          .from("firmas")
          .remove([rutaTecnico, rutaCliente]);
        throw errorRegistro;
      }

      const { error: errorEstado } = await supabase
        .from("partes")
        .update({
          estado: "firmado",
          fecha_cierre: fechaFirma,
        })
        .eq("id", id);

      if (errorEstado) throw errorEstado;

      setParte((anterior) =>
        anterior ? { ...anterior, estado: "firmado" } : anterior,
      );

      setFirmasGuardadas(true);
      setMensajeFirmas("Firmas guardadas correctamente.");
    } catch (e) {
      setMensajeFirmas(
        e instanceof Error
          ? `No se pudieron guardar las firmas: ${e.message}`
          : "No se pudieron guardar las firmas.",
      );
    } finally {
      setGuardandoFirmas(false);
    }
  }

  async function obtenerPDF(): Promise<Blob> {
    if (!parte) {
      throw new Error("No se ha cargado el parte.");
    }

    // Recuperar las rutas de las firmas guardadas
    const { data: datosFirmas, error: errorFirmas } = await supabase
      .from("firmas")
      .select("ruta_firma_tecnico, ruta_firma_cliente")
      .eq("parte_id", id)
      .maybeSingle();

    if (errorFirmas) throw errorFirmas;

    // Descargar las firmas de Supabase
    async function descargarFirma(ruta: string | null) {
      if (!ruta) return null;

      const { data, error } = await supabase.storage
        .from("firmas")
        .download(ruta);

      if (error) throw error;

      return await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result as string);
        lector.onerror = () =>
          reject(new Error("No se pudo leer una imagen de firma."));
        lector.readAsDataURL(data);
      });
    }

    const [firmaTecnico, firmaCliente] = await Promise.all([
      descargarFirma(datosFirmas?.ruta_firma_tecnico ?? null),
      descargarFirma(datosFirmas?.ruta_firma_cliente ?? null),
    ]);

    // Generar el PDF
    return generarPartePDF({
      numero: parte.numero,
      cliente,
      direccion_intervencion: parte.direccion_intervencion ?? "",
      tecnico: parte.tecnico,
      descripcion: parte.descripcion ?? "",
      estado:
        parte.estado === "firmado"
          ? "Firmado"
          : parte.estado === "pendiente_firma"
            ? "Pendiente de firma"
            : "En curso",
      fecha_creacion: parte.fecha_creacion,
      fecha_cierre: parte.fecha_cierre,
      jornadas,
      materiales,
      firmaTecnico,
      firmaCliente,
    });
  }

  async function descargarPDF() {
    setError("");

    try {
      const pdfBlob = await obtenerPDF();

      const url = URL.createObjectURL(pdfBlob);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = `Parte-${parte?.numero}.pdf`;

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo generar el PDF: ${e.message}`
          : "No se pudo generar el PDF.",
      );
    }
  }

  async function enviarCopiaCliente() {
    if (!parte || !cliente?.email) {
      setError("No se ha cargado el parte o el cliente no tiene email.");
      return;
    }

    if (parte.estado !== "firmado") {
      setError("Solo se pueden enviar partes firmados.");
      return;
    }
    setError("");
    setMensajeFirmas("");

    try {
      const pdfBlob = await obtenerPDF();

      const formulario = new FormData();
      formulario.append("parteId", parte.id);
      formulario.append("pdf", pdfBlob, `Parte-${parte.numero}.pdf`);

      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token;

      if (!token) {
        throw new Error("No se ha podido obtener el token de sesión.");
      }

      const respuesta = await fetch("/api/enviar-parte", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formulario,
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No se pudo enviar el parte al cliente.",
        );
      }
      setMensajeFirmas("Parte enviado correctamente al cliente.");
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo enviar el parte al cliente: ${e.message}`
          : "No se pudo enviar el parte al cliente.",
      );
    }
  }

  const totalHoras = jornadas.reduce(
    (total, jornada) => total + Number(jornada.horas || 0),
    0,
  );
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-sm text-slate-300">Teletecnics - Tube Systems</p>
            <h1 className="text-xl font-bold sm:text-2xl">Detalle del parte</h1>
            <button
              type="button"
              onClick={() => void descargarPDF()}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Generar PDF
            </button>
            <button
              type="button"
              onClick={() => void enviarCopiaCliente()}
              disabled={!parte || parte.estado !== "firmado" || !cliente?.email}
              className="mt-3 ml-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar copia al cliente
            </button>
          </div>

          <Link
            href="/"
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
          >
            Volver al listado
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {cargando && (
          <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">
            Cargando parte de trabajo...
          </div>
        )}

        {!cargando && error && (
          <div
            role="alert"
            className="break-words rounded-xl bg-red-50 p-4 text-red-800"
          >
            <p className="font-semibold">No se pudo abrir el parte</p>
            <p className="mt-1 text-sm">{error}</p>
            <p className="mt-3 text-sm">
              Comprueba que has iniciado sesión y que el parte existe.
            </p>
          </div>
        )}

        {!cargando && !error && parte && (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Número de parte</p>
                  <h2 className="mt-1 break-all text-2xl font-bold">
                    {parte.numero}
                  </h2>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  {parte.estado === "en_curso"
                    ? "En curso"
                    : parte.estado === "pendiente_firma"
                      ? "Pendiente de firma"
                      : parte.estado === "firmado"
                        ? "Firmado"
                        : parte.estado}
                </span>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500">
                    CLIENTE
                  </h3>
                  <p className="mt-1 font-medium">{cliente?.nombre ?? "—"}</p>
                  {cliente?.telefono && (
                    <p className="mt-1 text-sm text-slate-600">
                      Teléfono: {cliente.telefono}
                    </p>
                  )}
                  {cliente?.email && (
                    <p className="mt-1 break-all text-sm text-slate-600">
                      Email: {cliente.email}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500">
                    DIRECCIÓN DE INTERVENCIÓN
                  </h3>
                  <p className="mt-1">{parte.direccion_intervencion || "—"}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500">
                    TÉCNICO
                  </h3>
                  <p className="mt-1">{parte.tecnico || "—"}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500">
                    FECHA DE CREACIÓN
                  </h3>
                  <p className="mt-1">{fechaLegible(parte.fecha_creacion)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h3 className="text-lg font-bold">Trabajos realizados</h3>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {parte.descripcion?.trim() ||
                  "No se ha añadido una descripción."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Jornadas de trabajo</h3>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-800">
                    {totalHoras.toLocaleString("es-ES")} h en total
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setMensajeJornada("");
                      setError("");
                      setMostrarFormularioJornada((visible) => !visible);
                    }}
                    className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                  >
                    {mostrarFormularioJornada ? "Cancelar" : "+ Añadir jornada"}
                  </button>
                </div>
              </div>

              {mensajeJornada && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"
                >
                  {mensajeJornada}
                </p>
              )}

              {mostrarFormularioJornada && (
                <div className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <h4 className="font-semibold">Nueva visita</h4>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Fecha *
                      <input
                        type="date"
                        required
                        value={fechaJornada}
                        onChange={(e) => setFechaJornada(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Horas trabajadas *
                      <input
                        type="number"
                        required
                        min="0.25"
                        max="24"
                        step="0.25"
                        value={horasJornada}
                        onChange={(e) => setHorasJornada(e.target.value)}
                        placeholder="Ej. 2.5"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-medium">
                    Observaciones de esta visita
                    <textarea
                      rows={3}
                      value={notasJornada}
                      onChange={(e) => setNotasJornada(e.target.value)}
                      placeholder="Trabajo realizado durante esta visita..."
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={guardandoJornada}
                    onClick={() => void guardarJornada()}
                    className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50 sm:w-auto"
                  >
                    {guardandoJornada ? "Guardando..." : "Guardar jornada"}
                  </button>
                </div>
              )}

              {jornadas.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Este parte todavía no tiene jornadas.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {jornadas.map((jornada, indice) => (
                    <div
                      key={jornada.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      {jornadaEditando === jornada.id ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold">
                            Editar jornada {indice + 1}
                          </h4>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium">
                              Fecha *
                              <input
                                type="date"
                                required
                                value={fechaEdicionJornada}
                                onChange={(e) =>
                                  setFechaEdicionJornada(e.target.value)
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                              />
                            </label>

                            <label className="block text-sm font-medium">
                              Horas trabajadas *
                              <input
                                type="number"
                                required
                                min="0.25"
                                max="24"
                                step="0.25"
                                value={horasEdicionJornada}
                                onChange={(e) =>
                                  setHorasEdicionJornada(e.target.value)
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                              />
                            </label>
                          </div>

                          <label className="block text-sm font-medium">
                            Observaciones
                            <textarea
                              rows={3}
                              value={notasEdicionJornada}
                              onChange={(e) =>
                                setNotasEdicionJornada(e.target.value)
                              }
                              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={guardandoEdicionJornada}
                              onClick={() => void actualizarJornada()}
                              className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              {guardandoEdicionJornada
                                ? "Guardando..."
                                : "Guardar cambios"}
                            </button>

                            <button
                              type="button"
                              disabled={guardandoEdicionJornada}
                              onClick={() => setJornadaEditando(null)}
                              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap justify-between gap-2">
                            <p className="font-medium">Día {indice + 1}</p>
                            <p className="font-semibold">
                              {Number(jornada.horas).toLocaleString("es-ES")} h
                            </p>
                          </div>

                          <p className="mt-1 text-sm text-slate-600">
                            {fechaLegible(jornada.fecha)}
                          </p>

                          {jornada.notas && (
                            <p className="mt-2 whitespace-pre-wrap text-sm">
                              {jornada.notas}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setError("");
                                setJornadaEditando(jornada.id);
                                setFechaEdicionJornada(
                                  jornada.fecha.slice(0, 10),
                                );
                                setHorasEdicionJornada(String(jornada.horas));
                                setNotasEdicionJornada(jornada.notas ?? "");
                              }}
                              className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void eliminarJornada(jornada.id)}
                              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Materiales utilizados</h3>

                <button
                  type="button"
                  onClick={() => {
                    setMensajeMaterial("");
                    setError("");
                    setMostrarFormularioMaterial((visible) => !visible);
                  }}
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  {mostrarFormularioMaterial ? "Cancelar" : "+ Añadir material"}
                </button>
              </div>

              {mensajeMaterial && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"
                >
                  {mensajeMaterial}
                </p>
              )}

              {mostrarFormularioMaterial && (
                <div className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <h4 className="font-semibold">Nuevo material</h4>

                  <label className="block text-sm font-medium">
                    Descripción *
                    <input
                      type="text"
                      required
                      value={descripcionMaterial}
                      onChange={(e) => setDescripcionMaterial(e.target.value)}
                      placeholder="Ej. Filtro de aire"
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Cantidad *
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="any"
                        value={cantidadMaterial}
                        onChange={(e) => setCantidadMaterial(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Unidad
                      <select
                        value={unidadMaterial}
                        onChange={(e) => setUnidadMaterial(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                      >
                        <option value="unidad">Unidad</option>
                        <option value="unidades">Unidades</option>
                        <option value="m">Metros (m)</option>
                        <option value="m²">Metros cuadrados (m²)</option>
                        <option value="kg">Kilogramos (kg)</option>
                        <option value="l">Litros (l)</option>
                        <option value="caja">Caja</option>
                        <option value="lote">Lote</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={guardandoMaterial}
                    onClick={() => void guardarMaterial()}
                    className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50 sm:w-auto"
                  >
                    {guardandoMaterial ? "Guardando..." : "Guardar material"}
                  </button>
                </div>
              )}

              {materiales.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No se han registrado materiales.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {materiales.map((material) => (
                    <div
                      key={material.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      {materialEditando === material.id ? (
                        <div className="space-y-4">
                          <h4 className="font-semibold">Editar material</h4>

                          <label className="block text-sm font-medium">
                            Descripción *
                            <input
                              type="text"
                              required
                              value={descripcionEdicionMaterial}
                              onChange={(e) =>
                                setDescripcionEdicionMaterial(e.target.value)
                              }
                              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                            />
                          </label>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium">
                              Cantidad *
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                value={cantidadEdicionMaterial}
                                onChange={(e) =>
                                  setCantidadEdicionMaterial(e.target.value)
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                              />
                            </label>

                            <label className="block text-sm font-medium">
                              Unidad
                              <select
                                value={unidadEdicionMaterial}
                                onChange={(e) =>
                                  setUnidadEdicionMaterial(e.target.value)
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                              >
                                <option value="unidad">Unidad</option>
                                <option value="unidades">Unidades</option>
                                <option value="m">Metros (m)</option>
                                <option value="m²">
                                  Metros cuadrados (m²)
                                </option>
                                <option value="kg">Kilogramos (kg)</option>
                                <option value="l">Litros (l)</option>
                                <option value="caja">Caja</option>
                                <option value="lote">Lote</option>
                              </select>
                            </label>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={guardandoEdicionMaterial}
                              onClick={() =>
                                void actualizarMaterial(material.id)
                              }
                              className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              {guardandoEdicionMaterial
                                ? "Guardando..."
                                : "Guardar cambios"}
                            </button>

                            <button
                              type="button"
                              disabled={guardandoEdicionMaterial}
                              onClick={() => setMaterialEditando(null)}
                              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="min-w-0 flex-1 font-medium">
                              {material.descripcion}
                            </p>

                            <p className="font-semibold">
                              {Number(material.cantidad).toLocaleString(
                                "es-ES",
                              )}
                              {material.unidad ? ` ${material.unidad}` : ""}
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setError("");
                                setMensajeMaterial("");
                                setMaterialEditando(material.id);
                                setDescripcionEdicionMaterial(
                                  material.descripcion,
                                );
                                setCantidadEdicionMaterial(
                                  String(material.cantidad),
                                );
                                setUnidadEdicionMaterial(
                                  material.unidad || "unidad",
                                );
                              }}
                              className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void eliminarMaterial(material.id)}
                              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h3 className="text-lg font-bold">Firmas de conformidad</h3>

              <p className="mt-2 text-sm text-slate-600">
                El técnico y el cliente deben firmar para cerrar el parte de
                trabajo.
              </p>

              {mensajeFirmas && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"
                >
                  {mensajeFirmas}
                </p>
              )}

              {firmasGuardadas || parte.estado === "firmado" ? (
                <p className="mt-4 rounded-lg bg-green-50 p-4 font-medium text-green-800">
                  Este parte figura como firmado.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 font-semibold">Firma del técnico</h4>
                      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                        <SignatureCanvas
                          ref={firmaTecnicoRef}
                          penColor="black"
                          canvasProps={{
                            className: "h-44 w-full touch-none",
                            "aria-label": "Firma del técnico",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => firmaTecnicoRef.current?.clear()}
                        className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Borrar firma del técnico
                      </button>
                    </div>

                    <div>
                      <h4 className="mb-2 font-semibold">Firma del cliente</h4>
                      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                        <SignatureCanvas
                          ref={firmaClienteRef}
                          penColor="black"
                          canvasProps={{
                            className: "h-44 w-full touch-none",
                            "aria-label": "Firma del cliente",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => firmaClienteRef.current?.clear()}
                        className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Borrar firma del cliente
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={guardandoFirmas}
                    onClick={() => void guardarFirmas()}
                    className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50 sm:w-auto"
                  >
                    {guardandoFirmas
                      ? "Guardando firmas..."
                      : "Guardar firmas y cerrar parte"}
                  </button>
                </>
              )}
            </section>

            <div>
              <Link
                href="/"
                className="inline-flex rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Volver a mis partes
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
