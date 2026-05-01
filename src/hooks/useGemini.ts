import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { SentenceData } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
const ai = new GoogleGenAI({ apiKey });

const CACHE_KEY = 'hsk4_sentence_cache_v3';
const MAX_CACHE = 20;

function loadCache(): SentenceData[] {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveCache(items: SentenceData[]) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(-MAX_CACHE)));
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    sentence: { type: Type.STRING },
    words: { type: Type.ARRAY, items: { type: Type.STRING } },
    pinyin: { type: Type.ARRAY, items: { type: Type.STRING } },
    wordMeanings: { type: Type.ARRAY, items: { type: Type.STRING } },
    translation: { type: Type.STRING },
    hint: { type: Type.STRING },
  },
  required: ['sentence', 'words', 'pinyin', 'wordMeanings', 'translation', 'hint'],
};

const SYSTEM_PROMPT = `당신은 HSK 4급 중국어 시험 출제 전문가입니다.
HSK 4급 실제 시험의 "句子排列(문장 배열)" 문제 형식으로 문장을 하나 출제하세요.

## 핵심 원칙: 정답이 반드시 하나여야 합니다
분절된 어구들을 섞었을 때, **문법적으로 올바른 순서가 오직 하나**뿐이어야 합니다.
- 아무 순서로 붙여도 자연스러운 문장은 출제 금지
- 접속사 쌍(虽然…但是…, 因为…所以…, 不但…而且…, 如果…就… 등), 시간 순서, 인과관계, 주술목 구조 등을 활용해 순서를 강제하세요
- 특정 어구가 반드시 다른 어구 앞/뒤에 와야 하는 문법적 이유가 있어야 함

## 분절 기준 (매우 중요)
실제 HSK 4급 시험처럼 **어구(구절) 단위**로 분절합니다. 개별 단어로 쪼개지 마세요.
- 주어부, 부사어구, 동사구, 목적어구, 보어구 등 **의미 덩어리** 단위
- 분절 개수: **3~5개** (너무 잘게 쪼개면 안 됨)
- 각 조각은 **2글자 이상**이 되도록

## 분절 예시
- 문장: 她每天下班以后都会去健身房锻炼身体
  → ["她每天下班以后", "都会去", "健身房", "锻炼身体"]  ← 올바른 예
  → ["她", "每天", "下班", "以后", "都", "会", "去", "健身房", "锻炼", "身体"]  ← 잘못된 예 (너무 잘게 쪼갬)

- 문장: 虽然他汉语说得不太好，但是大家都能听懂
  → ["虽然他汉语", "说得不太好", "但是大家", "都能听懂"]  ← 올바른 예
  (虽然이 반드시 앞, 但是가 반드시 뒤 → 정답이 하나임)

## 출력 형식
- sentence: 전체 문장
- words: 위 기준으로 분절한 어구 배열 (3~5개)
- pinyin: words 각 어구의 병음 (띄어쓰기로 내부 단어 구분)
- wordMeanings: words 각 어구의 한국어 뜻 (단어장 학습용, words와 동일한 순서/개수)
- translation: 전체 문장의 한국어 번역
- hint: 왜 이 순서여야 하는지 문법 근거를 한국어로 1~2문장 (예: "虽然…但是… 양보 접속문으로, 虽然절이 반드시 앞에 옵니다")
- 이전에 사용된 문장과 다른 새로운 문장 생성`;

const PHRASE_SEEDS = [
  '문법: 把字句 (把를 사용한 처치문)',
  '문법: 被字句 (被를 사용한 피동문)',
  '문법: 虽然…但是… (양보 접속)',
  '문법: 因为…所以… (인과 접속)',
  '문법: 如果…就… (조건 접속)',
  '문법: 不但…而且… (점층 접속)',
  '문법: 先…然后… (시간 순서)',
  '문법: 连…都/也… (강조)',
  '문법: 是…的 (강조 구문)',
  '문법: 越来越… (점점 ~해지다)',
  '문법: 程度补语 (정도 보어)',
  '문법: 趋向补语 (방향 보어)',
  '주제: 여행 / 교통',
  '주제: 학습 / 언어 공부',
  '주제: 직장 / 업무',
  '주제: 건강 / 운동',
  '주제: 쇼핑 / 소비',
  '주제: 가족 / 인간관계',
  '주제: 음식 / 식사',
  '주제: 날씨 / 계절',
];

let phraseCallCount = 0;

export function useGemini() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSentence = useCallback(async (usedSentences: string[] = []): Promise<SentenceData | null> => {
    setLoading(true);
    setError(null);

    const cache = loadCache();
    const unused = cache.filter(s => !usedSentences.includes(s.sentence));
    if (unused.length > 0) {
      setLoading(false);
      return unused[Math.floor(Math.random() * unused.length)];
    }

    try {
      const seed = PHRASE_SEEDS[phraseCallCount % PHRASE_SEEDS.length];
      phraseCallCount++;

      const avoidList = usedSentences.length > 0
        ? `\n이미 출제된 문장 목록 (반드시 제외할 것):\n${usedSentences.slice(-20).map(s => `- ${s}`).join('\n')}`
        : '';

      const result = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + `\n\n이번 문제 방향: ${seed}` + avoidList }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 1.0,
        },
      });

      const text = result.text ?? '';
      const data: SentenceData = JSON.parse(text);

      const newCache = [...cache, data];
      saveCache(newCache);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '문장 생성에 실패했습니다.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchSentence, loading, error };
}
