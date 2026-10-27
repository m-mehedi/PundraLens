"use client"

import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export interface PipelineStep {
  id: number
  label: string
}

export interface PipelineStepperProps {
  steps: PipelineStep[]
  activeStep: number
  completedSteps: number[]
  staleSteps?: number[]
  onStepClick: (step: number) => void
}

export function PipelineStepper({
  steps,
  activeStep,
  completedSteps,
  staleSteps = [],
  onStepClick,
}: PipelineStepperProps) {
  return (
    <nav aria-label="Notice pipeline">
      <ol className="flex w-full items-center">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep
          const isCompleted = completedSteps.includes(step.id)
          const isStale = staleSteps.includes(step.id)
          const isUpcoming = !isActive && !isCompleted
          const isLast = index === steps.length - 1

          return (
            <li key={step.id} className={cn("flex items-center", !isLast && "flex-1")}>
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className="group flex flex-col items-center gap-2 focus-visible:outline-none"
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isUpcoming}
              >
                <span className="relative">
                  <motion.span
                    layout
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-200",
                      isActive &&
                        "border-primary bg-primary text-primary-foreground",
                      isCompleted &&
                        !isStale &&
                        "border-primary bg-primary text-primary-foreground",
                      isCompleted &&
                        isStale &&
                        "border-amber-500 bg-amber-500 text-white",
                      isUpcoming &&
                        "border-muted-foreground/30 bg-background text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </motion.span>
                  {isStale && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-amber-500 ring-2 ring-background" />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-200",
                    isActive && "text-foreground",
                    isCompleted && !isStale && "text-muted-foreground",
                    isCompleted && isStale && "text-amber-600",
                    isUpcoming && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <div className="mx-3 h-0.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      isCompleted && !isStale && "bg-primary",
                      isCompleted && isStale && "bg-amber-500",
                      !isCompleted && "bg-transparent"
                    )}
                    initial={false}
                    animate={{
                      width: isCompleted ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
