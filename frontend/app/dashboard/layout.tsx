import { requireRole } from "@/lib/auth-guard"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { PageTitle } from "@/components/dashboard/page-title"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import type { Role } from "@/lib/roles"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Handles the "not signed in" and "revoked" cases too.
  const { session, role } = await requireRole("student")

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: (session.user as { image?: string | null }).image ?? null,
    role,
  }

  return (
    <SidebarProvider>
      <SidebarNav user={user} role={role as Role} />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-6">
          <SidebarTrigger />
          <PageTitle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
