"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Jornada = {
  id: number;
  fecha: string;
  horas: string;
};

type Parte = {
  id: string;
  numero: string;
  cliente: string;
  direccion: string;
  tecnico: string;
  jornadas: Jornada[];
  trabajos: string;
  materiales: string;
  estado: string;
};

function fechaHoy() {
  const fecha = new Date();
  const offset = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function Home() {
  const [sesion, setSesion] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [trabajos, setTrabajos] = useState("");
  const [materiales, setMateriales] = useState("");
  const [jornadas, setJornadas] = useState<Jornada[]>([
    { id: 1, fecha: fechaHoy(), horas: "" },
  ]);

  const totalHoras = jornadas.reduce(
    (total, j) => total + Math.max(0, Number(j.horas) || 0),
    0,
  );

  const cargarPartes = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const { data, error: errorPartes } = await supabase
        .from("partes")
        .select(
          "id, numero, tecnico, direccion_intervencion, descripcion, estado, fecha_creacion, cliente_id",
        )
        .order("fecha_creacion", { ascending: false });

      if (errorPartes) throw errorPartes;

      const resultado: Parte[] = await Promise.all(
        (data ?? []).map(async (p) => {
          const [
            { data: datosCliente, error: errorCliente },
            { data: datosJornadas, error: errorJornadas },
            { data: datosMateriales, error: errorMateriales },
          ] = await Promise.all([
            supabase
              .from("clientes")
              .select("nombre")
              .eq("id", p.cliente_id)
              .single(),
            supabase
              .from("jornadas")
              .select("id, fecha, horas")
              .eq("parte_id", p.id)
              .order("fecha"),
            supabase
              .from("materiales")
              .select("descripcion, cantidad, unidad")
              .eq("parte_id", p.id),
          ]);

          if (errorCliente) throw errorCliente;
          if (errorJornadas) throw errorJornadas;
          if (errorMateriales) throw errorMateriales;

          return {
            id: p.id,
            numero: p.numero,
            cliente: datosCliente.nombre,
            direccion: p.direccion_intervencion ?? "",
            tecnico: p.tecnico,
            trabajos: p.descripcion ?? "",
            estado: p.estado,
            jornadas: (datosJornadas ?? []).map((j) => ({
              id: j.id as unknown as number,
              fecha: j.fecha,
              horas: String(j.horas),
            })),
            materiales: (datosMateriales ?? [])
              .map(
                (m) =>
                  `${m.descripcion} — ${m.cantidad}${m.unidad ? ` ${m.unidad}` : ""}`,
              )
              .join("\n"),
          };
        }),
      );

      setPartes(resultado);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los partes.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  // Inicio de sesion y comprobación de sesión activa

  useEffect(() => {
    let activo = true;

    async function comprobarSesion() {
      try {
        const { data, error: errorSesion } = await supabase.auth.getSession();

        if (!activo) return;

        if (errorSesion) {
          setError(errorSesion.message);
        }

        setSesion(!!data.session);
      } catch (e) {
        if (activo) {
          setError(
            e instanceof Error ? e.message : "No se pudo comprobar la sesión.",
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    void comprobarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(!!session);
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  // Carga de partes cuando hay sesión activa
  useEffect(() => {
    if (sesion) void cargarPartes();
    else setPartes([]);
  }, [sesion, cargarPartes]);

  async function iniciarSesion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;
      setPassword("");
      setMensaje("Sesión iniciada correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  async function cerrarSesion() {
    setError("");
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) setError(logoutError.message);
    else {
      setPartes([]);
      setMensaje("");
      setMostrarFormulario(false);
    }
  }

  function nuevoParte() {
    setCliente("");
    setDireccion("");
    setTecnico("");
    setTrabajos("");
    setMateriales("");
    setJornadas([{ id: Date.now(), fecha: fechaHoy(), horas: "" }]);
    setError("");
    setMensaje("");
    setMostrarFormulario(true);
  }

  async function guardarParte() {
    if (!cliente.trim() || !direccion.trim() || !tecnico.trim()) {
      setError("Completa el cliente, la dirección y el técnico.");
      return;
    }

    if (
      !jornadas.some(
        (j) =>
          Number(j.horas) > 0 &&
          Number(j.horas) <= 24 &&
          Number.isFinite(Number(j.horas)),
      )
    ) {
      setError("Añade al menos una jornada con horas válidas.");
      return;
    }

    if (
      jornadas.some(
        (j) =>
          !j.fecha ||
          (j.horas.trim() !== "" &&
            (!Number.isFinite(Number(j.horas)) ||
              Number(j.horas) < 0 ||
              Number(j.horas) > 24)),
      )
    ) {
      setError("Revisa las fechas y las horas de las jornadas.");
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      // Crear el cliente asociado a este parte.
      const { data: nuevoCliente, error: errorCliente } = await supabase
        .from("clientes")
        .insert({
          nombre: cliente.trim(),
          direccion: direccion.trim(),
        })
        .select("id")
        .single();

      if (errorCliente) throw errorCliente;

      // Número único provisional para evitar depender del contador visual.
      const numero = `PT-${fechaHoy().replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const { data: nuevoRegistro, error: errorParte } = await supabase
        .from("partes")
        .insert({
          numero,
          cliente_id: nuevoCliente.id,
          direccion_intervencion: direccion.trim(),
          tecnico: tecnico.trim(),
          descripcion: trabajos.trim(),
          estado: "en_curso",
          estado_facturacion: "pendiente",
        })
        .select("id")
        .single();

      if (errorParte) throw errorParte;

      const jornadasValidas = jornadas.filter((j) => Number(j.horas) > 0);

      const { error: errorJornadas } = await supabase.from("jornadas").insert(
        jornadasValidas.map((j) => ({
          parte_id: nuevoRegistro.id,
          fecha: j.fecha,
          horas: Number(j.horas),
        })),
      );

      if (errorJornadas) throw errorJornadas;

      if (materiales.trim()) {
        const { error: errorMateriales } = await supabase
          .from("materiales")
          .insert({
            parte_id: nuevoRegistro.id,
            descripcion: materiales.trim(),
            cantidad: 1,
            unidad: "lote",
          });

        if (errorMateriales) throw errorMateriales;
      }

      setMostrarFormulario(false);
      setMensaje(`Parte ${numero} guardado correctamente.`);
      await cargarPartes();
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo completar el guardado: ${e.message}`
          : "No se pudo guardar el parte.",
      );
    } finally {
      setGuardando(false);
    }
  }

  function actualizarJornada(
    id: number,
    campo: "fecha" | "horas",
    valor: string,
  ) {
    setJornadas((anteriores) =>
      anteriores.map((j) => (j.id === id ? { ...j, [campo]: valor } : j)),
    );
  }

  if (!sesion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
        <form
          onSubmit={iniciarSesion}
          className="w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-sm"
        >
          <div>
            <p className="text-sm text-slate-500">Teletecnics - Tube Systems</p>
            <h1 className="mt-2 text-2xl font-bold">SAT · Partes de trabajo</h1>
            <p className="mt-2 text-slate-600">
              Inicia sesión para acceder a tus partes.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <label className="block text-sm font-medium">
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            />
          </label>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {cargando ? "Comprobando..." : "Iniciar sesión"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-sm text-slate-300">Teletecnics - Tube Systems</p>
            <h1 className="text-2xl font-bold">SAT · Partes de trabajo</h1>
          </div>
          <button
            onClick={cerrarSesion}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {error && (
          <div
            role="alert"
            className="break-words rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            className="rounded-xl bg-green-50 p-4 text-sm text-green-800"
          >
            {mensaje}
          </div>
        )}

        {!mostrarFormulario ? (
          <>
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold">Mis partes</h2>
                <p className="mt-1 text-slate-600">
                  Partes guardados en la base de datos.
                </p>
              </div>
              <button
                onClick={nuevoParte}
                className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
              >
                + Nuevo parte
              </button>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total de partes</p>
                <p className="mt-2 text-3xl font-bold">{partes.length}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">En curso</p>
                <p className="mt-2 text-3xl font-bold">
                  {partes.filter((p) => p.estado === "en_curso").length}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Horas registradas</p>
                <p className="mt-2 text-3xl font-bold">
                  {partes
                    .reduce(
                      (total, p) =>
                        total +
                        p.jornadas.reduce(
                          (suma, j) => suma + (Number(j.horas) || 0),
                          0,
                        ),
                      0,
                    )
                    .toLocaleString("es-ES")}{" "}
                  h
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Últimos partes</h3>
                <button
                  onClick={() => void cargarPartes()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  Actualizar
                </button>
              </div>

              {cargando ? (
                <p className="py-8 text-center text-slate-500">
                  Cargando partes...
                </p>
              ) : partes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <p className="font-medium">Todavía no tienes partes</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Crea tu primera intervención para empezar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partes.map((parte) => (
                    <div
                      key={parte.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-bold">{parte.numero}</p>
                        {/* Codigo para mostrar los detalles de un parte,
                        incluyendo su estado, cliente, dirección, técnico,
                        jornadas, trabajos y materiales. */}
                        <Link
                          href={`/partes/${parte.id}`}
                          className="inline-flex rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Ver detalle
                        </Link>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
                          {parte.estado === "en_curso"
                            ? "En curso"
                            : parte.estado}
                        </span>
                      </div>
                      <p className="mt-2">{parte.cliente}</p>
                      <p className="text-sm text-slate-500">
                        {parte.direccion}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Técnico: {parte.tecnico}
                      </p>
                      <p className="mt-2 text-sm">
                        {parte.jornadas.reduce(
                          (suma, j) => suma + (Number(j.horas) || 0),
                          0,
                        )}{" "}
                        horas · {parte.jornadas.length} jornadas
                      </p>
                      {parte.trabajos && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          {parte.trabajos}
                        </p>
                      )}
                      {parte.materiales && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          Materiales: {parte.materiales}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Nuevo parte</h2>
                <p className="mt-1 text-slate-600">
                  Introduce los datos de la intervención.
                </p>
              </div>
              <button
                onClick={() => setMostrarFormulario(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2"
              >
                Volver
              </button>
            </div>

            <div className="space-y-5 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h3 className="text-lg font-bold">Datos generales</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Cliente *
                  <input
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    required
                    placeholder="Nombre del cliente"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Técnico *
                  <input
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                    required
                    placeholder="Nombre del técnico"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                  />
                </label>

                <label className="block text-sm font-medium sm:col-span-2">
                  Dirección de intervención *
                  <input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    required
                    placeholder="Dirección completa"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                  />
                </label>
              </div>

              <hr className="border-slate-200" />

              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">Jornadas de trabajo</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setJornadas((anteriores) => [
                        ...anteriores,
                        { id: Date.now(), fecha: fechaHoy(), horas: "" },
                      ])
                    }
                    className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700"
                  >
                    + Añadir día
                  </button>
                </div>

                <div className="space-y-3">
                  {jornadas.map((jornada, indice) => (
                    <div
                      key={jornada.id}
                      className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                      <label className="text-sm font-medium">
                        Fecha · Día {indice + 1}
                        <input
                          type="date"
                          required
                          value={jornada.fecha}
                          onChange={(e) =>
                            actualizarJornada(
                              jornada.id,
                              "fecha",
                              e.target.value,
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                        />
                      </label>

                      <label className="text-sm font-medium">
                        Horas trabajadas
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.25"
                          value={jornada.horas}
                          onChange={(e) =>
                            actualizarJornada(
                              jornada.id,
                              "horas",
                              e.target.value,
                            )
                          }
                          placeholder="Ej. 3.5"
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setJornadas((anteriores) =>
                            anteriores.filter((j) => j.id !== jornada.id),
                          )
                        }
                        disabled={jornadas.length === 1}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-50 p-4">
                  <span className="font-semibold">Total de horas</span>
                  <span className="text-2xl font-bold text-blue-800">
                    {totalHoras.toLocaleString("es-ES")} h
                  </span>
                </div>
              </div>

              <hr className="border-slate-200" />

              <label className="block text-sm font-medium">
                Trabajos realizados
                <textarea
                  rows={5}
                  value={trabajos}
                  onChange={(e) => setTrabajos(e.target.value)}
                  placeholder="Describe el diagnóstico, la reparación y el resultado..."
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                />
              </label>

              <label className="block text-sm font-medium">
                Materiales utilizados
                <textarea
                  rows={3}
                  value={materiales}
                  onChange={(e) => setMateriales(e.target.value)}
                  placeholder="Describe los materiales y las cantidades, si procede..."
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                />
              </label>

              <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                Los datos se guardarán en Supabase al pulsar el botón. Necesitas
                conexión a Internet para esta versión.
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={() => void guardarParte()}
                className="w-full rounded-xl bg-blue-700 px-5 py-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar parte"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
