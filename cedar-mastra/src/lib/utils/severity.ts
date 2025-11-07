// Severity types and color utilities for security findings

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export const SEVERITY_COLORS = {
  badge: {
    Critical: "bg-destructive text-destructive-foreground",
    High: "bg-destructive/80 text-destructive-foreground",
    Medium: "bg-[hsl(var(--chart-3))] text-foreground font-semibold",
    Low: "bg-muted text-foreground font-semibold",
  },
  border: {
    Critical: "bg-critical/20 text-critical border-critical/40",
    High: "bg-high/20 text-high border-high/40",
    Medium: "bg-medium/20 text-medium border-medium/40",
    Low: "bg-low/20 text-low border-low/40",
  },
  hex: {
    Critical: "#dc2626",
    High: "#ea580c",
    Medium: "#ca8a04",
    Low: "#16a34a",
  }
} as const;

/**
 * Get the appropriate color classes or hex value for a severity level
 * @param severity - The severity level (Critical, High, Medium, Low)
 * @param variant - The color variant to return (badge, border, or hex)
 * @returns The color classes or hex value for the severity
 */
export function getSeverityColor(
  severity: Severity,
  variant: 'badge' | 'border' | 'hex' = 'badge'
): string {
  return SEVERITY_COLORS[variant][severity] || SEVERITY_COLORS[variant].Low;
}

/**
 * Get the text color class for a severity level
 * @param severity - The severity level
 * @returns The text color Tailwind class
 */
export function getSeverityTextColor(severity: Severity): string {
  const colors = {
    Critical: "text-critical",
    High: "text-high",
    Medium: "text-medium",
    Low: "text-low",
  };
  return colors[severity] || colors.Low;
}
