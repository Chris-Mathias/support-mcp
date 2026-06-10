import { createContext, useContext, useState } from "react";

type SelectedProjectContextValue = {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
};

const SelectedProjectContext = createContext<SelectedProjectContextValue | null>(null);

const STORAGE_KEY = "app:selectedProjectId";

export function SelectedProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );

  function setSelectedProjectId(id: string) {
    setSelectedProjectIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <SelectedProjectContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      {children}
    </SelectedProjectContext.Provider>
  );
}

export function useSelectedProject() {
  const ctx = useContext(SelectedProjectContext);
  if (!ctx) throw new Error("useSelectedProject must be used inside SelectedProjectProvider");
  return ctx;
}
