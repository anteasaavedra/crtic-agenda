-- ============================================================================
-- CRTIC Agenda — restricciones EXCLUDE (anti-solapamiento)
-- ============================================================================
--
-- Este archivo añade restricciones que NO son expresables en Prisma:
--   1. Una licencia no puede tener dos slots de disponibilidad solapados.
--   2. Una licencia no puede tener dos reservas CONFIRMADAS solapadas.
--   3. Un participante no puede tener dos reservas CONFIRMADAS solapadas
--      (aunque sean en herramientas distintas).
--
-- Se implementa con:
--   - Extensión btree_gist (permite combinar `=` con operadores GIST)
--   - Columna generada `time_range` de tipo tstzrange [startsAt, endsAt)
--   - Restricciones EXCLUDE USING gist
--
-- Cómo aplicar:
--   Opción A (rápida, MVP):
--     npm run db:apply-constraints
--
--   Opción B (recomendada para producción):
--     1. npx prisma migrate dev --create-only --name add_exclude_constraints
--     2. Copiar el contenido de este archivo dentro del migration.sql generado
--     3. npx prisma migrate dev
--
-- Idempotente: usa IF NOT EXISTS / DO blocks donde es posible.
-- ============================================================================

-- 1) Extensión necesaria para EXCLUDE con `=` + `&&`
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- 2) AvailabilitySlot
-- ----------------------------------------------------------------------------

-- Columna generada con el rango temporal [startsAt, endsAt)
ALTER TABLE "AvailabilitySlot"
  ADD COLUMN IF NOT EXISTS "time_range" tstzrange
  GENERATED ALWAYS AS (tstzrange("startsAt", "endsAt", '[)')) STORED;

CREATE INDEX IF NOT EXISTS "AvailabilitySlot_license_range_idx"
  ON "AvailabilitySlot" USING gist ("licenseAccountId", "time_range");

-- Evita declarar disponibilidad solapada en la misma licencia (slots no bloqueados).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilitySlot_no_overlap'
  ) THEN
    ALTER TABLE "AvailabilitySlot"
      ADD CONSTRAINT "AvailabilitySlot_no_overlap"
      EXCLUDE USING gist ("licenseAccountId" WITH =, "time_range" WITH &&)
      WHERE ("isBlocked" = false);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3) Reservation
-- ----------------------------------------------------------------------------

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "time_range" tstzrange
  GENERATED ALWAYS AS (tstzrange("startsAt", "endsAt", '[)')) STORED;

CREATE INDEX IF NOT EXISTS "Reservation_license_range_idx"
  ON "Reservation" USING gist ("licenseAccountId", "time_range");

CREATE INDEX IF NOT EXISTS "Reservation_participant_range_idx"
  ON "Reservation" USING gist ("participantId", "time_range");

-- Dos reservas CONFIRMED no pueden solapar sobre la misma licencia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_license_no_overlap'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_license_no_overlap"
      EXCLUDE USING gist ("licenseAccountId" WITH =, "time_range" WITH &&)
      WHERE (status = 'CONFIRMED'::"ReservationStatus");
  END IF;
END $$;

-- Un participante no puede tener dos reservas CONFIRMED solapadas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_participant_no_overlap'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_participant_no_overlap"
      EXCLUDE USING gist ("participantId" WITH =, "time_range" WITH &&)
      WHERE (status = 'CONFIRMED'::"ReservationStatus");
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4) Sanity checks de rango (start < end)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilitySlot_time_valid'
  ) THEN
    ALTER TABLE "AvailabilitySlot"
      ADD CONSTRAINT "AvailabilitySlot_time_valid"
      CHECK ("startsAt" < "endsAt");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_time_valid'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_time_valid"
      CHECK ("startsAt" < "endsAt");
  END IF;
END $$;
