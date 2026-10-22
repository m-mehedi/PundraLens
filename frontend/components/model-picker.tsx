"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ModelOption } from "@/components/upload-notice/types"

export interface ModelPickerProps {
  models: ModelOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function ModelPicker({
  models,
  value,
  onChange,
  label,
  id,
  disabled,
  className,
}: ModelPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label className="text-sm font-medium" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <Select
        value={value}
        onValueChange={(next) => onChange(next ?? "")}
        disabled={disabled || models.length === 0}
      >
        <SelectTrigger id={id} className={className ?? "w-full"}>
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((option) => (
            <SelectItem
              key={option.key}
              value={option.key}
              disabled={!option.available}
            >
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.provider}
                  {option.notes ? ` — ${option.notes}` : ""}
                  {!option.available ? " (not available for this key)" : ""}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
