import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col bg-white h-svh overflow-y-auto">
        {children}
      </main>
    </SidebarProvider>
  );
}
