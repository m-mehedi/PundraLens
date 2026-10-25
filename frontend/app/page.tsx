import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DocumentAttachmentIcon,
  Upload01Icon,
  UsersIcon,
  Shield01Icon,
  BellIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const features = [
  {
    icon: DocumentAttachmentIcon,
    title: "View Notices",
    description:
      "Browse and read all published notices in a clean, organized interface. Never miss an important announcement.",
  },
  {
    icon: Upload01Icon,
    title: "Manage Notices",
    description:
      "Upload, edit, and manage notices with ease. Perfect for staff and administrators to keep information current.",
  },
  {
    icon: UsersIcon,
    title: "Student Portal",
    description:
      "Dedicated student access to view notices, track updates, and stay connected with the institution.",
  },
  {
    icon: Shield01Icon,
    title: "Role-Based Access",
    description:
      "Secure access control ensures students, staff, and admins only see what they need. No more, no less.",
  },
  {
    icon: BellIcon,
    title: "Real-Time Updates",
    description:
      "Stay informed with instant notice updates. New announcements appear immediately for all relevant users.",
  },
  {
    icon: Settings02Icon,
    title: "Easy Administration",
    description:
      "Manage students, staff, and notices from a single dashboard. Intuitive tools for efficient administration.",
  },
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center bg-gradient-to-b from-muted/50 to-background px-6 py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          <HugeiconsIcon icon={BellIcon} className="mr-1 size-3" />
          Notice Management Made Simple
        </Badge>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Welcome to <span className="text-primary">PundraNoticeLens</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A modern platform for managing institutional notices. Stay connected
          with announcements, manage content, and keep your community informed —
          all in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/login">Log In</Link>}
          />
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/signup">Sign Up</Link>}
          />
        </div>
      </section>

      <Separator />

      {/* Features Section */}
      <section className="flex flex-col items-center px-6 py-20">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-3">
            Features
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to manage notices
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            PundraNoticeLens provides a complete solution for institutional
            notice management, from publishing to student access.
          </p>
        </div>

        <div className="grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={feature.icon} className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
                <CardDescription className="mt-2">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={DocumentAttachmentIcon} className="size-4" />
          <span className="font-semibold text-foreground">
            PundraNoticeLens
          </span>
        </div>
        <p>
          © {new Date().getFullYear()} PundraNoticeLens. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
