"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  icon: Icon,
  action,
  className,
}: PageHeaderProps) => {
  return (
    <header className={cn("border-b border-primary/20 bg-primary sticky top-0 z-10 shadow-sm", className)}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded bg-primary-foreground/10 flex items-center justify-center border border-primary-foreground/20">
              <Icon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-primary-foreground">
                {title}
              </h1>
              <p className="text-xs text-primary-foreground/80 font-sans">
                {description}
              </p>
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      </div>
    </header>
  );
};

