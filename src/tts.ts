// Озвучка Web Speech API с пресетами пол×возраст (как в APK).
// Множители pitch: муж 0.8 / жен 1.16 / средний 1.0.
// Множители pitch по возрасту: младенец 1.85 → пожилой 0.82.
import { getState } from "./store";

export type Gender = "male" | "female" | "neutral";
export type Age = "infant" | "child" | "teen" | "adult" | "elderly";

const AGE_PITCH: Record<Age, number> = { infant: 1.85, child: 1.4, teen: 1.15, adult: 1.0, elderly: 0.82 };
const AGE_RATE: Record<Age, number> = { infant: 0.9, child: 1.0, teen: 1.02, adult: 1.0, elderly: 0.92 };
const GENDER_PITCH: Record<Gender, number> = { male: 0.8, female: 1.16, neutral: 1.0 };

export const GENDER_LABEL: Record<Gender, string> = { male: "Мужской", female: "Женский", neutral: "Нарратор" };
export const AGE_LABEL: Record<Age, string> = {
  infant: "Младенец",
  child: "Ребёнок",
  teen: "Подросток",
  adult: "Взрослый",
  elderly: "Пожилой",
};

function gender0(g?: Gender): string { return g ?? "neutral"; }
function age0(a?: Age): string { return a ?? "adult"; }

export function ruVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ru"));
}

function pickVoice(gender: Gender): SpeechSynthesisVoice | null {
  const voices = ruVoices();
  if (voices.length === 0) return null;
  const s = getState().settings;
  if (s.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === s.voiceURI);
    if (chosen) return chosen;
  }
  const femaleHints = ["irina", "milena", "katya", "alena", "tatyana", "anna", "dasha", "victoria", "arina", "female", "женск"];
  const maleHints = ["artemiy", "yuri", "pavel", "dmitry", "male", "мужск", "artem", "evgeniy", "vitaliy"];
  const hints = gender === "female" ? femaleHints : gender === "male" ? maleHints : [];
  for (const h of hints) {
    const v = voices.find((x) => x.name.toLowerCase().includes(h));
    if (v) return v;
  }
  return voices[0];
}

let speaking = false;
let onEndCb: (() => void) | null = null;
let highlightCb: ((i: number, total: number) => void) | null = null;

export function isSpeaking() {
  return speaking;
}
/** Внутри Kotlin-обёртки озвучка идёт через нативный TextToSpeech (мост YomikaiTts). */
function ttsBridge(): any {
  return (window as any).YomikaiTts || null;
}

export function stopTts() {
  ttsBridge()?.stop?.();
  speaking = false;
  onEndCb = null;
  highlightCb = null;
  try {
    speechSynthesis.cancel();
  } catch {
    /* noop */
  }
}

/** Озвучить текст: режется на предложения, подсветка текущего по индексу. */
export function speakText(
  text: string,
  opts: { gender?: Gender; age?: Age; onEnd?: () => void; onSentence?: (i: number, total: number) => void } = {},
) {
  const br = ttsBridge();
  stopTts();
  const s = getState().settings;
  if (br) {
    // Нативный TTS обёртки: пресеты пол×возраст уходят в Kotlin.
    speaking = true;
    br.speak(text, gender0(opts.gender), age0(opts.age), s.rate, s.pitch);
    return;
  }
  if (typeof speechSynthesis === "undefined") return;
  const gender = opts.gender ?? "neutral";
  const age = opts.age ?? "adult";
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (sentences.length === 0) return;
  speaking = true;
  onEndCb = opts.onEnd ?? null;
  highlightCb = opts.onSentence ?? null;
  const voice = pickVoice(gender);
  const rate = Math.min(2, Math.max(0.5, s.rate * AGE_RATE[age]));
  const pitch = Math.min(2, Math.max(0.3, s.pitch * GENDER_PITCH[gender] * AGE_PITCH[age]));
  sentences.forEach((sent, i) => {
    const u = new SpeechSynthesisUtterance(sent.replace(/[«»"]/g, ""));
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "ru-RU";
    u.rate = rate;
    // вопрос — чуть выше, восклицание — чуть быстрее
    u.pitch = sent.endsWith("?") ? Math.min(2, pitch * 1.12) : sent.endsWith("!") ? Math.min(2, pitch * 1.07) : pitch;
    if (i === 0) u.onstart = () => highlightCb?.(0, sentences.length);
    else u.onstart = () => highlightCb?.(i, sentences.length);
    if (i === sentences.length - 1)
      u.onend = () => {
        speaking = false;
        highlightCb?.(-1, sentences.length);
        onEndCb?.();
      };
    u.onerror = () => {
      speaking = false;
      onEndCb?.();
    };
    speechSynthesis.speak(u);
  });
}
