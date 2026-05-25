"use client";

import { useState, FormEvent, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import MonthCalendar from "@/components/public/month-calendar";

// Constantes de estilo a nivel de módulo — no se recrean en cada render
const inputStyle: CSSProperties = {
  border: "1.5px solid #e5e5e3",
  borderRadius: "10px",
  padding: "10px 14px",
  width: "100%",
  fontSize: "14px",
  color: "#1d1f23",
  backgroundColor: "white",
  outline: "none",
  fontFamily: "var(--font-barlow)",
};

const sectionStyle: CSSProperties = {
  backgroundColor: "white",
  borderRadius: "16px",
  border: "1.5px solid #e5e5e3",
  padding: "20px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: "12px",
  fontFamily: "var(--font-barlow)",
};

// Formateador de hora UTC fuera del render loop
const fmt = (d: Date) =>
  d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

interface Slot {
  startsAt: string;
  endsAt: string;
  licenseAccountId: string;
}

interface BaseBookingFormProps {
  toolId: string;
  toolName: string;
  licenseAccountId?: string | null;
  selectedDate: string;
  slots: Slot[];
  accentColor?: string;
  accentBg?: string;
  formKey: string;
  formValue: string;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  buildDateUrl: (newDate: string) => string;
}

export default function BaseBookingForm({
  toolId,
  toolName,
  licenseAccountId,
  selectedDate,
  slots,
  accentColor = "#ff4613",
  accentBg = "#fff1ed",
  formKey,
  formValue,
  action,
  buildDateUrl,
}: BaseBookingFormProps) {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    setSelectedSlot("");
    router.push(buildDateUrl(newDate));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!guestName.trim()) { setError("Por favor ingresa tu nombre"); return; }
    if (!guestEmail.trim()) { setError("Por favor ingresa tu email"); return; }
    if (!selectedSlot) { setError("Por favor selecciona un horario"); return; }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append(formKey, formValue);
      formData.append("guestName", guestName);
      formData.append("guestEmail", guestEmail);
      formData.append("startsAt", selectedSlot);

      const result = await action(formData);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setSuccess(true);
      }
    } catch (err) {
      setError("Error al procesar la reserva");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ backgroundColor: "#eafaf6", border: "1.5px solid #3bd4ae" }}
      >
        <div
          className="text-5xl mb-3 font-bold"
          style={{ color: "#3bd4ae", fontFamily: "var(--font-raleway)" }}
        >
          ✓
        </div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "#1d1f23", fontFamily: "var(--font-raleway)" }}
        >
          ¡Reserva confirmada!
        </h2>
        <p
          className="mb-1 text-sm"
          style={{ color: "#374151", fontFamily: "var(--font-barlow)" }}
        >
          Revisa tu email para más detalles y las credenciales de acceso.
        </p>
        <p
          className="text-xs"
          style={{ color: "#6b7280", fontFamily: "var(--font-barlow)" }}
        >
          Recibirás recordatorios 24 horas y 1 hora antes del evento.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tus datos */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Tus datos</p>
        <div className="space-y-3">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "#374151", fontFamily: "var(--font-barlow)" }}
            >
              Nombre completo
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Tu nombre"
              disabled={isLoading}
              style={inputStyle}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "#374151", fontFamily: "var(--font-barlow)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={isLoading}
              style={inputStyle}
            />
            <p
              className="mt-1.5 text-xs"
              style={{ color: "#9ca3af", fontFamily: "var(--font-barlow)" }}
            >
              Recibirás confirmación y recordatorios en este email.
            </p>
          </div>
        </div>
      </div>

      {/* Fecha */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Elige fecha</p>
        <MonthCalendar
          toolId={toolId}
          licenseAccountId={licenseAccountId ?? undefined}
          selectedDate={currentDate}
          onDateSelect={handleDateChange}
        />
      </div>

      {/* Horarios */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Horarios disponibles</p>

        {slots.length === 0 ? (
          <p
            className="text-center py-6 text-sm"
            style={{ color: "#9ca3af", fontFamily: "var(--font-barlow)" }}
          >
            No hay horarios disponibles para esta fecha.
          </p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => {
              const start = new Date(slot.startsAt);
              const end = new Date(slot.endsAt);
              const id = slot.startsAt;
              const isSelected = selectedSlot === id;

              return (
                <label
                  key={id}
                  className="flex items-center gap-3 cursor-pointer transition-all"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `1.5px solid ${isSelected ? accentColor : "#e5e5e3"}`,
                    backgroundColor: isSelected ? accentBg : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={id}
                    checked={isSelected}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    disabled={isLoading}
                    style={{ accentColor }}
                    className="w-4 h-4"
                  />
                  <span
                    className="font-semibold text-sm"
                    style={{
                      color: isSelected ? accentColor : "#1d1f23",
                      fontFamily: "var(--font-barlow)",
                    }}
                  >
                    {fmt(start)} – {fmt(end)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "#fef2f2",
            border: "1.5px solid #fecaca",
          }}
        >
          <p
            className="text-sm"
            style={{ color: "#dc2626", fontFamily: "var(--font-barlow)" }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || slots.length === 0}
        className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all"
        style={{
          backgroundColor: slots.length === 0 || isLoading ? "#d1d5db" : accentColor,
          color: "white",
          fontFamily: "var(--font-raleway)",
          cursor: slots.length === 0 || isLoading ? "not-allowed" : "pointer",
          letterSpacing: "0.02em",
        }}
      >
        {isLoading ? "Procesando…" : `Confirmar reserva — ${toolName}`}
      </button>
    </form>
  );
}
