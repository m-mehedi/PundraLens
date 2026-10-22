import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { UploadNoticeWorkbench } from "@/components/upload-notice/upload-notice-workbench"

export default async function UploadNoticePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin" && userRole !== "staff") {
    redirect("/unauthorized")
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Notice</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a photo or scan of a notice. The system will detect corners,
          let you adjust them, then extract the text.
        </p>
      </div>

      <div className="flex-1">
        <UploadNoticeWorkbench />
      </div>
    </div>
  )
}
