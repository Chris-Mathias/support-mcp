import { useState } from "react";

const STORAGE_KEY = "app:selectedProjectId";

export function useSelectedProject() {
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

  return { selectedProjectId, setSelectedProjectId };
}
