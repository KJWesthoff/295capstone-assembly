"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DashboardHeader = ({
  title,
  description,
  action,
  size = 'lg',
  className
}: DashboardHeaderProps) => {
  const titleSizes = {
    sm: "text-2xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className={cn(
          "font-serif font-bold text-foreground",
          size === 'md' ? "font-semibold mb-2" : "",
          titleSizes[size]
        )}>
          {title}
        </h2>
        <p className={cn(
          "text-muted-foreground",
          size === 'sm' ? "text-xs" : size === 'md' ? "text-sm" : "text-base mt-1"
        )}>
          {description}
        </p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
