"use client"

import { usePathname } from "next/navigation"
import { getPageName } from "@/lib/dashboard-nav"

export function PageTitle() {
  const pathname = usePathname()
  return <h2 className="text-lg font-semibold">{getPageName(pathname)}</h2>
}
