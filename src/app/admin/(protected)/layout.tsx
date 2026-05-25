import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { NavSidebar } from "@/components/admin/nav-sidebar";
import { Providers } from "@/components/providers";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin/login");

  return (
    <Providers>
      <div className="flex min-h-screen bg-gray-50">
        <NavSidebar user={session.user} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-8">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
