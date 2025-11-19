import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Send } from "lucide-react";
import { useContextBasket } from "@/contexts/ContextBasketContext";

interface ContextBasketProps {
  onSendToAI: () => void;
  userRole: string;
}

export const ContextBasket = ({ onSendToAI, userRole }: ContextBasketProps) => {
  const { items, removeItem, clearBasket } = useContextBasket();

  return (
    <Card className="h-full bg-card border-border/50 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Context Basket</h3>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearBasket}>
            Clear All
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Current Role: <span className="font-medium text-foreground">{userRole}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            No items in basket. Add findings from the scan results to analyze with AI.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="bg-muted/50 rounded-lg p-3 group">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    {item.type}
                  </Badge>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <p className="text-sm line-clamp-3">{item.content}</p>
              </div>
            ))}
          </div>

          <Button onClick={onSendToAI} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            Send to AI ({items.length})
          </Button>
        </>
      )}
    </Card>
  );
};
