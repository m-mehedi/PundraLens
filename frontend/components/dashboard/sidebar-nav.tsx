"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  DocumentAttachmentIcon,
  Upload01Icon,
  ListChecksIcon,
  GraduationCapIcon,
  UsersIcon,
  UserLock01Icon,
  AiBrain04Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavUser } from "./nav-user"

const navItems = [
  { name: "Overview", url: "/dashboard", icon: Home01Icon },
  { name: "Notices", url: "/dashboard/notices", icon: DocumentAttachmentIcon },
  { name: "LensBot", url: "/dashboard/lensbot", icon: AiBrain04Icon },
]

const adminItems = [
  { name: "Upload Notice", url: "/dashboard/upload-notice", icon: Upload01Icon },
  { name: "Manage Notice", url: "/dashboard/manage-notice", icon: ListChecksIcon },
  { name: "Manage Students", url: "/dashboard/manage-students", icon: GraduationCapIcon },
]

const adminOnlyItems = [
  { name: "Manage Staffs", url: "/dashboard/manage-staffs", icon: UsersIcon },
  { name: "Manage Revoked", url: "/dashboard/manage-revoked", icon: UserLock01Icon },
]

type Role = "student" | "staff" | "admin"

export function SidebarNav({
  user,
  role,
}: {
  user: {
    name: string
    email: string
    image?: string | null
    role: string
  }
  role: Role
}) {
  const pathname = usePathname()
  const { open } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-3 py-2">
          <HugeiconsIcon icon={Home01Icon} className="size-5" />
          {open && <span className="font-semibold">Pundra NoticeLens</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname === item.url}
                  >
                    <HugeiconsIcon icon={item.icon} />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(role === "staff" || role === "admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={pathname === item.url}
                    >
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Staff Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminOnlyItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={pathname === item.url}
                    >
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <Separator />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
