"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { CardEditor } from "@/components/card/editor/CardEditor";

export default function CardDesignPage() {
  return (
    <AdminGuard>
      <CardEditor />
    </AdminGuard>
  );
}
