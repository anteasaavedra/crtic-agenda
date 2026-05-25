import {
  reservationConfirmedTemplate,
  reminderTemplate,
  cancellationTemplate,
} from "@/lib/email-templates";
import { EmailHtmlPreview } from "@/components/admin/email-html-preview";

const MOCK = {
  participantName: "María González",
  courseName: "Diplomado IA 2025",
  toolName: "KREA",
  accessUrl: "https://krea.ai",
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

const TEMPLATES = [
  {
    id: "confirmed",
    label: "Confirmación de reserva",
    description: "Se envía al confirmar una reserva",
    badge: "✓",
    fn: () => reservationConfirmedTemplate(MOCK),
  },
  {
    id: "confirmed-no-cred",
    label: "Confirmación (sin credenciales)",
    description: "Cuando las credenciales aún no están cargadas",
    badge: "✓",
    fn: () => reservationConfirmedTemplate({ ...MOCK, credential: null }),
  },
  {
    id: "reminder-24h",
    label: "Recordatorio 24 horas antes",
    description: "Se envía el día anterior a la reserva",
    badge: "🔔",
    fn: () => reminderTemplate(MOCK, "24h"),
  },
  {
    id: "reminder-1h",
    label: "Recordatorio 1 hora antes",
    description: "Incluye las credenciales de acceso",
    badge: "⏰",
    fn: () => reminderTemplate(MOCK, "1h"),
  },
  {
    id: "reminder-1h-no-cred",
    label: "Recordatorio 1h (sin credenciales)",
    description: "Alerta cuando faltan las credenciales",
    badge: "⚠️",
    fn: () => reminderTemplate({ ...MOCK, credential: null }, "1h"),
  },
  {
    id: "cancelled",
    label: "Cancelación",
    description: "Se envía cuando se cancela una reserva",
    badge: "✕",
    fn: () => cancellationTemplate({ ...MOCK, reason: "Solicitado por el participante" }),
  },
];

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selected = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
  const tpl = selected.fn();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preview de correos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vista previa exacta de los emails que reciben los participantes. Datos de ejemplo.
        </p>
      </div>

      <div className="flex gap-6 items-start">

        {/* Sidebar */}
        <div className="w-60 shrink-0 space-y-1">
          {TEMPLATES.map((t) => (
            <a
              key={t.id}
              href={`/admin/email-preview?id=${t.id}`}
              className={`flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                selected.id === t.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base leading-none mt-0.5 shrink-0">{t.badge}</span>
              <div>
                <p className={`font-medium leading-tight ${selected.id === t.id ? "text-white" : "text-gray-900"}`}>
                  {t.label}
                </p>
                <p className={`text-xs mt-0.5 leading-tight ${selected.id === t.id ? "text-slate-300" : "text-gray-400"}`}>
                  {t.description}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Asunto */}
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Asunto</span>
            <span className="text-sm text-gray-900 font-medium">{tpl.subject}</span>
          </div>

          {/* Email renderizado */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-gray-400">Vista previa</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "640px" }}>
              <EmailHtmlPreview html={tpl.html} />
            </div>
          </div>

          {/* Texto plano */}
          <details>
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 select-none">
              Ver versión texto plano
            </summary>
            <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-x-auto">
              {tpl.text}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
