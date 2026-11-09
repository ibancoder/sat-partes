import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    // Comprobar que el usuario está autenticado.
    const autorizacion = request.headers.get("Authorization");
    const token = autorizacion?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para enviar el correo." },
        { status: 401 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    const remitente = process.env.RESEND_FROM_EMAIL;

    if (!supabaseUrl || !supabaseKey || !resendKey || !remitente) {
      throw new Error("Falta configurar alguna variable de entorno.");
    }

    // Comprobar la identidad del usuario con Supabase.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: usuarioDatos, error: errorUsuario } =
      await supabase.auth.getUser(token);

    if (errorUsuario || !usuarioDatos.user) {
      return NextResponse.json(
        { error: "La sesión no es válida." },
        { status: 401 },
      );
    }

    // Recibir el identificador del parte y el PDF.
    const formulario = await request.formData();
    const parteId = formulario.get("parteId");
    const archivo = formulario.get("pdf");

    if (
      typeof parteId !== "string" ||
      !(archivo instanceof File) ||
      archivo.type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "Faltan datos o el archivo no es un PDF válido." },
        { status: 400 },
      );
    }

    // Consultar el parte y su cliente. RLS limita el acceso al propietario.
    const { data: parte, error: errorParte } = await supabase
      .from("partes")
      .select("numero, estado, cliente_id")
      .eq("id", parteId)
      .single();

    if (errorParte || !parte) {
      return NextResponse.json(
        { error: "No se ha encontrado el parte." },
        { status: 404 },
      );
    }

    if (parte.estado !== "firmado") {
      return NextResponse.json(
        { error: "Solo se pueden enviar partes firmados." },
        { status: 400 },
      );
    }

    const { data: cliente, error: errorCliente } = await supabase
      .from("clientes")
      .select("nombre, email")
      .eq("id", parte.cliente_id)
      .single();

    if (errorCliente || !cliente?.email) {
      return NextResponse.json(
        { error: "El cliente no tiene una dirección de email." },
        { status: 400 },
      );
    }

    // Enviar el PDF adjunto.
    const resend = new Resend(resendKey);
    const contenidoPDF = Buffer.from(await archivo.arrayBuffer());

    const { error: errorEnvio } = await resend.emails.send({
      from: remitente,
      to: [cliente.email],
      subject: `Copia del parte de trabajo ${parte.numero}`,
      html: `
        <p>Hola ${cliente.nombre},</p>
        <p>Adjuntamos una copia del parte de trabajo
        <strong>${parte.numero}</strong>, firmado por ambas partes.</p>
        <p>Gracias por confiar en TELETECNICS S.L.</p>
      `,
      attachments: [
        {
          filename: `Parte-${parte.numero}.pdf`,
          content: contenidoPDF,
        },
      ],
    });

    if (errorEnvio) {
      console.error("Error de Resend:", errorEnvio);

      return NextResponse.json(
        { error: "No se ha podido enviar el correo." },
        { status: 500 },
      );
    }

    return NextResponse.json({ mensaje: "Correo enviado correctamente." });
  } catch (error) {
    console.error("Error al enviar el parte:", error);

    return NextResponse.json(
      { error: "Se ha producido un error al enviar el correo." },
      { status: 500 },
    );
  }
}
