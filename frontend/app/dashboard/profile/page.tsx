import { requireRole } from "@/lib/auth-guard"
import { getDisplayId } from "@/lib/user-id"
import {
  ProfileForm,
  type ProfileUser,
} from "@/components/dashboard/profile-form"
import type { Role } from "@/lib/roles"

export const dynamic = "force-dynamic"

interface SessionUser {
  id: string
  name: string
  email: string
  image?: string | null
  phone?: string | null
  department?: string | null
  batch?: string | null
  semester?: string | null
  designation?: string | null
  employeeId?: string | null
}

export default async function ProfilePage() {
  const { session, role } = await requireRole("student")
  const user = session.user as unknown as SessionUser

  const profile: ProfileUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: role as Role,
    phone: user.phone ?? null,
    department: user.department ?? null,
    batch: user.batch ?? null,
    semester: user.semester ?? null,
    designation: user.designation ?? null,
    employeeId: user.employeeId ?? null,
    displayId: getDisplayId(user.email),
  }

  return <ProfileForm user={profile} />
}
