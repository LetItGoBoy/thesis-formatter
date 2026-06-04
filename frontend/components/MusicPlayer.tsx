"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, Waves } from "lucide-react";

const TRACK = {
  title: "The Last of Us Theme",
  subtitle: "homepage radio",
  artist: "Gustavo Santaolalla",
  src: "/music/the-last-of-us-theme.mp3",
  color: "from-emerald-300 to-cyan-400",
};

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      audio.currentTime = 0;
      setPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  }

  return (
    <section className="fixed bottom-5 right-5 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/80 bg-white/88 p-3 shadow-lg shadow-slate-200/70 backdrop-blur">
      <audio ref={audioRef} preload="metadata" src={TRACK.src} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${TRACK.color} text-white shadow-sm transition hover:scale-105`}
          aria-label={playing ? "暂停音乐" : "播放音乐"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Waves size={13} />
            {TRACK.subtitle}
          </div>
          <div className="truncate text-sm font-semibold text-slate-700">{TRACK.title}</div>
          <div className="truncate text-xs text-slate-400">{TRACK.artist}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Volume2 size={14} className="text-slate-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-emerald-500"
          aria-label="音量"
        />
        <span className="w-8 text-right text-xs tabular-nums text-slate-400">
          {Math.round(volume * 100)}
        </span>
      </div>
    </section>
  );
}
