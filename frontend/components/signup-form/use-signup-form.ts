"use client"

import * as React from "react"
import { useForm, FieldErrors } from "react-hook-form"
import { SignupFormData, SignupFormStep } from "./types"
import { authClient, studentIdToEmail } from "@/lib/auth-client"
import { toast } from "sonner"

function useSignupForm() {
  const [step, setStep] = React.useState<SignupFormStep>("account")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const form = useForm<SignupFormData>({
    defaultValues: {
      student_id: "",
      department: "" as SignupFormData["department"],
      batch: "",
      semester: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldUnregister: false,
  })

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = form

  const passwordValue = watch("password")

  const handleNext = async () => {
    const isValid = await trigger([
      "student_id",
      "department",
      "batch",
      "semester",
    ])
    if (isValid) {
      setStep("password")
    }
  }

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const email = studentIdToEmail(data.student_id)
      await authClient.signUp.email(
        {
          email,
          password: data.password,
          name: data.student_id,
          callbackURL: "/dashboard",
        },
        {
          onSuccess: () => {
            window.location.href = "/dashboard"
          },
        }
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create account"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const onError = (errors: FieldErrors<SignupFormData>) => {
    if (
      errors.student_id ||
      errors.department ||
      errors.batch ||
      errors.semester
    ) {
      setStep("account")
    }
  }

  return {
    form,
    step,
    setStep,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    register,
    control,
    handleSubmit,
    errors,
    passwordValue,
    handleNext,
    onSubmit,
    onError,
    isLoading,
    error,
  }
}

export { useSignupForm }
