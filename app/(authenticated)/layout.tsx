import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <SidebarProvider>
      <AppSidebar />
      <NotificationBell />
      <main className="flex-1 flex flex-col bg-background h-svh overflow-y-auto">
        {children}
      </main>
    </SidebarProvider>
  );
}
