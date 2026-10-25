"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_CATEGORIES } from "./category-badge"
import type { Department } from "@/lib/notice-types"

const ALL = "all"

const STATUS_ITEMS: Record<string, React.ReactNode> = {
  published: "Published",
  draft: "Drafts",
  archived: "Archived",
  [ALL]: "All",
}

const CATEGORY_ITEMS: Record<string, React.ReactNode> = {
  [ALL]: "All categories",
  ...Object.fromEntries(ALL_CATEGORIES.map((item) => [item.value, item.label])),
}

export interface NoticeFiltersProps {
  departments: Department[]
  showStatus?: boolean
}

export function NoticeFilters({
  departments,
  showStatus = false,
}: NoticeFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const departmentItems = React.useMemo<Record<string, React.ReactNode>>(
    () => ({
      [ALL]: "All departments",
      ...Object.fromEntries(departments.map((item) => [item.code, item.name])),
    }),
    [departments]
  )

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
      <InputGroup className="md:max-w-xs">
        <InputGroupAddon>
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search notices…"
          aria-label="Search notices"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </InputGroup>

      {showStatus ? (
        <Select
          value={status}
          onValueChange={(value) => update({ status: value ?? "" })}
          items={STATUS_ITEMS}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published" label="Published">
              Published
            </SelectItem>
            <SelectItem value="draft" label="Drafts">
              Drafts
            </SelectItem>
            <SelectItem value="archived" label="Archived">
              Archived
            </SelectItem>
            <SelectItem value={ALL} label="All">
              All
            </SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={category}
        onValueChange={(value) => update({ category: value ?? "" })}
        items={CATEGORY_ITEMS}
      >
        <SelectTrigger className="w-full md:w-48">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} label="All categories">
            All categories
          </SelectItem>
          {ALL_CATEGORIES.map((item) => (
            <SelectItem key={item.value} value={item.value} label={item.label}>
              <HugeiconsIcon icon={item.icon} className="mr-1 size-3" />
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={department}
        onValueChange={(value) => update({ department: value ?? "" })}
        items={departmentItems}
      >
        <SelectTrigger className="w-full md:w-56">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} label="All departments">
            All departments
          </SelectItem>
          {departments.map((item) => (
            <SelectItem key={item.code} value={item.code} label={item.name}>
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
