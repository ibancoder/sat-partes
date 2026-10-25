"use client";

import { useState } from "react";

type Jornada = {
  id: number;
  fecha: string;
  horas: string;
};

type Parte = {
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
    (total, jornada) => total + Math.max(0, Number(jornada.horas) || 0),
    0,
  );

  function nuevoParte() {
    setCliente("");
    setDireccion("");
    setTecnico("");
    setTrabajos("");
    setMateriales("");
    setJornadas([{ id: Date.now(), fecha: fechaHoy(), horas: "" }]);
    setMostrarFormulario(true);
  }
  function guardarParte() {
    if (!cliente.trim() || !direccion.trim() || !tecnico.trim()) {
      alert("Completa el cliente, la dirección y el técnico.");
      return;
    }

    if (!jornadas.some((j) => Number(j.horas) > 0)) {
      alert("Añade al menos una jornada con horas trabajadas.");
      return;
    }

    const numero = `PT-${String(partes.length + 1).padStart(4, "0")}`;

    setPartes((anteriores) => [
      {
        numero,
        cliente,
        direccion,
        tecnico,
        jornadas,
        trabajos,
        materiales,
        estado: "en curso",
      },
      ...anteriores,
    ]);
    setMostrarFormulario(false);
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-2xl text-slate-300">
              Teletecnics - Tube Systems
            </p>
            <h1 className="text-2xl font-bold">SAT · Partes de trabajo</h1>
          </div>
          <span className="rounded-full bg-slate-700 px-3 py-2 text-sm">
            Versión de prueba
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {!mostrarFormulario ? (
          <>
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold">Mis partes</h2>
                <p className="mt-1 text-slate-600">
                  Gestiona tus intervenciones y jornadas.
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
                  {partes.filter((p) => p.estado === "En curso").length}
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
              <h3 className="mb-4 text-lg font-bold">Últimos partes</h3>
              {partes.length === 0 ? (
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
                      key={parte.numero}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-bold">{parte.numero}</p>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
                          {parte.estado}
                        </span>
                      </div>
                      <p className="mt-2">{parte.cliente}</p>
                      <p className="text-sm text-slate-500">
                        {parte.direccion}
                      </p>
                      <p className="mt-2 text-sm">
                        {parte.jornadas.reduce(
                          (suma, j) => suma + (Number(j.horas) || 0),
                          0,
                        )}{" "}
                        horas · {parte.jornadas.length} jornadas
                      </p>
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
                    placeholder="Nombre del cliente"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Técnico *
                  <input
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                    placeholder="Nombre del técnico"
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base"
                  />
                </label>

                <label className="block text-sm font-medium sm:col-span-2">
                  Dirección de intervención *
                  <input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
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

              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Esta versión es una demostración. Aún no guarda datos de forma
                permanente ni incluye firmas o generación de PDF.
              </div>

              <button
                onClick={guardarParte}
                className="w-full rounded-xl bg-blue-700 px-5 py-4 font-semibold text-white hover:bg-blue-800"
              >
                Guardar borrador de prueba
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
