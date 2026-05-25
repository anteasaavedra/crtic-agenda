"use client";

import { useState } from "react";

interface Props {
  defaultStart?: string;
  defaultEnd?: string;
}

export function TimeRangePicker({ defaultStart = "09:00", defaultEnd = "19:30" }: Props) {
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const crossesMidnight = endTime && startTime && toMinutes(endTime) <= toMinutes(startTime);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
      {/* Hora inicio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hora inicio (Chile) <span className="text-red-500">*</span>
        </label>
        <input
          type="time"
          name="startTime"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          step="1800"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
        />
      </div>

      {/* Hora término */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hora término (Chile) <span className="text-red-500">*</span>
        </label>
        <input
          type="time"
          name="endTime"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          step="1800"
          className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            crossesMidnight
              ? "border-amber-400 focus:border-amber-500 focus:ring-amber-400"
              : "border-gray-300 focus:border-slate-600 focus:ring-slate-600"
          }`}
        />
        {crossesMidnight && (
          <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
            <span>🌙</span>
            <span>Termina el día siguiente a las {endTime}</span>
          </p>
        )}
      </div>

      {/* Bloque duración — static select, no state needed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bloque (minutos) <span className="text-red-500">*</span>
        </label>
        <select
          name="slotMinutes"
          defaultValue="90"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
        >
          <option value="30">30 min</option>
          <option value="60">60 min</option>
          <option value="90">90 min</option>
          <option value="120">2 horas</option>
          <option value="180">3 horas</option>
        </select>
      </div>
    </div>
  );
}
