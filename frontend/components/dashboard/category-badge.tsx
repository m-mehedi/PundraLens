import { HugeiconsIcon } from "@hugeicons/react"
import {
  BellIcon,
  Calendar01Icon,
  Chart01Icon,
  Coins01Icon,
  DocumentAttachmentIcon,
  FileTextIcon,
  MedalFirstPlaceIcon,
  PartyPopperIcon,
  UserPlusIcon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import type { NoticeCategory } from "@/lib/notice-types"

export const CATEGORY_ICONS: Record<
  NoticeCategory,
  { label: string; icon: typeof BellIcon }
> = {
  exam: { label: "Examination", icon: DocumentAttachmentIcon },
  registration: { label: "Registration", icon: UserPlusIcon },
  admission: { label: "Admission", icon: FileTextIcon },
  fee: { label: "Fee", icon: Coins01Icon },
  holiday: { label: "Holiday", icon: Calendar01Icon },
  event: { label: "Event", icon: PartyPopperIcon },
  scholarship: { label: "Scholarship", icon: MedalFirstPlaceIcon },
  result: { label: "Result", icon: Chart01Icon },
  general: { label: "General", icon: BellIcon },
}

export const ALL_CATEGORIES: {
  value: NoticeCategory
  label: string
  icon: typeof BellIcon
}[] = Object.entries(CATEGORY_ICONS).map(([value, { label, icon }]) => ({
  value: value as NoticeCategory,
  label,
  icon,
}))

export interface CategoryBadgeProps {
  category: NoticeCategory
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const { label, icon } = CATEGORY_ICONS[category]
  return (
    <Badge variant="secondary" className={className}>
      <HugeiconsIcon icon={icon} className="mr-1 size-3" />
      {label}
    </Badge>
  )
}
