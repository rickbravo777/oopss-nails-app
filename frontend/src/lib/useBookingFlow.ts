import { useState } from "react";

import { type AppointmentDetail, type AvailabilitySlot, checkAvailability, createAppointment } from "./api/appointments";
import { fetchServiceDetail, type ServiceSummary } from "./api/services";

// Shared data/fetch logic for every step after "which service" — used by both the modal
// wizard (GuidedBooking.tsx, single-category entry) and the chat's inline welcome flow
// (multi-category entry). Keeping this in one hook means a fix to booking logic (or a bug)
// can't silently diverge between the two entry points, which duplicating it risked.
export function useBookingFlow(sessionToken: string) {
  const [specialists, setSpecialists] = useState<{ id: string; name: string }[] | null>(null);
  const [specialist, setSpecialist] = useState<{ id: string; name: string } | null>(null);
  // A friendly label ("jue 7 ago"), not just the ISO date — set the moment a date chip is
  // tapped, independent of `slots` (which only confirms the date once availability finishes
  // loading), so the "fecha" step's summary row can render immediately without waiting.
  const [selectedDateLabel, setSelectedDateLabel] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppointmentDetail | null>(null);

  // Returns the specialist list and whether it was auto-selected (only one qualifies) so
  // the caller knows whether to show the "elige especialista" step or skip straight to fecha.
  async function loadSpecialistsForService(
    service: ServiceSummary,
  ): Promise<{ specialists: { id: string; name: string }[]; autoSelected: boolean }> {
    setError(null);
    const detail = await fetchServiceDetail(service.id);
    setSpecialists(detail.specialists);
    if (detail.specialists.length === 1) {
      setSpecialist(detail.specialists[0]);
      return { specialists: detail.specialists, autoSelected: true };
    }
    return { specialists: detail.specialists, autoSelected: false };
  }

  async function loadSlots(service: ServiceSummary, forSpecialist: { id: string }, isoDate: string) {
    setSlots(null);
    setSlot(null);
    setError(null);
    try {
      const res = await checkAvailability([service.id], forSpecialist.id, isoDate, isoDate);
      setSlots(res.slots);
    } catch {
      setError("No se pudo consultar la disponibilidad.");
    }
  }

  async function confirmBooking(service: ServiceSummary): Promise<AppointmentDetail | null> {
    if (!specialist || !slot || !clientName.trim() || !clientPhone.trim()) return null;
    setSubmitting(true);
    setError(null);
    try {
      const appt = await createAppointment(sessionToken, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        specialistId: specialist.id,
        date: slot.date,
        startTime: slot.startTime,
        services: [service.id],
      });
      setResult(appt);
      return appt;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agendar la cita.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSpecialists(null);
    setSpecialist(null);
    setSelectedDateLabel(null);
    setSlots(null);
    setSlot(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setResult(null);
    setError(null);
  }

  return {
    specialists,
    specialist,
    setSpecialist,
    selectedDateLabel,
    setSelectedDateLabel,
    slots,
    slot,
    setSlot,
    clientName,
    setClientName,
    clientPhone,
    setClientPhone,
    clientEmail,
    setClientEmail,
    submitting,
    error,
    result,
    loadSpecialistsForService,
    loadSlots,
    confirmBooking,
    reset,
  };
}
