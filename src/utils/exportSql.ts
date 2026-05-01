import type { HistoryEntry, SentenceData } from '../types';

function esc(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
}

function escJson(arr: string[]): string {
  return esc(JSON.stringify(arr));
}

export function generateSql(history: HistoryEntry[], wrongList: SentenceData[]): string {
  const lines: string[] = [];

  lines.push('-- HSK4 미니게임 내보내기');
  lines.push(`-- 생성일시: ${new Date().toLocaleString('ko-KR')}`);
  lines.push('');
  lines.push('PRAGMA journal_mode=WAL;');
  lines.push('BEGIN TRANSACTION;');
  lines.push('');

  // ── sentences 테이블 ──────────────────────────────────
  lines.push(`CREATE TABLE IF NOT EXISTS sentences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sentence    TEXT NOT NULL UNIQUE,
  words       TEXT NOT NULL,
  pinyin      TEXT NOT NULL,
  word_meanings TEXT NOT NULL,
  translation TEXT NOT NULL,
  hint        TEXT NOT NULL
);`);
  lines.push('');

  // ── history 테이블 ────────────────────────────────────
  lines.push(`CREATE TABLE IF NOT EXISTS history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sentence_id  INTEGER NOT NULL REFERENCES sentences(id),
  result       TEXT NOT NULL CHECK(result IN ('correct','wrong')),
  played_at    TEXT NOT NULL
);`);
  lines.push('');

  // ── wrong_list 테이블 ─────────────────────────────────
  lines.push(`CREATE TABLE IF NOT EXISTS wrong_list (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sentence_id INTEGER NOT NULL UNIQUE REFERENCES sentences(id)
);`);
  lines.push('');

  // ── 유니크 문장 수집 ──────────────────────────────────
  const sentenceMap = new Map<string, SentenceData>();
  for (const entry of history) {
    sentenceMap.set(entry.sentence.sentence, entry.sentence);
  }
  for (const s of wrongList) {
    sentenceMap.set(s.sentence, s);
  }

  const sentences = Array.from(sentenceMap.values());

  // sentences INSERT
  lines.push('-- 문장 데이터');
  for (const s of sentences) {
    lines.push(
      `INSERT OR IGNORE INTO sentences (sentence, words, pinyin, word_meanings, translation, hint) VALUES (` +
      `${esc(s.sentence)}, ${escJson(s.words)}, ${escJson(s.pinyin)}, ${escJson(s.wordMeanings ?? [])}, ${esc(s.translation)}, ${esc(s.hint)});`
    );
  }
  lines.push('');

  // history INSERT
  lines.push('-- 풀이 기록');
  for (const entry of history) {
    const dt = new Date(entry.timestamp).toISOString();
    lines.push(
      `INSERT INTO history (sentence_id, result, played_at) ` +
      `SELECT id, ${esc(entry.result)}, ${esc(dt)} FROM sentences WHERE sentence = ${esc(entry.sentence.sentence)};`
    );
  }
  lines.push('');

  // wrong_list INSERT
  lines.push('-- 복습 대기 목록');
  for (const s of wrongList) {
    lines.push(
      `INSERT OR IGNORE INTO wrong_list (sentence_id) ` +
      `SELECT id FROM sentences WHERE sentence = ${esc(s.sentence)};`
    );
  }
  lines.push('');

  lines.push('COMMIT;');
  return lines.join('\n');
}

export function downloadSql(history: HistoryEntry[], wrongList: SentenceData[]) {
  const sql = generateSql(history, wrongList);
  const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hsk4-export-${date}.sql`;
  a.click();
  URL.revokeObjectURL(url);
}
