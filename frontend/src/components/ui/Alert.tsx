import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "info", children, ...props }, ref) => {
  const variants = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };

  return (
    <div ref={ref} className={cn("flex items-start p-4 border rounded-lg", variants[variant], className)} {...props}>
      <div className="flex-1">{children}</div>
    </div>
  );
});

Alert.displayName = "Alert";
export { Alert };
