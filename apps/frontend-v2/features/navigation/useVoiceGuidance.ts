"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLanguage = "en" | "so" | "sw";

const LANG_CODES: Record<VoiceLanguage, string[]> = {
  en: ["en-US", "en-GB", "en"],
  so: ["so-SO", "so"],
  sw: ["sw-KE", "sw-TZ", "sw"],
};

/**
 * Web Speech API voice guidance. Somali and Swahili are rarely shipped as
 * on-device TTS voices — most Android/iOS builds simply don't have them
 * installed. Rather than silently speaking English while claiming Somali,
 * this hook reports whether a real matching voice was found so the UI can
 * be honest about the fallback instead of pretending it worked.
 */
export function useVoiceGuidance(language: VoiceLanguage) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [matchedRequestedLanguage, setMatchedRequestedLanguage] = useState(false);
  const lastSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      for (const code of LANG_CODES[language]) {
        const match = voices.find((v) => v.lang.toLowerCase().startsWith(code.toLowerCase()));
        if (match) {
          setVoice(match);
          setMatchedRequestedLanguage(language === "en" || code !== "en");
          return;
        }
      }
      // No voice for the requested language exists on this device — fall
      // back to the first English voice (or whatever default exists).
      const fallback = voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? voices[0];
      setVoice(fallback ?? null);
      setMatchedRequestedLanguage(false);
    };

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [language]);

  /** Speaks text, skipping immediate repeats so guidance doesn't stutter on every GPS tick. */
  const speak = useCallback(
    (text: string, opts: { force?: boolean } = {}) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!opts.force && lastSpokenRef.current === text) return;
      lastSpokenRef.current = text;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    },
    [voice]
  );

  return { speak, voice, matchedRequestedLanguage };
}
