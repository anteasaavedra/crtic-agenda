"use client";

import { bookPublicTool } from "@/actions/book-public";
import BaseBookingForm from "@/components/public/base-booking-form";

interface Slot {
  startsAt: string;
  endsAt: string;
  licenseAccountId: string;
}

interface Props {
  toolSlug: string;
  toolName: string;
  toolId: string;
  licenseAccountId?: string;
  selectedDate: string;
  slots: Slot[];
  basePath: string;
  accentColor?: string;
  accentBg?: string;
}

export default function PublicBookingForm({
  toolSlug,
  toolName,
  toolId,
  licenseAccountId,
  selectedDate,
  slots,
  basePath,
  accentColor,
  accentBg,
}: Props) {
  return (
    <BaseBookingForm
      toolId={toolId}
      toolName={toolName}
      licenseAccountId={licenseAccountId}
      selectedDate={selectedDate}
      slots={slots}
      accentColor={accentColor}
      accentBg={accentBg}
      formKey="toolSlug"
      formValue={toolSlug}
      action={bookPublicTool}
      buildDateUrl={(newDate) => `${basePath}/${toolSlug}?date=${newDate}`}
    />
  );
}
