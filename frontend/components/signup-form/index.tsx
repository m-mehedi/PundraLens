"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnimatePresence, motion } from "motion/react"

import { DEPARTMENTS, SignupFormStep } from "./types"
import { FieldError } from "./field-error"
import { PasswordField } from "./password-field"
import { useSignupForm } from "./use-signup-form"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const {
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
  } = useSignupForm()

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="mx-auto w-full max-w-[420px]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Create your PundraLens Account
          </CardTitle>
          <CardDescription>
            Enter your details below to set up your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit, onError)}>
            <Tabs
              value={step}
              onValueChange={(val) => setStep(val as SignupFormStep)}
              className="w-full"
            >
              <TabsList
                className="mb-6 grid w-full grid-cols-2"
                variant={"line"}
              >
                <TabsTrigger value="account">1. Account Details</TabsTrigger>
                <TabsTrigger value="password">2. Security</TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <FieldGroup>
                  {/* STEP 1: Account Information */}
                  <TabsContent value="account" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor="student_id">
                            Student ID
                          </FieldLabel>
                          <Input
                            id="student_id"
                            type="number"
                            placeholder="0322512101021"
                            className={cn(
                              errors.student_id &&
                                "border-destructive focus-visible:ring-destructive"
                            )}
                            {...register("student_id", {
                              required: "Student ID is required",
                            })}
                          />
                          <FieldError message={errors.student_id?.message} />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="department">
                            Department
                          </FieldLabel>
                          <Controller
                            control={control}
                            name="department"
                            rules={{ required: "Department is required" }}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value ?? ""}
                              >
                                <SelectTrigger
                                  id="department"
                                  className={cn(
                                    errors.department &&
                                      "border-destructive focus-visible:ring-destructive"
                                  )}
                                >
                                  <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEPARTMENTS.map((dept) => (
                                    <SelectItem key={dept} value={dept}>
                                      {dept}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <FieldError message={errors.department?.message} />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                          <Field>
                            <FieldLabel htmlFor="batch">Batch</FieldLabel>
                            <Input
                              id="batch"
                              type="number"
                              placeholder="29"
                              className={cn(
                                errors.batch &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                              {...register("batch", {
                                required: "Batch is required",
                              })}
                            />
                            <FieldError message={errors.batch?.message} />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="semester">Semester</FieldLabel>
                            <Input
                              id="semester"
                              type="number"
                              placeholder="1"
                              className={cn(
                                errors.semester &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                              {...register("semester", {
                                required: "Semester is required",
                              })}
                            />
                            <FieldError message={errors.semester?.message} />
                          </Field>
                        </div>

                        <Button
                          type="button"
                          className="mt-4 w-full"
                          variant={"outline"}
                          onClick={handleNext}
                        >
                          Next Step
                        </Button>
                      </FieldGroup>
                    </motion.div>
                  </TabsContent>

                  {/* STEP 2: Password Setup */}
                  <TabsContent value="password" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FieldGroup>
                        <PasswordField
                          label="Password"
                          id="password"
                          name="password"
                          show={showPassword}
                          onToggle={() => setShowPassword((prev) => !prev)}
                          register={register}
                          registerOptions={{
                            required: "Password is required",
                            minLength: {
                              value: 8,
                              message: "Must be at least 8 characters",
                            },
                          }}
                          error={errors.password?.message}
                        />

                        <Field>
                          <PasswordField
                            label="Confirm Password"
                            id="confirm-password"
                            name="confirmPassword"
                            show={showConfirmPassword}
                            onToggle={() =>
                              setShowConfirmPassword((prev) => !prev)
                            }
                            register={register}
                            registerOptions={{
                              required: "Please confirm your password",
                              validate: (value) =>
                                value === passwordValue ||
                                "Passwords do not match",
                            }}
                            error={errors.confirmPassword?.message}
                          />
                          <FieldDescription className="mt-1 text-xs text-muted-foreground">
                            Must be at least 8 characters long.
                          </FieldDescription>
                        </Field>

                        <Field>
                          <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full"
                          >
                            {isLoading
                              ? "Creating Account..."
                              : "Create Account"}
                          </Button>
                        </Field>

                        {error && <FieldError message={error} />}
                      </FieldGroup>
                    </motion.div>
                  </TabsContent>
                </FieldGroup>
              </AnimatePresence>
            </Tabs>
          </form>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  )
}
