import { NextRequest, NextResponse } from "next/server";
import { cancelReservationGuest } from "@/actions/book-guest";

/**
 * GET /r/[token]/cancel?id=[reservationId]&token=[cancelToken]
 *
 * Endpoint público para cancelar una reserva vía link del email.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("id");
    const cancelToken = searchParams.get("token");

    if (!reservationId || !cancelToken) {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 }
      );
    }

    const result = await cancelReservationGuest(reservationId, cancelToken);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[cancel-route]", msg);
    return NextResponse.json(
      { error: "Error al procesar cancelación" },
      { status: 500 }
    );
  }
}
