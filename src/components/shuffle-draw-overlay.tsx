"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SHUFFLE_LINES = [
  "Embaralhando jogadores…",
  "Montando duplas…",
  "Balanceando nº de jogos…",
  "Evitando rematches…",
  "Quase lá…",
];

/** Overlay fullscreen de sorteio enquanto gera jogo RANDOM. */
export function ShuffleDrawOverlay({ active }: { active: boolean }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setLineIdx(0);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % SHUFFLE_LINES.length);
    }, 900);
    return () => {
      document.body.style.overflow = prev;
      window.clearInterval(id);
    };
  }, [active]);

  if (!active || !mounted) return null;

  return createPortal(
    <div
      className="shuffle-overlay fixed inset-0 z-[100] flex min-h-dvh w-screen flex-col items-center justify-center bg-night/70 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="shuffle-card relative z-10 flex flex-col items-center text-center text-white">
        <div className="shuffle-court mx-auto mb-8 scale-125" aria-hidden>
          <span className="shuffle-ball shuffle-ball-1" />
          <span className="shuffle-ball shuffle-ball-2" />
          <span className="shuffle-ball shuffle-ball-3" />
          <span className="shuffle-ball shuffle-ball-4" />
          <span className="shuffle-net" />
        </div>
        <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Sorteando jogo
        </p>
        <p
          key={lineIdx}
          className="shuffle-line mt-3 min-h-[1.5rem] text-base text-white/75 sm:text-lg"
        >
          {SHUFFLE_LINES[lineIdx]}
        </p>
      </div>
    </div>,
    document.body,
  );
}
