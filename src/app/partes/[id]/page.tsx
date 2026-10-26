"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ParteDetalle = {
  id: string;
  numero: string;
  tecnico: string;
  direccion_intervencion: string | null;
  descripcion: string | null;
  estado: string;
  fecha_creacion: string;
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

export default function DetalleParte() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [parte, setParte] = useState<ParteDetalle | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [mostrarFormularioJornada, setMostrarFormularioJornada] =
    useState(false);
  const [fechaJornada, setFechaJornada] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10),
  );
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
            "id, numero, tecnico, direccion_intervencion, descripcion, estado, fecha_creacion, cliente_id",
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

    if (id) void cargarDetalle();

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
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h3 className="text-lg font-bold">Materiales utilizados</h3>

              {materiales.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No se han registrado materiales.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {materiales.map((material) => (
                    <div
                      key={material.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-medium">{material.descripcion}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Cantidad:{" "}
                        {Number(material.cantidad).toLocaleString("es-ES")}
                        {material.unidad ? ` ${material.unidad}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
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
