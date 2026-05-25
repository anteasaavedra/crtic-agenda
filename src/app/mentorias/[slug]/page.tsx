import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getToolAvailability } from "@/lib/share-links";
import PublicBookingForm from "@/components/public/public-booking-form";

export const dynamic = "force-dynamic";

export default async function MentoriaBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date } = await searchParams;

  const tool = await prisma.tool.findUnique({
    where: { slug, isActive: true, category: "MENTORIA" },
  });

  if (!tool) notFound();

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = date ?? today;

  const availability = await getToolAvailability(tool.id, selectedDate);
  const slots = availability?.slots ?? [];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f7f6" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#1d1f23" }}>
        <div className="mx-auto max-w-2xl px-6 py-5 flex items-center gap-4">
          <Link
            href="/mentorias"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "#9ca3af" }}
            aria-label="Volver a mentorías"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "#ff4613", fontFamily: "var(--font-raleway)" }}
            >
              CRTIC / Mentorías
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
        {tool.description && (
          <p
            className="mb-6 text-sm"
            style={{ color: "#6b7280", fontFamily: "var(--font-barlow)" }}
          >
            {tool.description}
          </p>
        )}

        <PublicBookingForm
          toolSlug={slug}
          toolName={tool.name}
          toolId={tool.id}
          selectedDate={selectedDate}
          slots={slots}
          basePath="/mentorias"
          accentColor="#3bd4ae"
          accentBg="#eafaf6"
        />
      </main>
    </div>
  );
}
