"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { ProfileEditor } from "@/components/ProfileEditor";

export default function ProfilePage() {
  return (
    <AdminGuard>
      <ProfileEditor />
    </AdminGuard>
  );
}
