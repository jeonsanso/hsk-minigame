import { useState, useCallback } from 'react';
import type { SentenceOrderData, SentenceOrderHistoryEntry } from '../types';

const STORAGE_KEY = 'hsk4_so_persist_v1';

interface PersistentSOState {
  history: SentenceOrderHistoryEntry[];
  wrongList: SentenceOrderData[];
}

function load(): PersistentSOState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [], wrongList: [] };
    return JSON.parse(raw) as PersistentSOState;
  } catch {
    return { history: [], wrongList: [] };
  }
}

function save(state: PersistentSOState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 무시
  }
}

function problemKey(p: SentenceOrderData) {
  return p.sentences.join('|');
}

export function usePersistSO() {
  const [state, setState] = useState<PersistentSOState>(load);

  const addHistory = useCallback((problem: SentenceOrderData, result: 'correct' | 'wrong') => {
    setState(prev => {
      const entry: SentenceOrderHistoryEntry = { problem, result, timestamp: Date.now() };
      const history = [...prev.history, entry];

      let wrongList = [...prev.wrongList];
      if (result === 'wrong') {
        const key = problemKey(problem);
        if (!wrongList.find(p => problemKey(p) === key)) {
          wrongList = [...wrongList, problem];
        }
      }

      const next = { history, wrongList };
      save(next);
      return next;
    });
  }, []);

  return {
    history: state.history,
    wrongList: state.wrongList,
    addHistory,
  };
}
