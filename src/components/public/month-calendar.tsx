"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  toolId?: string;
  licenseAccountId?: string;
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function toYYYYMMDD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Calculado una vez por módulo — no cambia durante la sesión
const today = new Date().toISOString().split("T")[0];

export default function MonthCalendar({ toolId, licenseAccountId, selectedDate, onDateSelect }: Props) {
  const [viewYear,  setViewYear]  = useState(() => parseInt(selectedDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1);
  const [dateCounts, setDateCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: toYYYYMM(year, month) });
      if (licenseAccountId) params.set("licenseAccountId", licenseAccountId);
      else if (toolId)      params.set("toolId", toolId);

      const res  = await fetch(`/api/availability/monthly?${params}`);
      const data = await res.json();
      setDateCounts(data.dates ?? {});
    } catch {
      setDateCounts({});
    } finally {
      setLoading(false);
    }
  }, [toolId, licenseAccountId]);

  useEffect(() => {
    fetchMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, fetchMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Construir grilla del mes
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Ajustar para que empiece en lunes (0=Lun … 6=Dom)
  const startOffset = (firstDay + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Completar hasta múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);

  // Colores según disponibilidad
  function getDayStyle(dateStr: string, isSelected: boolean, isPast: boolean) {
    if (isPast) {
      return {
        bg: "transparent",
        text: "#d1d5db",
        border: "transparent",
        cursor: "default",
      };
    }
    if (isSelected) {
      return {
        bg: "#1d1f23",
        text: "#ffffff",
        border: "#1d1f23",
        cursor: "pointer",
      };
    }
    const count = dateCounts[dateStr] ?? 0;
    if (count === 0) {
      return {
        bg: "#f9fafb",
        text: "#9ca3af",
        border: "#f3f4f6",
        cursor: "default",
      };
    }
    if (count === 1) {
      return {
        bg: "#fffbeb",
        text: "#92400e",
        border: "#fde68a",
        cursor: "pointer",
      };
    }
    // count >= 2
    return {
      bg: "#f0fdf4",
      text: "#166534",
      border: "#bbf7d0",
      cursor: "pointer",
    };
  }

  const canGoPrev = !(viewYear === parseInt(today.slice(0, 4)) && viewMonth === parseInt(today.slice(5, 7)) - 1);

  return (
    <div>
      {/* Header del mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          style={{
            color: canGoPrev ? "#1d1f23" : "#d1d5db",
            cursor: canGoPrev ? "pointer" : "default",
            background: "none",
            border: "none",
            fontSize: "18px",
            padding: "4px 8px",
            borderRadius: "6px",
          }}
        >
          ←
        </button>
        <span style={{ fontFamily: "var(--font-raleway)", fontWeight: 700, fontSize: "15px", color: "#1d1f23" }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{ color: "#1d1f23", background: "none", border: "none", fontSize: "18px", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}
        >
          →
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#166534", fontFamily: "var(--font-barlow)" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#86efac", display: "inline-block" }} />
          Disponible
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#92400e", fontFamily: "var(--font-barlow)" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fde68a", display: "inline-block" }} />
          Último cupo
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#9ca3af", fontFamily: "var(--font-barlow)" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e5e7eb", display: "inline-block" }} />
          Sin horarios
        </span>
      </div>

      {/* Días de la semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "#9ca3af",
              padding: "4px 0",
              fontFamily: "var(--font-barlow)",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px", fontFamily: "var(--font-barlow)" }}>
          Cargando disponibilidad…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;

            const dateStr  = toYYYYMMDD(viewYear, viewMonth, day);
            const isPast   = dateStr < today;
            const isSelected = dateStr === selectedDate;
            const count    = dateCounts[dateStr] ?? 0;
            const clickable = !isPast && count > 0;
            const style    = getDayStyle(dateStr, isSelected, isPast);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!clickable && !isSelected}
                onClick={() => clickable && onDateSelect(dateStr)}
                title={
                  isPast ? undefined
                  : count === 0 ? "Sin disponibilidad"
                  : count === 1 ? "1 horario disponible"
                  : `${count} horarios disponibles`
                }
                style={{
                  background:   style.bg,
                  color:        style.text,
                  border:       `1.5px solid ${style.border}`,
                  borderRadius: "8px",
                  padding:      "8px 4px",
                  textAlign:    "center",
                  fontSize:     "13px",
                  fontWeight:   isSelected ? 700 : 500,
                  cursor:       style.cursor,
                  fontFamily:   "var(--font-barlow)",
                  lineHeight:   1,
                  transition:   "all 0.1s",
                }}
              >
                {day}
                {dateStr === today && !isSelected && (
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#ff4613", margin: "2px auto 0" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
