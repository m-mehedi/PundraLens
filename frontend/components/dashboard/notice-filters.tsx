"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { HugeiconsIcon } from "@hugeicons/react"
import { FilterRemoveIcon, Search01Icon } from "@hugeicons/core-free-icons"

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
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ALL_CATEGORIES } from "./category-badge"
import type { Department } from "@/lib/notice-types"

const ALL = "all"

const CATEGORY_ITEMS: Record<string, React.ReactNode> = {
  [ALL]: "All categories",
  ...Object.fromEntries(ALL_CATEGORIES.map((item) => [item.value, item.label])),
}

export interface NoticeFiltersProps {
  departments: Department[]
  showStatus?: boolean
  /**
   * Status used when the URL carries none — must match the server-side
   * default of the page rendering this toolbar, otherwise the control shows
   * a status the table is not actually filtering by.
   */
  defaultStatus?: string
  /** Total rows matching the current filters (server-side count). */
  count?: number
  /** Rows actually rendered (capped by the query limit). */
  shown?: number
  /** Extra controls pinned to the end of the toolbar, e.g. Find duplicates. */
  actions?: React.ReactNode
}

export function NoticeFilters({
  departments,
  showStatus = false,
  defaultStatus = "published",
  count,
  shown,
  actions,
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

  const status = searchParams.get("status") ?? defaultStatus
  const category = searchParams.get("category") ?? ALL
  const department = searchParams.get("department") ?? ALL
  const query = searchParams.get("q") ?? ""

  const isFiltered =
    Boolean(query) ||
    category !== ALL ||
    department !== ALL ||
    status !== defaultStatus

  const update = React.useCallback(
    (changes: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (
          !value ||
          value === ALL ||
          (key === "status" && value === defaultStatus)
        ) {
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
    [pathname, router, searchParams, defaultStatus]
  )

  const reset = () =>
    update({ q: "", category: "", department: "", status: "" })

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

  const hasCount = typeof count === "number" && typeof shown === "number"
  const limited = hasCount && (shown as number) < (count as number)
  const showCountLine = hasCount && (limited || isFiltered)

  const countText = limited
    ? `Showing ${shown} of ${count} notices`
    : `${count} ${count === 1 ? "notice" : "notices"}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <InputGroup className="w-full md:w-60 lg:w-64">
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
          {isPending ? (
            <InputGroupAddon align="inline-end">
              <Spinner />
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        {showStatus ? (
          <ToggleGroup
            variant="outline"
            spacing={0}
            className="shrink-0"
            value={[status]}
            onValueChange={(next) => update({ status: next[0] ?? "" })}
            aria-label="Filter by status"
          >
            <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
            <ToggleGroupItem value="published">Published</ToggleGroupItem>
            <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
            <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
          </ToggleGroup>
        ) : null}

        <Select
          value={category}
          onValueChange={(value) => update({ category: value ?? "" })}
          items={CATEGORY_ITEMS}
        >
          <SelectTrigger className="w-full shrink-0 md:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} label="All categories">
              All categories
            </SelectItem>
            {ALL_CATEGORIES.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                label={item.label}
              >
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
          <SelectTrigger className="w-full shrink-0 md:w-48">
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

        {actions ? (
          <div className="flex items-center gap-2 md:ml-auto">{actions}</div>
        ) : null}
      </div>

      {showCountLine ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{countText}</span>
          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              data-icon="inline-start"
            >
              <HugeiconsIcon icon={FilterRemoveIcon} strokeWidth={2} />
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
