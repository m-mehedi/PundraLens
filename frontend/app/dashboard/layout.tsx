import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { LLMStatusChip } from "@/components/dashboard/llm-status-chip"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as any).role ?? "student"

  if (userRole === "revoked") {
    redirect("/revoked")
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    role: userRole,
  }
  const role = (userRole as "student" | "staff" | "admin") ?? "student"

  return (
    <SidebarProvider>
      <SidebarNav user={user} role={role} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <div className="ml-auto">
            <LLMStatusChip />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
