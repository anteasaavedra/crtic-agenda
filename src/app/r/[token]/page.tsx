import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveShareLink, getToolAvailability } from "@/lib/share-links";
import BookingForm from "@/components/public/booking-form";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const { date } = await searchParams;

  const shareLink = await getActiveShareLink(token);
  if (!shareLink) notFound();

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = date || today;

  const availability = await getToolAvailability(
    shareLink.toolId,
    selectedDate,
    shareLink.licenseAccountId
  );
  if (!availability) notFound();

  const { tool, slots } = availability;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f7f6" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#1d1f23" }}>
        <div className="mx-auto max-w-2xl px-6 py-5 flex items-center gap-4">
          <div>
            <p
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "#ff4613", fontFamily: "var(--font-raleway)" }}
            >
              CRTIC / Reservas
            </p>
            <h1
              className="text-white font-bold text-lg leading-none"
              style={{ fontFamily: "var(--font-raleway)" }}
            >
              {tool.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-8">
        {shareLink.label && (
          <p
            className="mb-2 text-xs font-bold tracking-[0.15em] uppercase"
            style={{ color: "#ff4613", fontFamily: "var(--font-barlow)" }}
          >
            {shareLink.label}
          </p>
        )}
        {tool.description && (
          <p
            className="mb-6 text-sm"
            style={{ color: "#6b7280", fontFamily: "var(--font-barlow)" }}
          >
            {tool.description}
          </p>
        )}

        <BookingForm
          token={token}
          tool={tool}
          toolId={shareLink.toolId}
          licenseAccountId={shareLink.licenseAccountId}
          selectedDate={selectedDate}
          slots={slots}
        />
      </main>
    </div>
  );
}
