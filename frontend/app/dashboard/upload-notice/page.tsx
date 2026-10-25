import { requireRole } from "@/lib/auth-guard"
import { listDepartments } from "@/lib/notice-lookups"
import { UploadNoticeWorkbench } from "@/components/upload-notice/upload-notice-workbench"

export const dynamic = "force-dynamic"

export default async function UploadNoticePage() {
  const { session } = await requireRole("staff")

  // The department list comes from the backend so the notice form offers
  // the real codes and names instead of free text.
  const departments = listDepartments()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex-1">
        <UploadNoticeWorkbench
          departments={departments}
          userId={session.user.id}
        />
      </div>
    </div>
  )
}
