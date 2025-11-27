import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

// Story 4.4: Oceanic Calm themed toast variants
// AC4.10: Success - green border #A3BE8C
// AC4.11: Error - red border #BF616A
// AC4.12: Warning - yellow border #EBCB8B
// AC4.6 (bonus): Info - blue border #88C0D0
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border-l-4 p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full motion-reduce:transition-none motion-reduce:animate-none",
  {
    variants: {
      variant: {
        default: "border-l-[#88C0D0] bg-[#2E3440] text-[#D8DEE9]",
        success: "border-l-[#A3BE8C] bg-[#2E3440] text-[#D8DEE9]",
        error: "border-l-[#BF616A] bg-[#2E3440] text-[#D8DEE9]",
        warning: "border-l-[#EBCB8B] bg-[#2E3440] text-[#D8DEE9]",
        info: "border-l-[#88C0D0] bg-[#2E3440] text-[#D8DEE9]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Story 4.4: Map toast types to icons
const ToastIcon = ({ type }: { type?: 'success' | 'error' | 'warning' | 'info' }) => {
  const iconClassName = "h-5 w-5 shrink-0"

  switch (type) {
    case 'success':
      return <CheckCircle className={cn(iconClassName, "text-[#A3BE8C]")} />
    case 'error':
      return <XCircle className={cn(iconClassName, "text-[#BF616A]")} />
    case 'warning':
      return <AlertCircle className={cn(iconClassName, "text-[#EBCB8B]")} />
    case 'info':
      return <Info className={cn(iconClassName, "text-[#88C0D0]")} />
    default:
      return null
  }
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  Omit<React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>, 'type'> &
    VariantProps<typeof toastVariants> & {
      type?: 'success' | 'error' | 'warning' | 'info'
    }
>(({ className, variant, type, children, ...props }, ref) => {
  // Map type to variant if not explicitly set
  const effectiveVariant = variant || type || 'default'

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant: effectiveVariant as any }), className)}
      {...props}
    >
      <div className="flex items-start gap-3 w-full">
        <ToastIcon type={type} />
        <div className="flex-1">
          {children}
        </div>
      </div>
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[#4C566A] bg-transparent px-3 text-sm font-medium text-[#88C0D0] ring-offset-background transition-colors hover:bg-[#3B4252] focus:outline-none focus:ring-2 focus:ring-[#88C0D0] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-[#D8DEE9]/50 opacity-0 transition-opacity hover:text-[#D8DEE9] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#88C0D0] group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold text-[#ECEFF4]", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm text-[#D8DEE9] opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = Omit<React.ComponentPropsWithoutRef<typeof Toast>, 'type'> & {
  type?: 'success' | 'error' | 'warning' | 'info'
}

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
