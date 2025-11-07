import { createContext, useContext, useState, ReactNode } from "react";

export type ContextItemType = "report" | "vulnerability" | "endpoint" | "evidence" | "compliance";

export interface ContextItem {
  id: string;
  type: ContextItemType;
  label: string;
  data: any;
  tokens: number;
}

interface ContextBasketContextValue {
  items: ContextItem[];
  addItem: (item: Omit<ContextItem, "id">) => void;
  removeItem: (id: string) => void;
  clearBasket: () => void;
  totalTokens: number;
}

const ContextBasketContext = createContext<ContextBasketContextValue | undefined>(undefined);

export const useContextBasket = () => {
  const context = useContext(ContextBasketContext);
  if (!context) {
    throw new Error("useContextBasket must be used within ContextBasketProvider");
  }
  return context;
};

interface ContextBasketProviderProps {
  children: ReactNode;
}

export const ContextBasketProvider = ({ children }: ContextBasketProviderProps) => {
  const [items, setItems] = useState<ContextItem[]>([]);

  const addItem = (item: Omit<ContextItem, "id">) => {
    const newItem: ContextItem = {
      ...item,
      id: `${item.type}-${Date.now()}-${Math.random()}`,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearBasket = () => {
    setItems([]);
  };

  const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);

  return (
    <ContextBasketContext.Provider
      value={{ items, addItem, removeItem, clearBasket, totalTokens }}
    >
      {children}
    </ContextBasketContext.Provider>
  );
};
