"use client";

import { bookReservationGuest } from "@/actions/book-guest";
import BaseBookingForm from "@/components/public/base-booking-form";
import type { Tool } from "@prisma/client";

interface Slot {
  startsAt: string;
  endsAt: string;
  licenseAccountId: string;
}

export default function BookingForm({
  token,
  tool,
  toolId,
  licenseAccountId,
  selectedDate,
  slots,
}: {
  token: string;
  tool: Tool;
  toolId: string;
  licenseAccountId?: string | null;
  selectedDate: string;
  slots: Slot[];
}) {
  return (
    <BaseBookingForm
      toolId={toolId}
      toolName={tool.name}
      licenseAccountId={licenseAccountId}
      selectedDate={selectedDate}
      slots={slots}
      accentColor="#ff4613"
      accentBg="#fff1ed"
      formKey="token"
      formValue={token}
      action={bookReservationGuest}
      buildDateUrl={(newDate) => `/r/${token}?date=${newDate}`}
    />
  );
}
