import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon } from "@hugeicons/core-free-icons"

async function signOut() {
  "use server"

  await auth.api.signOut({
    headers: await headers(),
  })

  redirect("/")
}

export default async function RevokedPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "revoked") {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Account Revoked</CardTitle>
          <CardDescription>
            Your access has been suspended
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Your account got revoked. Please contact the administration for more information.
            </AlertDescription>
          </Alert>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full gap-1.5">
              <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" />
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
