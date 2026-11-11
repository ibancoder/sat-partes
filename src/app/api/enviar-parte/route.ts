import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

function escaparHTML(valor: string) {
  return valor.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entidades[caracter];
  });
}

export async function POST(request: Request) {
  try {
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

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const remitente = process.env.SMTP_FROM_EMAIL;

    const imapHost = process.env.IMAP_HOST;
    const imapPort = Number(process.env.IMAP_PORT || 993);
    const imapUser = process.env.IMAP_USER;
    const imapPassword = process.env.IMAP_PASSWORD;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      !smtpHost ||
      !smtpUser ||
      !smtpPassword ||
      !remitente
    ) {
      throw new Error("Falta configurar alguna variable de entorno.");
    }

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

    const contenidoPDF = Buffer.from(await archivo.arrayBuffer());

    const opcionesCorreo = {
      from: remitente,
      to: cliente.email,
      subject: `Copia del parte de trabajo ${parte.numero}`,
      html: `
        <p>Hola ${escaparHTML(cliente.nombre)},</p>
        <p>Adjuntamos una copia del parte de trabajo
        <strong>${escaparHTML(String(parte.numero))}</strong>,
        firmado por ambas partes.</p>
        <p>Gracias por confiar en TELETECNICS S.L.</p>
      `,
      attachments: [
        {
          filename: `Parte-${parte.numero}.pdf`,
          content: contenidoPDF,
          contentType: "application/pdf",
        },
      ],
    };

    // Preparar una copia completa del correo en formato MIME.
    const transportadorArchivo = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });

    const correoPreparado = await transportadorArchivo.sendMail(opcionesCorreo);

    const mensajeMime = correoPreparado.message;

    if (!Buffer.isBuffer(mensajeMime)) {
      throw new Error("No se pudo preparar la copia del correo.");
    }

    // Enviar el correo al cliente mediante SMTP.
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail(opcionesCorreo);

    // Guardar una copia en la carpeta Enviados mediante IMAP.
    let copiaGuardada = false;

    if (imapHost && imapUser && imapPassword) {
      const imap = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: imapPort === 993,
        auth: {
          user: imapUser,
          pass: imapPassword,
        },
        logger: false,
      });

      try {
        await imap.connect();

        const carpetas = await imap.list();

        const carpetaEnviados = carpetas.find(
          (carpeta) => carpeta.specialUse === "\\Sent",
        );

        if (!carpetaEnviados) {
          throw new Error(
            "No se ha encontrado la carpeta de enviados en IONOS.",
          );
        }

        await imap.append(carpetaEnviados.path, mensajeMime, ["\\Seen"]);

        copiaGuardada = true;
      } finally {
        if (imap.usable) {
          await imap.logout();
        }
      }
    }

    return NextResponse.json({
      mensaje: copiaGuardada
        ? "Correo enviado y copia guardada en Enviados."
        : "Correo enviado, pero no se ha podido guardar la copia.",
      copiaGuardada,
    });
  } catch (error) {
    console.error("Error al enviar el parte:", error);

    return NextResponse.json(
      { error: "Se ha producido un error al enviar el correo." },
      { status: 500 },
    );
  }
}
