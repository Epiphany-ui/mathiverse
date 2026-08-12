import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side admin check — redirects non-admins
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f5]">
      <AppHeader />
      <div className="flex-1 flex pt-16">
        <AdminNav />
        <main className="flex-1 p-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
