import { useCedarStore } from "cedar-os";
import { toast } from "sonner";
import { useCallback } from "react";

export function useCedarActions() {
  // Use Zustand selector pattern to access addContextEntry
  const addContextEntry = useCedarStore(s => s.addContextEntry);

  const addToContext = useCallback((key: string, data: any, label: string, color?: string) => {
    addContextEntry(key, {
      id: data.id || `${key}-${Date.now()}`,
      source: "manual" as const,
      data: data, // Pass data object directly so chatWorkflow can access it
      metadata: {
        label,
        color: color || "#003262",
        showInChat: true,
      },
    });
    toast.success(`Added to Chat: ${label}`);
  }, [addContextEntry]);

  const sendMessage = useCallback((message: string) => {
    const event = new CustomEvent('cedar-chat-send', {
      detail: { message }
    });
    window.dispatchEvent(event);
  }, []);

  return {
    addToContext,
    sendMessage,
  };
}

// Token estimation (keep for backward compatibility)
export const cedarEstimateTokens = (payload: any): number => {
  const str = JSON.stringify(payload);
  return Math.ceil(str.length / 4);
};
