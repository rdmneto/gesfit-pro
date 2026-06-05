import { create } from "zustand";

/**
 * Treinador "ativo" no contexto do aluno. Como um aluno pode ter vários
 * treinadores, este id define de quem são o painel, as aulas, a agenda e o
 * saldo exibidos. Persistido em localStorage para sobreviver a recarregamentos.
 */
const STORAGE_KEY = "gesfit-active-trainer";

interface ActiveTrainerState {
  activeTrainerId: string | null;
  setActiveTrainer: (id: string | null) => void;
}

export const useActiveTrainer = create<ActiveTrainerState>((set) => ({
  activeTrainerId:
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
  setActiveTrainer: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ activeTrainerId: id });
  },
}));
