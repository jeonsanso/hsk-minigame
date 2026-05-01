import { useState, useCallback } from 'react';
import type { SentenceData, HistoryEntry } from '../types';

const STORAGE_KEY = 'hsk4_persist_v1';

interface PersistentState {
  history: HistoryEntry[];
  wrongList: SentenceData[];
}

function load(): PersistentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [], wrongList: [] };
    return JSON.parse(raw) as PersistentState;
  } catch {
    return { history: [], wrongList: [] };
  }
}

function save(state: PersistentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시
  }
}

export function usePersist() {
  const [state, setState] = useState<PersistentState>(load);

  const addHistory = useCallback((sentence: SentenceData, result: 'correct' | 'wrong') => {
    setState(prev => {
      const entry: HistoryEntry = { sentence, result, timestamp: Date.now() };
      const history = [...prev.history, entry];

      // 오답일 때만 wrongList에 추가. 정답이어도 자동 제거하지 않음.
      // (제거는 복습 모드에서 맞혔을 때 setWrongList로만 처리)
      let wrongList = [...prev.wrongList];
      if (result === 'wrong') {
        if (!wrongList.find(s => s.sentence === sentence.sentence)) {
          wrongList = [...wrongList, sentence];
        }
      }

      const next = { history, wrongList };
      save(next);
      return next;
    });
  }, []);

  const setWrongList = useCallback((updater: (prev: SentenceData[]) => SentenceData[]) => {
    setState(prev => {
      const wrongList = updater(prev.wrongList);
      const next = { ...prev, wrongList };
      save(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    const next = { history: [], wrongList: [] };
    save(next);
    setState(next);
  }, []);

  return {
    history: state.history,
    wrongList: state.wrongList,
    addHistory,
    setWrongList,
    clearHistory,
  };
}
