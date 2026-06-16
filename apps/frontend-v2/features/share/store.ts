import { create } from "zustand";

interface ShareState {
  activeToken: string | null;
  setActiveToken: (token: string | null) => void;
}

export const useShareStore = create<ShareState>((set) => ({
  activeToken: null,
  setActiveToken: (activeToken) => set({ activeToken }),
}));
