"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { Editor } from "@/components/Editor";

export default function NewProjectPage() {
  return (
    <AdminGuard>
      <Editor mode="new" />
    </AdminGuard>
  );
}
