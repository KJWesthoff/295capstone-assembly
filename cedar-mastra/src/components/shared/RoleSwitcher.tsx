"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, TrendingUp, Shield, Code } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "executive" | "security" | "developer";

interface RoleConfig {
  role: Role;
  label: string;
  shortLabel: string;
  description: string;
  route: string;
  icon: typeof TrendingUp;
  color: string;
}

const roles: RoleConfig[] = [
  {
    role: "executive",
    label: "Executive Dashboard",
    shortLabel: "Executive",
    description: "KPIs, trends, and risk overview",
    route: "/executive",
    icon: TrendingUp,
    color: "text-amber-500",
  },
  {
    role: "security",
    label: "Security Analyst",
    shortLabel: "Security",
    description: "Vulnerability analysis & remediation",
    route: "/dashboard",
    icon: Shield,
    color: "text-blue-500",
  },
  {
    role: "developer",
    label: "Developer View",
    shortLabel: "Developer",
    description: "PR-ready fixes and code snippets",
    route: "/developer",
    icon: Code,
    color: "text-green-500",
  },
];

function getCurrentRole(pathname: string): RoleConfig {
  if (pathname.startsWith("/executive")) {
    return roles.find((r) => r.role === "executive")!;
  }
  if (pathname.startsWith("/developer")) {
    return roles.find((r) => r.role === "developer")!;
  }
  // Default to security for /dashboard, /security and other paths
  return roles.find((r) => r.role === "security")!;
}

interface RoleSwitcherProps {
  variant?: "header" | "page";
}

export function RoleSwitcher({ variant = "header" }: RoleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentRole = getCurrentRole(pathname);
  const CurrentIcon = currentRole.icon;

  const handleRoleChange = (role: RoleConfig) => {
    // Store role preference
    if (typeof window !== "undefined") {
      localStorage.setItem("userRole", role.role);
    }
    router.push(role.route);
  };

  // Different styles for PageHeader (dark primary bg) vs standalone pages (dark gray bg)
  const buttonStyles =
    variant === "header"
      ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20"
      : "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("h-9 gap-2 px-3", buttonStyles)}>
          <CurrentIcon className={cn("h-4 w-4", currentRole.color)} />
          <span className="hidden sm:inline font-medium">
            {currentRole.shortLabel}
          </span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Dashboard View
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => {
          const Icon = role.icon;
          const isActive = role.role === currentRole.role;
          return (
            <DropdownMenuItem
              key={role.role}
              onClick={() => handleRoleChange(role)}
              className={cn(
                "flex items-start gap-3 p-3 cursor-pointer",
                isActive && "bg-accent"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 h-8 w-8 rounded-md flex items-center justify-center",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.label}</span>
                  {isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {role.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
