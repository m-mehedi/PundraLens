export const navItems = [
  { name: "Overview", url: "/dashboard" },
  { name: "Notices", url: "/dashboard/notices" },
  { name: "LensBot", url: "/dashboard/lensbot" },
]

export const adminItems = [
  { name: "Upload Notice", url: "/dashboard/upload-notice" },
  { name: "Manage Notice", url: "/dashboard/manage-notice" },
  { name: "Manage Students", url: "/dashboard/manage-students" },
]

export const adminOnlyItems = [
  { name: "Manage Staffs", url: "/dashboard/manage-staffs" },
  { name: "Manage Revoked", url: "/dashboard/manage-revoked" },
]

/** Reached from the account menu rather than the sidebar. */
export const accountItems = [{ name: "Profile", url: "/dashboard/profile" }]

/** Returns the navigation name for a given path, or "Dashboard" as a fallback. */
export function getPageName(pathname: string | undefined | null): string {
  if (!pathname) return "Dashboard"
  const allItems = [
    ...navItems,
    ...adminItems,
    ...adminOnlyItems,
    ...accountItems,
  ].sort((a, b) => b.url.length - a.url.length)
  const item = allItems.find(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`)
  )
  return item?.name ?? "Dashboard"
}
