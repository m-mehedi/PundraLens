"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import type { ModelOption } from "@/components/upload-notice/types"

export interface ModelPickerProps {
  models: ModelOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  id?: string
  disabled?: boolean
  className?: string
  /** Shown under the trigger — explains what the model is for. */
  description?: string
}

export function ModelPicker({
  models,
  value,
  onChange,
  label,
  id,
  disabled,
  className,
  description,
}: ModelPickerProps) {
  // Without `items`, the trigger renders the raw catalogue key instead of a
  // name. The map also gives every item its typeahead label.
  const items = models.map((option) => ({
    value: option.key,
    label: option.label,
  }))

  return (
    <Field>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <Select
        value={value}
        onValueChange={(next) => onChange(next ?? "")}
        disabled={disabled || models.length === 0}
        items={items}
      >
        <SelectTrigger id={id} className={className ?? "w-full"}>
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {models.map((option) => (
              <SelectItem
                key={option.key}
                value={option.key}
                label={option.label}
                disabled={!option.available}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.available
                      ? (option.notes ?? option.provider)
                      : "No API key for this provider"}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}
