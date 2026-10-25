"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import type { Department } from "@/lib/notice-types"

/** Multi-select for departments with searchable dropdown and removable chips. */
export function DepartmentCombobox({
  value,
  onChange,
  departments,
  missing,
}: {
  value: string[]
  onChange: (departments: string[]) => void
  departments: Department[]
  missing?: boolean
}) {
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      multiple
      value={value}
      onValueChange={(selected) => onChange(selected ?? [])}
    >
      <ComboboxChips ref={anchor} data-missing={missing || undefined}>
        <ComboboxValue>
          {(selected: string[]) => (
            <React.Fragment>
              {selected.map((code) => (
                <ComboboxChip key={code} aria-label={code}>
                  {code === "all" ? "All departments" : code}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={selected.length > 0 ? undefined : "Search…"}
                aria-description={
                  selected.length > 0
                    ? `${selected.length} selected`
                    : undefined
                }
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No departments found.</ComboboxEmpty>
        <ComboboxList>
          {departments.map((d) => (
            <ComboboxItem key={d.code} value={d.code}>
              <span className="font-medium">{d.code}</span>
              <span className="text-muted-foreground">{d.name}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** Chips input for batch numbers with Enter-to-add and an "All batches" option. */
export function BatchCombobox({
  value,
  onChange,
}: {
  value: number[]
  onChange: (batches: number[]) => void
}) {
  const [inputValue, setInputValue] = React.useState("")

  const hasAll = value.includes(-1)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault()
      const num = parseInt(inputValue.trim(), 10)
      if (!Number.isNaN(num)) {
        if (num === -1) {
          onChange([-1])
        } else if (!hasAll && !value.includes(num)) {
          onChange([...value, num])
        }
        setInputValue("")
      }
    }
  }

  const handleRemove = (batch: number) => {
    onChange(value.filter((b) => b !== batch))
  }

  const handleSelectAll = () => {
    onChange([-1])
  }

  const showAllOption = !hasAll

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-4xl border border-input bg-input/30 px-2.5 py-1.5 text-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map((batch) => (
          <Badge
            key={batch}
            variant="secondary"
            className="flex h-[calc(--spacing(5.5))] cursor-pointer items-center gap-1 rounded-4xl px-2 text-xs"
            onClick={() => handleRemove(batch)}
            title="Click to remove"
          >
            {batch === -1 ? "All batches" : String(batch)}
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              className="size-3 opacity-50 hover:opacity-100"
            />
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length > 0 ? undefined : "Type a number + Enter"}
          className="min-w-16 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showAllOption && (
        <button
          type="button"
          onClick={handleSelectAll}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Select all batches
        </button>
      )}
    </div>
  )
}
