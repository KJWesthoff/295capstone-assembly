import { createContext, useContext, useState, ReactNode } from "react";

interface ContextItem {
  id: string;
  type: "finding" | "endpoint" | "note";
  content: string;
  metadata?: Record<string, any>;
}

interface ContextBasketContextType {
  items: ContextItem[];
  addItem: (item: ContextItem) => void;
  removeItem: (id: string) => void;
  clearBasket: () => void;
}

const ContextBasketContext = createContext<ContextBasketContextType | undefined>(undefined);

export const useContextBasket = () => {
  const context = useContext(ContextBasketContext);
  if (!context) {
    throw new Error("useContextBasket must be used within a ContextBasketProvider");
  }
  return context;
};

export const ContextBasketProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ContextItem[]>([]);

  const addItem = (item: ContextItem) => {
    setItems((prev) => {
      // Avoid duplicates
      if (prev.find((i) => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearBasket = () => {
    setItems([]);
  };

  return (
    <ContextBasketContext.Provider value={{ items, addItem, removeItem, clearBasket }}>
      {children}
    </ContextBasketContext.Provider>
  );
};
