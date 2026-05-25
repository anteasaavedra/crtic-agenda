# CRTIC Agenda

Sistema de reserva de licencias compartidas para cursos, residencias y programas formativos de **CRTIC**.

Permite a un administrador gestionar herramientas (Krea, Runway, etc.) con licencias limitadas, definir disponibilidad y credenciales que rotan semanalmente, y a los participantes reservar bloques horarios para usar esas licencias. Al confirmar una reserva, el sistema envía correo, crea el evento en Google Calendar y entrega las credenciales vigentes.

> **Estado actual:** Etapa 1 completada — base del proyecto, schema y restricciones críticas. El panel de administración, la vista de participante, la integración con Google Calendar y el envío de correos vendrán en etapas siguientes.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS 3** + **shadcn/ui** (componentes a instalar bajo demanda)
- **PostgreSQL 14+** con extensión `btree_gist`
- **Prisma 6** (ORM)
- **pg-boss** para cola de jobs (a integrar en etapa posterior)
- **Resend** para correos transaccionales (a integrar en etapa posterior)
- **Google Calendar API** (a integrar en etapa posterior)
- Hosting recomendado: **Vercel** (app) + **Neon** o **Supabase** (Postgres)

---

## Instalación local

### 1. Requisitos previos

- Node.js 20+
- PostgreSQL 14+ accesible localmente o en la nube (Neon, Supabase, Docker, etc.)
- La base de datos debe permitir crear la extensión `btree_gist` (incluida por defecto en Postgres oficial; en Neon/Supabase ya está disponible).

### 2. Clonar e instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` y completa al menos:

- `DATABASE_URL` — conexión a tu Postgres.
- `NEXTAUTH_SECRET` — genera con `openssl rand -base64 32`.
- `ENCRYPTION_KEY` — genera con `openssl rand -base64 32`. **Si la pierdes, las credenciales cifradas no podrán recuperarse.**

Las variables de Google, Resend y otras pueden quedar vacías por ahora; se usarán en etapas posteriores.

### 4. Aplicar migraciones de Prisma

```bash
npm run prisma:migrate -- --name init
```

Esto crea todas las tablas, enums e índices a partir de `prisma/schema.prisma`.

### 5. Aplicar las restricciones EXCLUDE (anti-solapamiento)

Las restricciones que impiden reservas solapadas **no son expresables en Prisma** y viven en `prisma/sql/exclude_constraints.sql`. Hay dos formas de aplicarlas:

**Opción A — Rápida (recomendada para dev):**

```bash
npm run db:apply-constraints
```

**Opción B — Como migración versionada (recomendada para producción):**

```bash
npx prisma migrate dev --create-only --name add_exclude_constraints
# Copia el contenido de prisma/sql/exclude_constraints.sql dentro del
# archivo migration.sql recién creado en prisma/migrations/...
npx prisma migrate dev
```

### 6. Levantar el servidor de desarrollo

```bash
npm run dev
```

La app queda disponible en [http://localhost:3000](http://localhost:3000).

---

## Variables de entorno

| Variable | Uso | Requerida en Etapa 1 |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres | ✅ |
| `NEXTAUTH_SECRET` | Firma de sesiones | Recomendado |
| `ENCRYPTION_KEY` | Cifrado AES-256-GCM de credenciales y tokens | Recomendado |
| `GOOGLE_CLIENT_ID` | OAuth Google Calendar | ❌ (etapa posterior) |
| `GOOGLE_CLIENT_SECRET` | OAuth Google Calendar | ❌ (etapa posterior) |
| `RESEND_API_KEY` | Envío de correos | ❌ (etapa posterior) |
| `APP_URL` | URL pública de la app (para enlaces en correos) | Recomendado |

---

## Comandos principales

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en localhost:3000 |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run prisma:generate` | Regenera el cliente de Prisma |
| `npm run prisma:migrate` | Crea y aplica una migración en dev |
| `npm run prisma:migrate:deploy` | Aplica migraciones pendientes (producción) |
| `npm run prisma:studio` | UI web para inspeccionar la BD |
| `npm run db:apply-constraints` | Aplica las restricciones EXCLUDE manuales |

---

## Modelo de datos (resumen)

```
User ── 1:1 ── GoogleAccount
  │
  └─ N ─ Participant ─ N ─ Course ─ N ─ CourseTool ─ N ─ Tool
                                                          │
                                                          └─ N ─ LicenseAccount
                                                                    │
                                                                    ├─ N ─ WeeklyCredential (cifradas)
                                                                    ├─ N ─ AvailabilitySlot
                                                                    └─ N ─ Reservation ─ N ─ Participant

Logs: EmailLog · CalendarEventLog · AuditLog
```

### Restricciones críticas

Definidas en `prisma/sql/exclude_constraints.sql`:

- **`AvailabilitySlot_no_overlap`** — Una licencia no puede tener dos slots disponibles solapados.
- **`Reservation_license_no_overlap`** — Dos reservas confirmadas no pueden solaparse sobre la misma licencia.
- **`Reservation_participant_no_overlap`** — Un participante no puede tener dos reservas confirmadas solapadas (aunque sean en herramientas distintas).
- **`*_time_valid`** — `startsAt < endsAt` en todas las tablas con rango.

Todas se implementan con `EXCLUDE USING gist` sobre una columna generada `time_range tstzrange [startsAt, endsAt)` + extensión `btree_gist`. Esto garantiza la integridad **a nivel de base de datos**, no por código defensivo.

---

## Estructura de carpetas

```
.
├── prisma/
│   ├── schema.prisma           # Modelo de datos (Prisma)
│   └── sql/
│       └── exclude_constraints.sql   # Restricciones anti-solapamiento
├── src/
│   ├── app/                    # App Router (Next.js)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   └── lib/
│       ├── prisma.ts           # Cliente Prisma singleton
│       └── utils.ts            # Helper cn() para Tailwind
├── components.json             # Configuración shadcn/ui
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── .env.example
└── package.json
```

---

## Próximas etapas

- **Etapa 2** — Auth admin (email + password) + CRUD de cursos, herramientas, licencias y participantes + módulo de cifrado AES-256-GCM y carga de `WeeklyCredential`. `AuditLog` desde el primer endpoint.
- **Etapa 3** — Editor de `AvailabilitySlot` + motor de reservas con todas las reglas de negocio.
- **Etapa 4** — Magic link + vista del participante + reserva.
- **Etapa 5** — Resend + plantillas de correo + jobs (pg-boss) para confirmación y recordatorios.
- **Etapa 6** — Google Calendar (crear/actualizar/eliminar evento en calendario administrativo y participante).
- **Etapa 7** — Endurecimiento, exportación CSV, rate limiting, pruebas E2E.
