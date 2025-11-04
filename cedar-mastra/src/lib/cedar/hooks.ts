import { useCedarStore } from "cedar-os";
import { toast } from "sonner";

export function useCedarActions() {
  // Use Zustand selector pattern to access addContextEntry
  const addContextEntry = useCedarStore(s => s.addContextEntry);

  const addToContext = (key: string, data: any, label: string, color?: string) => {
    addContextEntry(key, {
      id: data.id || `${key}-${Date.now()}`,
      source: "manual" as const,
      content: JSON.stringify(data), // Cedar expects 'content' field, not 'data'
      metadata: {
        label,
        color: color || "#003262",
      },
    });
    toast.success(`Added to Chat: ${label}`);
  };

  return {
    addToContext,
  };
}

// Token estimation (keep for backward compatibility)
export const cedarEstimateTokens = (payload: any): number => {
  const str = JSON.stringify(payload);
  return Math.ceil(str.length / 4);
};
