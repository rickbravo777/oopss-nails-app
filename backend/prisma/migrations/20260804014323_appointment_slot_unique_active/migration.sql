-- Prevents double-booking the same specialist+date+startTime, but only among non-cancelled
-- appointments (a cancelled appointment must not block rebooking that slot). This is a
-- partial unique index, which Prisma's schema DSL cannot express — this migration file is
-- the source of truth for this constraint (see comment above the Appointment model).
CREATE UNIQUE INDEX "Appointment_specialist_slot_active_key"
  ON "Appointment" ("specialistId", "date", "startTime")
  WHERE status != 'cancelled';
