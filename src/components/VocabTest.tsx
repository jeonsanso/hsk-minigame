import { useState, useEffect, useCallback } from 'react';
import type { SentenceData, VocabQuestion } from '../types';
import { openDict } from '../utils/dict';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(wrongList: SentenceData[]): VocabQuestion[] {
  // 모든 단어 수집
  const all: { word: string; pinyin: string; meaning: string }[] = [];
  for (const s of wrongList) {
    s.words.forEach((word, i) => {
      if (s.wordMeanings[i]) {
        all.push({ word, pinyin: s.pinyin[i], meaning: s.wordMeanings[i] });
      }
    });
  }

  // 중복 제거 (같은 단어)
  const unique = all.filter(
    (item, idx, arr) => arr.findIndex(x => x.word === item.word) === idx
  );

  const allMeanings = unique.map(u => u.meaning);

  return shuffle(unique).map(({ word, pinyin, meaning }) => {
    const distractors = shuffle(
      allMeanings.filter(m => m !== meaning)
    ).slice(0, 3);

    // 오답이 3개 미만이면 placeholder 채움
    while (distractors.length < 3) {
      distractors.push(`오답 ${distractors.length + 1}`);
    }

    const choices = shuffle([meaning, ...distractors]);
    return { word, pinyin, correct: meaning, choices };
  });
}

interface VocabTestProps {
  wrongList: SentenceData[];
  onExit: () => void;
}

type AnswerState = 'unanswered' | 'correct' | 'wrong';

export function VocabTest({ wrongList, onExit }: VocabTestProps) {
  const [questions] = useState<VocabQuestion[]>(() => buildQuestions(wrongList));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = questions[index];

  const handleSelect = useCallback((choice: string) => {
    if (answerState !== 'unanswered') return;
    const isCorrect = choice === current.correct;
    setSelected(choice);
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore(s => s + 1);
  }, [answerState, current]);

  const handleNext = useCallback(() => {
    if (answerState === 'unanswered') return;
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setSelected(null);
      setAnswerState('unanswered');
    }
  }, [answerState, index, questions.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (answerState === 'unanswered') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 4 && current.choices[num - 1]) {
          handleSelect(current.choices[num - 1]);
        }
      } else if (e.key === 'Enter') {
        if (done) onExit();
        else handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answerState, current, handleSelect, handleNext, done, onExit]);

  if (questions.length === 0) {
    return (
      <div className="vocab-board vocab-board--empty">
        <p className="vocab-empty-msg">
          아직 단어시험을 볼 단어가 없어요.<br />
          문장배열에서 틀린 문제가 생기면 단어가 추가됩니다.
        </p>
        <button className="btn btn--primary" onClick={onExit}>돌아가기</button>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="vocab-board">
        <header className="game-header">
          <span className="game-badge game-badge--review">단어시험 결과</span>
          <span className="game-score">{score} / {questions.length}</span>
        </header>
        <div className="vocab-result">
          <div className="vocab-result__pct">{pct}%</div>
          <div className="vocab-result__msg">
            {pct === 100
              ? '완벽해요! 모든 단어를 맞혔습니다.'
              : pct >= 70
              ? '잘했어요! 틀린 단어를 다시 복습해 보세요.'
              : '조금 더 연습이 필요해요. 문장배열 복습을 함께 해보세요.'}
          </div>
          <button className="btn btn--primary" onClick={onExit}>
            문장배열로 돌아가기 <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vocab-board">
      <header className="game-header">
        <span className="game-badge game-badge--review">
          단어시험 {index + 1} / {questions.length}
        </span>
        <span className="game-score">{score} / {index}</span>
      </header>

      <div className="vocab-question">
        <button className="dict-word vocab-word" onClick={() => openDict(current.word)}>{current.word}</button>
        <div className="vocab-pinyin">{current.pinyin}</div>
        <p className="vocab-prompt">뜻을 고르세요</p>
      </div>

      <div className="vocab-choices">
        {current.choices.map((choice, i) => {
          let mod = '';
          if (answerState !== 'unanswered') {
            if (choice === current.correct) mod = 'vocab-choice--correct';
            else if (choice === selected) mod = 'vocab-choice--wrong';
          }
          return (
            <button
              key={i}
              className={`vocab-choice ${mod}`}
              onClick={() => handleSelect(choice)}
              disabled={answerState !== 'unanswered'}
            >
              <span className="vocab-choice__num">{i + 1}</span>
              <span className="vocab-choice__text">{choice}</span>
            </button>
          );
        })}
      </div>

      {answerState !== 'unanswered' && (
        <div className={`vocab-feedback vocab-feedback--${answerState}`}>
          {answerState === 'correct' ? '✓ 정답!' : `✗ 오답 — 정답: ${current.correct}`}
          <button className="btn btn--primary btn--sm" onClick={handleNext}>
            다음 <kbd>Enter</kbd>
          </button>
        </div>
      )}

      {answerState === 'unanswered' && (
        <p className="keyboard-hint">
          숫자키 <kbd>1</kbd>~<kbd>4</kbd> 로 선택
        </p>
      )}
    </div>
  );
}
