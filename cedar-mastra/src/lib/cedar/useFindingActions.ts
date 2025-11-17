import { toast } from "sonner";
import { useCedarActions } from "./hooks";
import { cedarPayloadShapes } from "./actions";
import { getSeverityColor as getSeverityColorUtil, Severity } from "@/lib/utils/severity";
import type { Finding } from "@/types/finding";

// 🐛 DEBUG FLAG: Set to true to log all context additions to browser console
const DEBUG_CONTEXT_ADDITIONS = true;

/**
 * Custom hook for adding vulnerability findings to Cedar chat context.
 * Provides consistent color coding, key generation, and label formatting.
 */
export function useFindingActions() {
  const { addToContext } = useCedarActions();

  /**
   * Get hex color code based on vulnerability severity
   */
  const getColor = (severity: string): string => {
    return getSeverityColorUtil(severity as Severity, 'hex');
  };

  /**
   * Add a single finding to chat with consistent formatting
   * @param finding - The vulnerability finding
   * @param keyPrefix - Unique prefix for the context key (e.g., "developer-full", "finding")
   * @param payload - Optional custom payload (defaults to devMinimal)
   * @param customLabel - Optional custom label (defaults to "severity: method path")
   */
  const addFindingToChat = (
    finding: Finding,
    keyPrefix: string,
    payload?: any,
    customLabel?: string
  ) => {
    const data = payload || cedarPayloadShapes.devMinimal(finding);
    const label =
      customLabel ||
      `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;
    const key = `${keyPrefix}-${finding.id}`;
    const color = getColor(finding.severity);

    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding single finding:", {
        key,
        label,
        color,
        severity: finding.severity,
        data,
      });
    }

    addToContext(key, data, label, color);
  };

  /**
   * Add multiple findings to chat in bulk
   * @param findings - Array of findings to add
   * @param keyPrefix - Unique prefix for the context keys
   * @param payloadFn - Optional function to transform each finding (defaults to devMinimal)
   * @param showToast - Whether to show success toast (defaults to true)
   */
  const addFindingsToChat = (
    findings: Finding[],
    keyPrefix: string,
    payloadFn?: (f: Finding) => any,
    showToast: boolean = true
  ) => {
    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding multiple findings:", {
        count: findings.length,
        keyPrefix,
        findingIds: findings.map((f) => f.id),
        severities: findings.map((f) => f.severity),
      });
    }

    findings.forEach((finding) => {
      const payload = payloadFn
        ? payloadFn(finding)
        : cedarPayloadShapes.devMinimal(finding);
      addFindingToChat(finding, keyPrefix, payload);
    });

    if (showToast) {
      toast.success(`${findings.length} finding${findings.length === 1 ? "" : "s"} added to Chat`);
    }
  };

  /**
   * Add custom data to chat with finding-based color coding
   * @param key - Unique context key
   * @param data - Data to add to context
   * @param label - Display label
   * @param severity - Severity level for color coding (optional)
   */
  const addCustomToChat = (
    key: string,
    data: any,
    label: string,
    severity?: string
  ) => {
    const color = severity ? getColor(severity) : "#003262"; // Default Cal blue

    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding custom data:", {
        key,
        label,
        color,
        severity: severity || "none",
        dataKeys: Object.keys(data),
        data,
      });
    }

    addToContext(key, data, label, color);
  };

  return {
    addFindingToChat,
    addFindingsToChat,
    addCustomToChat,
    getSeverityColor: getColor,
  };
}
