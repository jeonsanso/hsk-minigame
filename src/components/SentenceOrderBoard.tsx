import { useState, useEffect, useCallback } from 'react';
import { useGeminiSentenceOrder } from '../hooks/useGeminiSentenceOrder';
import { usePersistSO } from '../hooks/usePersistSO';
import { openDict } from '../utils/dict';
import type { SentenceOrderData, SentenceOrderPhase } from '../types';

const LABELS = ['A', 'B', 'C'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ShuffledSentence {
  id: number;
  text: string;
}

function buildShuffled(sentences: string[]): ShuffledSentence[] {
  return shuffle(sentences.map((text, id) => ({ id, text })));
}

function problemKey(p: SentenceOrderData) {
  return p.sentences.join('|');
}

export function SentenceOrderBoard() {
  const { fetchProblem, error } = useGeminiSentenceOrder();
  const { history, wrongList, addHistory } = usePersistSO();

  const [problem, setProblem] = useState<SentenceOrderData | null>(null);
  const [shuffled, setShuffled] = useState<ShuffledSentence[]>([]);
  const [answer, setAnswer] = useState<ShuffledSentence[]>([]);
  const [phase, setPhase] = useState<SentenceOrderPhase>('loading');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showHint, setShowHint] = useState(false);

  // 이전 기록 기반으로 회피 초기값
  const [usedKeys, setUsedKeys] = useState<string[]>(() =>
    history.map(e => problemKey(e.problem))
  );

  // 복습 관련
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<SentenceOrderData[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const startProblem = useCallback((data: SentenceOrderData) => {
    setProblem(data);
    setShuffled(buildShuffled(data.sentences));
    setAnswer([]);
    setShowHint(false);
    setPhase('playing');
  }, []);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    const data = await fetchProblem(usedKeys);
    if (!data) return;
    setUsedKeys(prev => [...prev, problemKey(data)]);
    startProblem(data);
  }, [fetchProblem, usedKeys, startProblem]);

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startReview = useCallback(() => {
    if (wrongList.length === 0) return;
    const queue = shuffle([...wrongList]);
    setReviewQueue(queue);
    setReviewIndex(0);
    setIsReviewMode(true);
    startProblem(queue[0]);
  }, [wrongList, startProblem]);

  const nextReview = useCallback(() => {
    const next = reviewIndex + 1;
    if (next >= reviewQueue.length) {
      setIsReviewMode(false);
      loadNext();
    } else {
      setReviewIndex(next);
      startProblem(reviewQueue[next]);
    }
  }, [reviewIndex, reviewQueue, startProblem, loadNext]);

  const handleNext = useCallback(() => {
    if (isReviewMode) nextReview();
    else loadNext();
  }, [isReviewMode, nextReview, loadNext]);

  const remaining = shuffled.filter(s => !answer.find(a => a.id === s.id));

  const selectSentence = useCallback((item: ShuffledSentence) => {
    if (phase !== 'playing') return;
    const newAnswer = [...answer, item];
    setAnswer(newAnswer);

    if (newAnswer.length === 3) {
      const isCorrect = newAnswer.every((s, i) => s.id === i);
      setPhase(isCorrect ? 'correct' : 'wrong');
      setScore(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
      if (problem) addHistory(problem, isCorrect ? 'correct' : 'wrong');
    }
  }, [phase, answer, problem, addHistory]);

  const removeLastAnswer = useCallback(() => {
    if (phase !== 'playing' || answer.length === 0) return;
    setAnswer(prev => prev.slice(0, -1));
  }, [phase, answer]);

  const retry = useCallback(() => {
    if (!problem) return;
    setAnswer([]);
    setShuffled(buildShuffled(problem.sentences));
    setPhase('playing');
    setShowHint(false);
  }, [problem]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (phase === 'playing') {
        if (e.key === 'Backspace') {
          e.preventDefault();
          removeLastAnswer();
        }
        const num = parseInt(e.key);
        if (num >= 1 && num <= 3 && remaining[num - 1]) {
          selectSentence(remaining[num - 1]);
        }
      }
      if (e.key === 'Enter') {
        if (phase === 'correct') handleNext();
        else if (phase === 'wrong') retry();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, remaining, selectSentence, removeLastAnswer, retry, handleNext]);

  if (phase === 'loading') {
    return (
      <div className="game-board game-board--loading">
        <div className="loading-spinner" />
        <p className="loading-text">{isReviewMode ? '복습 준비 중...' : '문제 생성 중...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-board game-board--error">
        <p className="error-text">{error}</p>
        <button className="btn btn--primary" onClick={loadNext}>다시 시도</button>
      </div>
    );
  }

  if (!problem) return null;

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';
  const isDone = isCorrect || isWrong;

  return (
    <div className="game-board">
      <header className="game-header">
        <div className="game-header-left">
          {isReviewMode ? (
            <span className="game-badge game-badge--review">
              복습 {reviewIndex + 1} / {reviewQueue.length}
            </span>
          ) : (
            <span className="game-title">HSK 4급 문장배열</span>
          )}
        </div>
        <div className="game-header-right">
          <button
            className="btn-review"
            onClick={startReview}
            disabled={wrongList.length === 0}
            title="틀린 문제 복습"
          >
            복습 {wrongList.length}개
          </button>
          <span className="game-score">{score.correct} / {score.total}</span>
        </div>
      </header>

      {/* 답안 영역 */}
      <section className="answer-area" aria-label="답안 영역">
        <div className={`answer-slots so-answer-slots ${isDone ? (isCorrect ? 'answer-slots--correct' : 'answer-slots--wrong') : ''}`}>
          {answer.length === 0 && (
            <span className="answer-placeholder">문장을 순서대로 선택하세요</span>
          )}
          {answer.map((item, i) => {
            let mod = '';
            if (isDone) mod = item.id === i ? 'so-tile--correct' : 'so-tile--wrong';
            return (
              <div
                key={item.id}
                className={`so-tile so-tile--answer ${mod}`}
                onClick={() => {
                  if (phase === 'playing') {
                    setAnswer(prev => prev.filter((_, idx) => idx !== i));
                  }
                }}
              >
                <span className="so-tile__order">{i + 1}</span>
                <span className="so-tile__text">{item.text}</span>
              </div>
            );
          })}
        </div>

        {answer.length > 0 && phase === 'playing' && (
          <button className="btn btn--ghost btn--sm" onClick={removeLastAnswer}>
            ← 마지막 문장 취소 <kbd>Backspace</kbd>
          </button>
        )}
      </section>

      {/* 결과 패널 */}
      {isDone && (
        <section className={`result-panel result-panel--${isCorrect ? 'correct' : 'wrong'}`}>
          <div className="result-header">{isCorrect ? '✓ 정답!' : '✗ 오답'}</div>

          <div className="so-correct-order">
            <div className="so-correct-label">정답 순서</div>
            {problem.sentences.map((s, i) => (
              <div key={i} className="so-correct-row">
                <span className="so-correct-idx">{LABELS[i]}</span>
                <div className="so-correct-detail">
                  <button className="dict-word so-correct-text" onClick={() => openDict(s)}>{s}</button>
                  {problem.pinyin[i] && (
                    <span className="so-correct-pinyin">{problem.pinyin[i]}</span>
                  )}
                  {problem.translations[i] && (
                    <span className="so-correct-translation">{problem.translations[i]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="hint-toggle" onClick={() => setShowHint(v => !v)}>
            {showHint ? '힌트 닫기 ▲' : '순서 근거 보기 ▼'}
          </button>
          {showHint && <div className="result-hint">{problem.hint}</div>}

          <div className="result-actions">
            {isWrong && (
              <button className="btn btn--ghost" onClick={retry}>
                다시 시도 <kbd>Enter</kbd>
              </button>
            )}
            <button className="btn btn--primary" onClick={handleNext}>
              {isReviewMode
                ? reviewIndex + 1 >= reviewQueue.length ? '복습 완료' : `다음 복습 (${reviewIndex + 1}/${reviewQueue.length})`
                : '다음 문제'}
              {isCorrect && <kbd>Enter</kbd>}
            </button>
          </div>
        </section>
      )}

      {/* 선택 영역 */}
      <section className="choice-area" aria-label="문장 선택 영역">
        <div className="so-choice-list">
          {remaining.map((item, i) => (
            <div
              key={item.id}
              className={`so-tile so-tile--choice ${isDone ? 'so-tile--disabled' : ''}`}
              onClick={() => !isDone && selectSentence(item)}
            >
              <span className="so-tile__badge">{i + 1}</span>
              <span className="so-tile__text">{item.text}</span>
            </div>
          ))}
        </div>
        {phase === 'playing' && (
          <p className="keyboard-hint">
            숫자키 <kbd>1</kbd>~<kbd>{remaining.length}</kbd> 로 선택 &nbsp;·&nbsp; <kbd>Backspace</kbd> 취소
          </p>
        )}
      </section>
    </div>
  );
}
