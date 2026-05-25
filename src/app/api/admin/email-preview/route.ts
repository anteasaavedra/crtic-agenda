import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  reservationConfirmedTemplate,
  reminderTemplate,
  cancellationTemplate,
} from "@/lib/email-templates";

const MOCK = {
  participantName: "María González",
  courseName: "Diplomado IA 2025",
  toolName: "KREA",
  startsAt: new Date("2026-05-20T14:00:00Z"),
  endsAt:   new Date("2026-05-20T15:30:00Z"),
  credential: {
    username: "usuario@krea.ai",
    password: "Clave2025#CRTIC",
    weekLabel: "2026-W21",
  },
  cancelToken: "token-de-ejemplo",
  reservationId: "cjld2cjxh0000qzrmn831i7rn",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "confirmed";

  let html = "";

  switch (id) {
    case "confirmed":
      html = reservationConfirmedTemplate(MOCK).html; break;
    case "confirmed-no-cred":
      html = reservationConfirmedTemplate({ ...MOCK, credential: null }).html; break;
    case "reminder-24h":
      html = reminderTemplate(MOCK, "24h").html; break;
    case "reminder-1h":
      html = reminderTemplate(MOCK, "1h").html; break;
    case "reminder-1h-no-cred":
      html = reminderTemplate({ ...MOCK, credential: null }, "1h").html; break;
    case "cancelled":
      html = cancellationTemplate({ ...MOCK, reason: "Solicitado por el participante" }).html; break;
    default:
      html = reservationConfirmedTemplate(MOCK).html;
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
