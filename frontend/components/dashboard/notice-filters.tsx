"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category, Department } from "@/lib/notice-types"

const ALL = "all"

export interface NoticeFiltersProps {
  departments: Department[]
  categories: Category[]
  showStatus?: boolean
}

export function NoticeFilters({
  departments,
  categories,
  showStatus = false,
}: NoticeFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const status = searchParams.get("status") ?? "published"
  const category = searchParams.get("category") ?? ALL
  const department = searchParams.get("department") ?? ALL
  const query = searchParams.get("q") ?? ""

  const update = React.useCallback(
    (changes: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (!value || value === ALL) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      const next = params.toString()
      startTransition(() => {
        router.replace(next ? `${pathname}?${next}` : pathname, {
          scroll: false,
        })
      })
    },
    [pathname, router, searchParams]
  )

  // The text box is local state so typing stays smooth; the URL (and the
  // server-side query) follows after a short debounce.
  const [searchText, setSearchText] = React.useState(query)
  const [lastQuery, setLastQuery] = React.useState(query)

  // Adjust the local state while rendering when the URL changes elsewhere.
  if (query !== lastQuery) {
    setLastQuery(query)
    setSearchText(query)
  }

  React.useEffect(() => {
    if (searchText === query) return
    const timer = setTimeout(() => update({ q: searchText }), 400)
    return () => clearTimeout(timer)
  }, [searchText, query, update])

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <Input
        type="search"
        placeholder="Search notices…"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        className="md:max-w-xs"
      />

      {showStatus ? (
        <Select
          value={status}
          onValueChange={(value) => update({ status: value ?? "" })}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value={ALL}>All</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={category}
        onValueChange={(value) => update({ category: value ?? "" })}
      >
        <SelectTrigger className="w-full md:w-48">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((item) => (
            <SelectItem key={item.name} value={item.name}>
              {item.icon ? `${item.icon} ` : ""}
              {item.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={department}
        onValueChange={(value) => update({ department: value ?? "" })}
      >
        <SelectTrigger className="w-full md:w-56">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All departments</SelectItem>
          {departments.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending ? (
        <Button variant="ghost" size="sm" disabled>
          Updating…
        </Button>
      ) : null}
    </div>
  )
}
