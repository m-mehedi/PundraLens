import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { GalleryVerticalEndIcon, Mail01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={GalleryVerticalEndIcon} className="size-4" />
          </div>
          Acme Inc.
        </a>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={Mail01Icon} className="size-5" />
              </div>
              <CardTitle className="text-lg">Reset your password</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Passwords are reset by a PundraLens administrator, not by email.
              Contact the registrar or your department office and they will
              issue you a new temporary password, which you can change under
              Dashboard &rarr; Profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              nativeButton={false}
              render={<Link href="/login">Back to login</Link>}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
