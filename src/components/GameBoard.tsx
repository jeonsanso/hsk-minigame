import { useState, useEffect, useCallback, useRef } from 'react';
import { useGemini } from '../hooks/useGemini';
import { usePersist } from '../hooks/usePersist';
import { WordTile } from './WordTile';
import { VocabTest } from './VocabTest';
import { downloadSql } from '../utils/exportSql';
import { openDict } from '../utils/dict';
import type { SentenceData, GamePhase, ShuffledWord } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffled(words: string[]): ShuffledWord[] {
  return shuffle(
    words.map((text, originalIndex) => ({ id: originalIndex, text, originalIndex }))
  );
}

type AppMode = 'game' | 'vocab';

export function GameBoard() {
  const { fetchSentence, error } = useGemini();
  const { history, wrongList, addHistory } = usePersist();

  const [appMode, setAppMode] = useState<AppMode>('game');
  const [sentence, setSentence] = useState<SentenceData | null>(null);
  const [shuffled, setShuffled] = useState<ShuffledWord[]>([]);
  const [answer, setAnswer] = useState<ShuffledWord[]>([]);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  // localStorage history에서 이미 풀었던 문장들을 초기값으로
  const [usedSentences, setUsedSentences] = useState<string[]>(() =>
    history.map(e => e.sentence.sentence)
  );
  const [showHint, setShowHint] = useState(false);

  // 복습 관련
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<SentenceData[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);

  const startSentence = useCallback((data: SentenceData) => {
    setSentence(data);
    setShuffled(buildShuffled(data.words));
    setAnswer([]);
    setShowHint(false);
    setPhase('playing');
  }, []);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    const data = await fetchSentence(usedSentences);
    if (!data) return;
    setUsedSentences(prev => [...prev, data.sentence]);
    startSentence(data);
  }, [fetchSentence, usedSentences, startSentence]);

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
    startSentence(queue[0]);
  }, [wrongList, startSentence]);

  const nextReview = useCallback(() => {
    const next = reviewIndex + 1;
    if (next >= reviewQueue.length) {
      setIsReviewMode(false);
      loadNext();
    } else {
      setReviewIndex(next);
      startSentence(reviewQueue[next]);
    }
  }, [reviewIndex, reviewQueue, startSentence, loadNext]);

  const remaining = shuffled.filter(w => !answer.find(a => a.id === w.id));

  const selectWord = useCallback((word: ShuffledWord) => {
    if (phase !== 'playing') return;
    const newAnswer = [...answer, word];
    setAnswer(newAnswer);

    if (newAnswer.length === sentence?.words.length) {
      const isCorrect = newAnswer.every((w, i) => w.originalIndex === i);
      setPhase(isCorrect ? 'correct' : 'wrong');
      setScore(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      if (sentence) {
        addHistory(sentence, isCorrect ? 'correct' : 'wrong');
      }
    }
  }, [phase, answer, sentence, isReviewMode, addHistory]);

  const removeLastAnswer = useCallback(() => {
    if (phase !== 'playing' || answer.length === 0) return;
    setAnswer(prev => prev.slice(0, -1));
  }, [phase, answer]);

  const retry = useCallback(() => {
    if (!sentence) return;
    setAnswer([]);
    setShuffled(buildShuffled(sentence.words));
    setPhase('playing');
    setShowHint(false);
  }, [sentence]);

  const handleNext = useCallback(() => {
    if (isReviewMode) nextReview();
    else loadNext();
  }, [isReviewMode, nextReview, loadNext]);

  useEffect(() => {
    if (appMode !== 'game') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (phase === 'playing') {
        if (e.key === 'Backspace') {
          e.preventDefault();
          removeLastAnswer();
        }
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const word = remaining[num - 1];
          if (word) selectWord(word);
        }
      }
      if ((phase === 'correct' || phase === 'wrong') && e.key === 'Enter') {
        if (phase === 'wrong') retry();
        else handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appMode, phase, remaining, selectWord, removeLastAnswer, retry, handleNext]);

  // 단어시험 모드
  if (appMode === 'vocab') {
    return (
      <VocabTest
        wrongList={wrongList}
        onExit={() => setAppMode('game')}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="game-board game-board--loading" ref={boardRef}>
        <div className="loading-spinner" />
        <p className="loading-text">{isReviewMode ? '복습 준비 중...' : '문장 생성 중...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-board game-board--error" ref={boardRef}>
        <p className="error-text">{error}</p>
        <button className="btn btn--primary" onClick={loadNext}>다시 시도</button>
      </div>
    );
  }

  if (!sentence) return null;

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';
  const isDone = isCorrect || isWrong;
  const totalPlayed = history.length;

  return (
    <div className="game-board" ref={boardRef}>
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
            title="틀린 문장 복습"
          >
            복습 {wrongList.length}개
          </button>
          <button
            className="btn-vocab"
            onClick={() => setAppMode('vocab')}
            disabled={wrongList.length === 0}
            title="단어시험"
          >
            단어시험
          </button>
          {history.length > 0 && (
            <button
              className="btn-export"
              onClick={() => downloadSql(history, wrongList)}
              title="SQLite용 SQL 파일 다운로드"
            >
              ↓ SQL
            </button>
          )}
          <span className="game-score" title={`전체 ${totalPlayed}문제 중`}>
            {score.correct} / {score.total}
          </span>
        </div>
      </header>

      <section className="answer-area" aria-label="답안 영역">
        <div className={`answer-slots ${isDone ? (isCorrect ? 'answer-slots--correct' : 'answer-slots--wrong') : ''}`}>
          {answer.length === 0 && (
            <span className="answer-placeholder">단어를 선택해 문장을 완성하세요</span>
          )}
          {answer.map((word, i) => {
            let variant: 'answer' | 'correct' | 'wrong' = 'answer';
            if (isDone) {
              variant = word.originalIndex === i ? 'correct' : 'wrong';
            }
            return (
              <WordTile
                key={`${word.id}-${i}`}
                text={word.text}
                index={i}
                variant={variant}
                disabled={isDone}
                onClick={() => {
                  if (phase === 'playing') {
                    setAnswer(prev => prev.filter((_, idx) => idx !== i));
                  }
                }}
              />
            );
          })}
        </div>

        {answer.length > 0 && phase === 'playing' && (
          <button className="btn btn--ghost btn--sm" onClick={removeLastAnswer}>
            ← 마지막 단어 취소 <kbd>Backspace</kbd>
          </button>
        )}
      </section>

      {isDone && (
        <section className={`result-panel result-panel--${isCorrect ? 'correct' : 'wrong'}`}>
          <div className="result-header">
            {isCorrect
              ? '✓ 정답!'
              : '✗ 오답'}
          </div>

          <div className="result-sentence">
            <div className="result-chinese">
              {sentence.words.map((word, i) => (
                <button key={i} className="dict-word" onClick={() => openDict(word)}>{word}</button>
              ))}
            </div>
            <div className="result-pinyin">
              {sentence.words.map((_, i) => (
                <span key={i} className="pinyin-item">{sentence.pinyin[i]}</span>
              ))}
            </div>
            <div className="result-translation">{sentence.translation}</div>
          </div>

          <button className="hint-toggle" onClick={() => setShowHint(v => !v)}>
            {showHint ? '힌트 닫기 ▲' : '문법 힌트 보기 ▼'}
          </button>
          {showHint && <div className="result-hint">{sentence.hint}</div>}

          <div className="result-actions">
            {isWrong && (
              <button className="btn btn--ghost" onClick={retry}>
                다시 시도 <kbd>Enter</kbd>
              </button>
            )}
            <button className="btn btn--primary" onClick={handleNext}>
              {isReviewMode
                ? reviewIndex + 1 >= reviewQueue.length
                  ? '복습 완료'
                  : `다음 복습 (${reviewIndex + 1}/${reviewQueue.length})`
                : '다음 문장'}
              {isCorrect && <kbd>Enter</kbd>}
            </button>
          </div>
        </section>
      )}

      <section className="choice-area" aria-label="단어 선택 영역">
        <div className="choice-tiles">
          {remaining.map((word, i) => (
            <WordTile
              key={word.id}
              text={word.text}
              index={i}
              variant="choice"
              disabled={isDone}
              onClick={() => selectWord(word)}
            />
          ))}
        </div>
        {phase === 'playing' && (
          <p className="keyboard-hint">
            숫자키 <kbd>1</kbd>~<kbd>{Math.min(remaining.length, 9)}</kbd> 로 선택 &nbsp;·&nbsp; <kbd>Backspace</kbd> 취소
          </p>
        )}
      </section>
    </div>
  );
}
