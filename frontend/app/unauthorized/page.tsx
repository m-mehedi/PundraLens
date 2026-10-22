import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { CancelCircleIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={CancelCircleIcon} className="size-5" />
            </div>
            <CardTitle className="text-lg">Access denied</CardTitle>
          </div>
          <CardDescription className="mt-2">
            Your account does not have permission to open this page. Ask an
            administrator if you think this is a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard">Back to dashboard</Link>}
          />
        </CardContent>
      </Card>
    </div>
  )
}
