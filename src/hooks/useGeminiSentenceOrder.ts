import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { SentenceOrderData } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
const ai = new GoogleGenAI({ apiKey });

const CACHE_KEY = 'hsk4_so_cache_v3';
const MAX_CACHE = 20;

function loadCache(): SentenceOrderData[] {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveCache(items: SentenceOrderData[]) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(-MAX_CACHE)));
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    sentences: { type: Type.ARRAY, items: { type: Type.STRING } },
    pinyin: { type: Type.ARRAY, items: { type: Type.STRING } },
    translations: { type: Type.ARRAY, items: { type: Type.STRING } },
    hint: { type: Type.STRING },
  },
  required: ['sentences', 'pinyin', 'translations', 'hint'],
};

const SYSTEM_PROMPT = `당신은 HSK 4급 중국어 시험 출제 전문가입니다.
HSK 4급 실제 시험의 "句子排列(문장 배열)" 유형으로 3문장 문제를 출제하세요.

## 핵심 원칙: 정답 순서가 반드시 하나여야 합니다
- 세 문장을 섞었을 때 논리적·문법적으로 올바른 순서가 오직 하나뿐이어야 합니다
- 접속사 쌍(虽然…但是…, 因为…所以…, 先…然后…, 不但…而且… 등), 지시사(这/那/这样), 시간 흐름, 인과관계, 주제→전개→결론 구조 등을 활용해 순서를 강제하세요
- 각 문장은 하나의 완결된 문장이어야 합니다

## 문장 수준
- HSK 4급 어휘·문법 수준
- 각 문장은 10~25자 내외
- 일상적인 주제 (여행, 학습, 직장, 건강, 취미 등)

## 형식 규칙 (매우 중요)
실제 HSK 시험 카드와 동일하게:
- 각 문장 끝에 마침표(。)·느낌표(！)·물음표(？) 등 끝 구두점 없음
- 문장 중간의 쉼표(，)는 접속사 구문(虽然…，但是… 등)에만 허용
- 불필요한 구두점 최소화

## 출력 형식
- sentences: 정답 순서 그대로의 3문장 배열 (섞지 말 것, 끝 구두점 없이)
- pinyin: sentences 각 문장의 병음 (sentences와 동일한 순서/개수)
- translations: sentences 각 문장의 한국어 번역 (sentences와 동일한 순서/개수)
- hint: 왜 이 순서여야 하는지 문법·논리 근거를 한국어로 1~2문장`;

const SO_SEEDS = [
  '담화 구조: 인과관계 (因为…所以…)',
  '담화 구조: 시간 순서 (先…然后…最后…)',
  '담화 구조: 양보·전환 (虽然…但是…)',
  '담화 구조: 점층 (不但…而且…)',
  '담화 구조: 조건·결과 (如果…就…)',
  '담화 구조: 주제 제시 → 상술 → 결론',
  '담화 구조: 문제 제기 → 원인 분석 → 해결',
  '주제: 여행 / 숙박 / 교통',
  '주제: 학교 / 시험 / 공부',
  '주제: 직장 / 회의 / 업무',
  '주제: 건강 / 병원 / 운동',
  '주제: 쇼핑 / 환불 / 소비',
  '주제: 날씨 / 계절 변화',
  '주제: 음식점 / 요리',
  '주제: 친구 / 약속 / 대화',
];

let soCallCount = 0;

export function useGeminiSentenceOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProblem = useCallback(async (usedSentences: string[] = []): Promise<SentenceOrderData | null> => {
    setLoading(true);
    setError(null);

    const cache = loadCache();
    const usedSet = new Set(usedSentences);
    const unused = cache.filter(p => !usedSet.has(p.sentences.join('|')));
    if (unused.length > 0) {
      setLoading(false);
      return unused[Math.floor(Math.random() * unused.length)];
    }

    try {
      const seed = SO_SEEDS[soCallCount % SO_SEEDS.length];
      soCallCount++;

      const avoidList = usedSentences.length > 0
        ? `\n이미 출제된 문제 (반드시 제외할 것):\n${usedSentences.slice(-10).map(s => `- ${s}`).join('\n')}`
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
      const raw: SentenceOrderData = JSON.parse(text);

      // 끝 구두점 제거 (。！？. ! ?)
      const stripEnd = (s: string) => s.replace(/[。！？.!?]+$/, '').trim();
      const data: SentenceOrderData = {
        ...raw,
        sentences: raw.sentences.map(stripEnd),
      };

      const newCache = [...cache, data];
      saveCache(newCache);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 생성에 실패했습니다.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchProblem, loading, error };
}
