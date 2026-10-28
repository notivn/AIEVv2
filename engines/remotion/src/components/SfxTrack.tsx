import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import type { Sfx } from "../manifest";
import { useMediaErrorProps, useMediaSrc } from "../media";

/** Volume sfx mặc định — thấp hơn voice ~10dB (skill remotion-assemble). */
const DEFAULT_SFX_VOLUME = 0.3;

/**
 * Âm lượng của một sfx: số cố định (như trước) khi không khai fade; có
 * `fadeInSec`/`fadeOutSec` thì thành hàm của frame (0 = lúc sfx bắt đầu phát -
 * Remotion đã trừ sẵn startFrom). Fade ra tính ngược từ CUỐI file nên cần
 * `mediaDurationSec` (server/trình phát điền lúc dựng manifest); thiếu thì bỏ.
 */
export const sfxVolume = (entry: Sfx, fps: number): number | ((f: number) => number) => {
  const base = entry.volume ?? DEFAULT_SFX_VOLUME;
  const inF = (entry.fadeInSec ?? 0) * fps;
  const playSec =
    entry.mediaDurationSec !== undefined
      ? entry.mediaDurationSec - (entry.mediaStart ?? 0)
      : undefined;
  const outF = playSec !== undefined && playSec > 0 ? (entry.fadeOutSec ?? 0) * fps : 0;
  if (inF <= 0 && outF <= 0) return base;
  const lastF = (playSec ?? 0) * fps;
  return (f: number) => {
    const a = inF > 0 ? Math.min(1, Math.max(0, f / inF)) : 1;
    const b = outF > 0 ? Math.min(1, Math.max(0, (lastF - f) / outF)) : 1;
    return base * Math.min(a, b);
  };
};

/**
 * Track sound effect: mỗi entry một <Sequence from={atFrame}> chứa <Audio>.
 * File đã được server stage vào public/staging → load qua staticFile()
 * (qua useMediaSrc - xem media.tsx).
 */
export const SfxTrack: React.FC<{ sfx: Sfx[] }> = ({ sfx }) => {
  const { fps } = useVideoConfig();
  const mediaSrc = useMediaSrc();
  const errorProps = useMediaErrorProps();

  return (
    <>
      {sfx.map((entry, index) => (
        <Sequence
          key={`${entry.file}-${entry.atFrame}-${index}`}
          from={entry.atFrame}
        >
          <Audio
            src={mediaSrc(entry.file)}
            // Bỏ khoảng lặng dẫn của file sfx → tiếng thật rơi đúng atFrame
            startFrom={Math.round((entry.mediaStart ?? 0) * fps)}
            volume={sfxVolume(entry, fps)}
            {...errorProps(entry.file)}
          />
        </Sequence>
      ))}
    </>
  );
};
