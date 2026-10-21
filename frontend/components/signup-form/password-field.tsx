"use client"

import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { SignupFormData } from "./types"
import { FieldError } from "./field-error"

function PasswordField({
  label,
  id,
  name,
  show,
  onToggle,
  register,
  registerOptions,
  error,
}: {
  label: string
  id: string
  name: "password" | "confirmPassword"
  show: boolean
  onToggle: () => void
  register: ReturnType<typeof useForm<SignupFormData>>["register"]
  registerOptions: Parameters<ReturnType<typeof useForm<SignupFormData>>["register"]>[1]
  error?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          className={cn("pr-10", error && "border-destructive focus-visible:ring-destructive")}
          {...register(name, registerOptions)}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError message={error} />
    </Field>
  )
}

export { PasswordField }
