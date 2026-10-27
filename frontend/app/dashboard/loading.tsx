import { NoticeCalendarSkeleton } from "@/components/dashboard/notice-calendar-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <NoticeCalendarSkeleton />
    </div>
  )
}
