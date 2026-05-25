import { prisma } from "@/lib/prisma";
import { hashCancelToken } from "@/lib/share-links";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function cancelReservation(reservationId: string, cancelToken: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { licenseAccount: { include: { tool: true } } },
  });

  if (!reservation) return { error: "Reserva no encontrada" };
  if (reservation.status === "CANCELLED") return { alreadyCancelled: true };
  if (!reservation.cancelTokenHash) return { error: "Esta reserva no puede cancelarse" };

  const expected = hashCancelToken(cancelToken);
  if (expected !== reservation.cancelTokenHash) return { error: "Link de cancelación inválido" };

  const cutoffMs = 60 * 60 * 1000; // 1h
  if (Date.now() > reservation.startsAt.getTime() - cutoffMs) {
    return { error: "No puedes cancelar dentro de 1 hora del inicio de la reserva" };
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Cancelado por participante vía email" },
  });

  return {
    success: true,
    toolName: reservation.licenseAccount.tool.name,
    startsAt: reservation.startsAt,
  };
}

export default async function CancelarPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;

  if (!id || !token) {
    return <ErrorPage message="Link de cancelación inválido o incompleto." />;
  }

  const result = await cancelReservation(id, token);

  if (result.alreadyCancelled) {
    return (
      <Page>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h2 style={{ color: "#1d1f23", fontFamily: "system-ui", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            Reserva ya cancelada
          </h2>
          <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 24px" }}>
            Esta reserva ya fue cancelada anteriormente.
          </p>
          <HomeLink />
        </div>
      </Page>
    );
  }

  if (result.error) {
    return <ErrorPage message={result.error} />;
  }

  const fmt = (d: Date) =>
    d.toLocaleString("es-CL", {
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Santiago",
    });

  return (
    <Page>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#eafaf6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>
          ✓
        </div>
        <h2 style={{ color: "#1d1f23", fontFamily: "system-ui", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          Reserva cancelada
        </h2>
        <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 6px" }}>
          Tu reserva de <strong style={{ color: "#1d1f23" }}>{result.toolName}</strong>
        </p>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px" }}>
          {result.startsAt ? fmt(result.startsAt) : ""} ha sido cancelada.
        </p>
        <HomeLink />
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f7f6", display: "flex", flexDirection: "column" }}>
      <header style={{ backgroundColor: "#1d1f23", padding: "20px 24px" }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ff4613" }}>CRTIC</p>
        <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>Agenda</p>
      </header>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ backgroundColor: "white", borderRadius: 20, border: "1.5px solid #e5e5e3", padding: 40, maxWidth: 440, width: "100%" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Page>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✕</div>
        <h2 style={{ color: "#1d1f23", fontFamily: "system-ui", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          No se pudo cancelar
        </h2>
        <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 24px" }}>{message}</p>
        <HomeLink />
      </div>
    </Page>
  );
}

function HomeLink() {
  return (
    <Link href="/" style={{ display: "inline-block", backgroundColor: "#ff4613", color: "white", textDecoration: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
      Volver al inicio
    </Link>
  );
}
