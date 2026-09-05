import { getState } from "./store";

/**
 * Озвучка через Web Speech API — зеркало пресетов Android-версии:
 * пол и возраст дают множители pitch/rate поверх выбранного голоса.
 */
const GENDER_PITCH: Record<string, number> = { auto: 1.0, male: 0.8, female: 1.16, neutral: 1.0 };
const AGE_RATE: Record<string, number> = { baby: 1.85, child: 1.5, teen: 1.25, adult: 1.0, elder: 0.82 };

let current: SpeechSynthesisUtterance | null = null;

export function pickRuVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("ru")) ||
    voices.find((v) => v.lang.toLowerCase().includes("ru-")) ||
    null
  );
}

export function speak(text: string, onEnd?: () => void, onBoundary?: (charIndex: number) => void) {
  if (!("speechSynthesis" in window)) return;
  stop();
  const u = new SpeechSynthesisUtterance(text);
  const s = getState();
  const voice = pickRuVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "ru-RU";
  u.pitch = GENDER_PITCH[s.voiceGender] ?? 1.0;
  u.rate = AGE_RATE[s.voiceAge] ?? 1.0;
  u.onend = () => {
    current = null;
    onEnd?.();
  };
  u.onboundary = (e) => onBoundary?.(e.charIndex);
  current = u;
  window.speechSynthesis.speak(u);
}

export function stop() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  current = null;
}

export function isSpeaking(): boolean {
  return "speechSynthesis" in window && window.speechSynthesis.speaking;
}
