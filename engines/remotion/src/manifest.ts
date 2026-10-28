import { z } from "zod";
import { footageDurationFrames, sceneSpeedOf, SPEED_MAX, SPEED_MIN } from "./duration";

export { footageDurationFrames, rawSceneDurationFrames, sceneSpeedOf } from "./duration";

/**
 * Schema của meta.json (xem skill `video-pipeline`).
 *
 * LƯU Ý QUAN TRỌNG: props mà server truyền vào Remotion là bản "resolved" —
 * mọi trường đường dẫn media (scene.render, scene.srcVideo, audio.voice,
 * audio.sfx[].file) đã được server thay bằng đường dẫn TƯƠNG ĐỐI trong
 * `public/staging/<projectId>/...` (stage bằng hardlink, xem docs/API.md).
 * Code Remotion chỉ load qua `staticFile()` — KHÔNG bao giờ đọc đường dẫn
 * tuyệt đối trên đĩa.
 *
 * Mọi object dùng `z.looseObject` (passthrough) — meta.json có thêm field lạ
 * (backend/UI ghi thêm) thì validate vẫn phải qua, không strict-fail.
 */

export const sfxSchema = z.looseObject({
  /** Đường dẫn tương đối trong staging, vd "staging/demo/whoosh-01.mp3" */
  file: z.string().min(1),
  /** Frame bắt đầu phát (theo fps của composition) */
  atFrame: z.number().int().min(0),
  /** Âm lượng 0..1 — mặc định 0.3 (thấp hơn voice ~10dB, xem skill remotion-assemble) */
  volume: z.number().min(0).max(1).optional(),
  /**
   * Giây bỏ qua ở ĐẦU file sfx (khoảng lặng dẫn). Nhiều file thư viện có
   * 0.1–1.0s im lặng trước tiếng thật → đặt đúng atFrame mà nghe vẫn trễ.
   * Đo bằng `ffmpeg -af silencedetect=noise=-45dB:d=0.05`.
   */
  mediaStart: z.number().min(0).optional(),
  /** Fade âm vào (giây, 0..10) - tính từ atFrame */
  fadeInSec: z.number().min(0).max(10).optional(),
  /**
   * Fade âm ra (giây, 0..10) - tính ngược từ CUỐI file. Cần `mediaDurationSec`
   * (server/trình phát tự điền lúc dựng manifest, không lưu trong meta.json);
   * thiếu thì bỏ qua fade ra.
   */
  fadeOutSec: z.number().min(0).max(10).optional(),
  /** CHỈ ở bản resolved: độ dài file sfx (giây, ffprobe) - để tính fade ra */
  mediaDurationSec: z.number().positive().optional(),
});

// ---------------------------------------------------------------- khung hình / màu (EDITOR-V2 mục 1)

/**
 * Chỉnh màu trên timeline (scene + layer) - render bằng CSS filter, xem
 * src/color.ts. Mọi field tùy chọn, 0 = giữ nguyên. `preset` là id preset của
 * apps/server/src/color.ts; id lạ bị bỏ qua (không lỗi).
 */
export const colorAdjustSchema = z.looseObject({
  preset: z.string().optional(),
  brightness: z.number().min(-1).max(1).optional(),
  contrast: z.number().min(-1).max(1).optional(),
  saturation: z.number().min(-1).max(1).optional(),
  temperature: z.number().min(-1).max(1).optional(),
  tint: z.number().min(-1).max(1).optional(),
  hue: z.number().min(-180).max(180).optional(),
  vignette: z.number().min(0).max(1).optional(),
  blur: z.number().min(0).max(20).optional(),
});

/** Cắt 4 cạnh của NGUỒN, tỉ lệ 0..0.45 mỗi cạnh (object-view-box - xem layerGeometry.ts) */
export const cropSchema = z.looseObject({
  top: z.number().min(0).max(0.45).optional(),
  right: z.number().min(0).max(0.45).optional(),
  bottom: z.number().min(0).max(0.45).optional(),
  left: z.number().min(0).max(0.45).optional(),
});

/**
 * Biến đổi khung. Ở SCENE: x/y = độ DỊCH tỉ lệ theo cạnh khung (-1..1), scale
 * nhân thêm với zoom/punch-in sẵn có. Ở LAYER: x/y = vị trí TÂM hộp, -1..1 tính
 * từ tâm khung (0,0 = giữa, 1 = mép). Xem layerGeometry.ts.
 */
export const frameTransformSchema = z.looseObject({
  x: z.number().min(-1).max(1).optional(),
  y: z.number().min(-1).max(1).optional(),
  scale: z.number().min(0.1).max(5).optional(),
  rotate: z.number().min(-180).max(180).optional(),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
});

export const TRANSITION_TYPES = [
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "wipe-left",
  "wipe-right",
  "zoom-in",
  "zoom-out",
  "blur",
  "none",
] as const;

/** Kiểu chuyển cảnh sang scene KẾ TIẾP - chạy trong khoảng transitionOverlap */
export const sceneTransitionSchema = z.looseObject({
  type: z.enum(TRANSITION_TYPES),
});

/**
 * Một mốc zoom: `frame` tính TỪ ĐẦU SCENE (không phải frame tuyệt đối), `scale`
 * là hệ số phóng của lớp bọc video. `ease` áp cho đoạn TỪ mốc này tới mốc kế.
 */
export const zoomKeySchema = z.looseObject({
  frame: z.number().min(0),
  scale: z.number().positive(),
  ease: z.enum(["linear", "out", "inOut"]).optional(),
});

/**
 * Chuyển động camera trên footage (skill noti-tiktok-vn — chống video tĩnh).
 * Zoom = scale trên DIV BỌC, không bao giờ animate kích thước thẻ video.
 * Wrapper `overflow: hidden` + video `object-fit: cover` nên scale ≥ 1 không lộ mép.
 */
export const zoomSchema = z.looseObject({
  /** transform-origin, mặc định "50% 38%" (nhắm vào mặt người, không phải tâm khung) */
  origin: z.string().optional(),
  keys: z.array(zoomKeySchema).min(2),
});

export const sceneSchema = z.looseObject({
  id: z.string().min(1),
  /** Composition HyperFrames nguồn (chỉ HyperFrames dùng — Remotion bỏ qua) */
  src: z.string().optional(),
  /** Footage dùng thẳng (đường dẫn staging) */
  srcVideo: z.string().optional(),
  /** Trim footage: giây bắt đầu / kết thúc trong file gốc */
  from: z.number().min(0).optional(),
  to: z.number().min(0).optional(),
  /**
   * Độ dài scene tính theo frame. Bắt buộc với scene HyperFrames;
   * scene srcVideo có thể bỏ trống nếu đã có from/to (suy ra round(to*fps) - round(from*fps)).
   */
  durationInFrames: z.number().int().positive().optional(),
  /** MP4 đã render bởi HyperFrames (đường dẫn staging) — Remotion ưu tiên field này */
  render: z.string().optional(),
  /**
   * Ảnh tĩnh minh họa (PNG đã stage, đường dẫn staging) — dùng khi scene không
   * có render/srcVideo: hiện full-bleed object-fit cover suốt durationInFrames.
   */
  srcImage: z.string().nullable().default(null),
  /** Số frame chồng lấn với scene KẾ TIẾP (crossfade). Mặc định 0 = cắt thẳng */
  transitionOverlap: z.number().int().min(0).optional(),
  /**
   * Tắt tiếng gốc của clip. Bắt buộc = true cho footage khi `audio.voice` đã là
   * xương sống sync — nếu không, tiếng trong footage chồng lên voice thành echo.
   */
  muted: z.boolean().optional(),
  /** Camera-move: Ken Burns drift / punch-in nhấn. Bỏ trống = đứng yên. */
  zoom: zoomSchema.optional(),
  /** Cách nguồn lấp khung - mặc định "cover" */
  fit: z.enum(["cover", "contain"]).optional(),
  transform: frameTransformSchema.optional(),
  crop: cropSchema.optional(),
  color: colorAdjustSchema.optional(),
  /** Footage: âm lượng 0..2, mặc định 1 (muted=true vẫn thắng) */
  volume: z.number().min(0).max(2).optional(),
  /** Footage: fade âm vào/ra (giây, 0..10) */
  fadeInSec: z.number().min(0).max(10).optional(),
  fadeOutSec: z.number().min(0).max(10).optional(),
  /**
   * Footage: tốc độ phát 0.25..4, mặc định 1. Thời lượng scene (khi không khai
   * durationInFrames) = (round(to*fps) - round(from*fps)) / speed - xem duration.ts.
   */
  speed: z.number().min(SPEED_MIN).max(SPEED_MAX).optional(),
  /** Kiểu chuyển cảnh sang scene KẾ (trong transitionOverlap) - mặc định fade */
  transition: sceneTransitionSchema.optional(),
});

/**
 * Một từ trong cue karaoke. `start`/`end` là FRAME TUYỆT ĐỐI trên timeline
 * composition (cùng hệ quy chiếu với sfx[].atFrame) — không phải giây, không
 * phải offset trong cue. Lý do: manifest được sinh từ transcript đã map sang
 * timeline đã cắt, giữ một hệ quy chiếu duy nhất thì dễ soi bằng mắt hơn.
 */
export const captionWordSchema = z.looseObject({
  text: z.string().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  /** Keyword quan trọng — tô nhấn suốt cue, không chỉ lúc đang đọc tới */
  hi: z.boolean().optional(),
});

/**
 * Dời/đổi cỡ MỘT cue (karaoke, phụ đề, highlight) so với chỗ neo mặc định của
 * track - người dùng kéo trên khung xem trước của editor. `x`/`y` là phần của
 * CHIỀU RỘNG/CHIỀU CAO khung (0.1 = dời 10% khung), `scale` nhân lên cỡ gốc.
 * Bỏ trống = đúng vị trí cũ, nên manifest không có field này ra hình y hệt.
 */
export const CUE_SCALE_MIN = 0.3;
export const CUE_SCALE_MAX = 3;
export const cueTransformSchema = z.looseObject({
  x: z.number().min(-1).max(1).optional(),
  y: z.number().min(-1).max(1).optional(),
  scale: z.number().min(CUE_SCALE_MIN).max(CUE_SCALE_MAX).optional(),
});

/** Một cụm phụ đề (4–7 từ) hiện cùng lúc, karaoke chạy trong cụm. */
export const captionCueSchema = z.looseObject({
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  words: z.array(captionWordSchema).min(1),
  transform: cueTransformSchema.optional(),
});

/**
 * Một câu phụ đề THƯỜNG (tính năng "Dịch video") - khác `captionCueSchema`:
 * không karaoke theo từ, chỉ một khối chữ hiện trong khoảng thời gian của nó.
 * `from`/`durationInFrames` theo FRAME TUYỆT ĐỐI trên timeline composition,
 * cùng hệ quy chiếu với captions[] và sfx[].atFrame.
 */
export const subtitleCueSchema = z.looseObject({
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  /** Đã xuống dòng sẵn bằng "\n" - SubtitleTrack render với white-space: pre-line */
  text: z.string().min(1),
  transform: cueTransformSchema.optional(),
});

/**
 * Kiểu dáng phụ đề dịch - mọi trường bỏ trống thì SubtitleTrack lấy đúng giá
 * trị đang dùng của CaptionTrack (xem components/SubtitleTrack.tsx), nên
 * manifest không khai subtitleStyle vẫn ra hình giống hệt phụ đề hiện tại.
 * fontSizePx/bottomPx tính theo canvas gốc 1080x1920 rồi nhân đơn vị tỉ lệ `u`.
 */
export const subtitleStyleSchema = z.looseObject({
  /** Id trong bảng font cho phép của SubtitleTrack - id lạ rơi về font tiếng Việt */
  fontFamily: z.string().optional(),
  fontSizePx: z.number().positive().optional(),
  color: z.string().optional(),
  /** "none" vẫn đọc được nhờ text-shadow (không bao giờ để chữ trần trên footage sáng) */
  backdrop: z.enum(["blur", "solid", "none"]).default("blur"),
  backdropColor: z.string().optional(),
  blurPx: z.number().min(0).default(20),
  bottomPx: z.number().min(0).optional(),
});

/** Một mẩu chữ trong thẻ highlight; `hi` = tô màu accent (key được nhấn). */
export const highlightPartSchema = z.looseObject({
  t: z.string().min(1),
  hi: z.boolean().optional(),
});

/**
 * Một thẻ "làm nổi bật key" hiện TRÊN footage gốc (khác phụ đề: không đọc theo
 * từ, chỉ chọn key chính/phụ). `from`/`durationInFrames` theo FRAME TUYỆT ĐỐI
 * trên timeline composition — cùng hệ quy chiếu với sfx[].atFrame.
 */
export const highlightCueSchema = z.looseObject({
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  /** Nhãn nhỏ in hoa phía trên (vd "Sự kiện"), bỏ trống thì không hiện */
  kicker: z.string().optional(),
  parts: z.array(highlightPartSchema).min(1),
  /** "main" = thẻ lớn có gạch accent (key chính); "sub" = pill nhỏ (key phụ) */
  tier: z.enum(["main", "sub"]).optional(),
  /** Màu nhấn: "hot" = đỏ/cam primary, "cool" = xanh accent */
  accent: z.enum(["hot", "cool"]).optional(),
  transform: cueTransformSchema.optional(),
});

/**
 * Nhạc nền toàn bài, loop nếu ngắn hơn video, auto-ducking TẤT ĐỊNH theo
 * speech ranges (AI sinh từ transcript — xem skill `background-music`).
 */
export const musicSchema = z.looseObject({
  /** Đường dẫn tương đối trong staging, vd "staging/vid-demo/assets__music__lofi.mp3" */
  file: z.string().min(1),
  /** Âm lượng khi KHÔNG có thoại (intro/outro/khoảng nghỉ) */
  volume: z.number().min(0).max(1).default(0.35),
  /** Âm lượng khi ĐANG có thoại — nhạc phải thấp hơn giọng rõ rệt */
  duckVolume: z.number().min(0).max(1).default(0.12),
  /**
   * Các đoạn CÓ thoại: mảng [startSec, endSec] tính bằng GIÂY trên timeline
   * composition. AI sinh từ word timestamps của transcript, gap < 0.6s đã merge.
   */
  speech: z.array(z.tuple([z.number(), z.number()])).default([]),
  /** Fade vào đầu video (giây) - bỏ trống = 0.5s như trước, 0 = không fade */
  fadeInSec: z.number().min(0).max(10).optional(),
  /** Fade ra cuối video (giây) - bỏ trống = 1s như trước, 0 = không fade */
  fadeOutSec: z.number().min(0).max(10).optional(),
});

export const audioSchema = z.looseObject({
  /** Voice-over chạy suốt từ frame 0 (đường dẫn staging) */
  voice: z.string().nullable().optional(),
  sfx: z.array(sfxSchema).default([]),
  /** Nhạc nền auto-ducking — null = không dùng nhạc */
  music: musicSchema.nullable().default(null),
});

// ---------------------------------------------------------------- layer chồng (EDITOR-V2 mục 1.2)

export const LAYER_ANIMS = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "pop",
  "zoom",
] as const;

export const layerStyleSchema = z.looseObject({
  /** Id trong bảng font của SubtitleTrack (vietnamese|sans|serif|mono) - id lạ rơi về font tiếng Việt */
  fontFamily: z.string().optional(),
  /** px của COMPOSITION (không nhân u) - mặc định 6% cạnh ngắn của khung */
  fontSizePx: z.number().positive().max(1000).optional(),
  fontWeight: z.number().min(100).max(1000).optional(),
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  lineHeight: z.number().min(0.5).max(5).optional(),
  backgroundColor: z.string().optional(),
  paddingPx: z.number().min(0).max(1000).optional(),
  radiusPx: z.number().min(0).max(5000).optional(),
  strokeColor: z.string().optional(),
  strokeWidthPx: z.number().min(0).max(100).optional(),
  shadow: z.boolean().optional(),
});

export const layerKeyframeSchema = z.looseObject({
  /** Frame TƯƠNG ĐỐI so với layer.from */
  frame: z.number().int().min(0),
  x: z.number().min(-1).max(1).optional(),
  y: z.number().min(-1).max(1).optional(),
  scale: z.number().min(0.1).max(5).optional(),
  rotate: z.number().min(-180).max(180).optional(),
  opacity: z.number().min(0).max(1).optional(),
  ease: z.enum(["linear", "in", "out", "inOut"]).optional(),
});

/**
 * Layer chồng trên scene (ảnh/video PiP/chữ/khối màu). Vẽ theo thứ tự mảng -
 * phần tử sau nằm trên; cả track layer nằm TRÊN scene, DƯỚI highlight/phụ đề/
 * watermark. `from`/`durationInFrames` là FRAME TUYỆT ĐỐI như cue. Hình học
 * (vị trí/cỡ/hiệu ứng/keyframe) tính bằng `layerBox` (layerGeometry.ts) - hàm
 * dùng chung với khung kéo-thả của trình chỉnh sửa.
 */
export const layerSchema = z.looseObject({
  id: z.string().min(1),
  kind: z.enum(["image", "video", "text", "shape"]),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  /** image/video: đường dẫn trong project (meta) / staging (resolved) */
  src: z.string().optional(),
  /** video: giây bắt đầu trong file */
  mediaStart: z.number().min(0).optional(),
  /** video: mặc định true */
  muted: z.boolean().optional(),
  /** video: 0..2 */
  volume: z.number().min(0).max(2).optional(),
  /** text: cho phép xuống dòng */
  text: z.string().optional(),
  style: layerStyleSchema.optional(),
  /** Bề rộng hộp, tỉ lệ theo chiều rộng khung 0.05..2 - mặc định 0.5 */
  width: z.number().min(0.05).max(2).optional(),
  /** shape: tỉ lệ rộng/cao (mặc định 16/9); image/video: dự phòng khi chưa đo được file */
  aspect: z.number().min(0.05).max(20).optional(),
  transform: frameTransformSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  fit: z.enum(["cover", "contain"]).optional(),
  crop: cropSchema.optional(),
  color: colorAdjustSchema.optional(),
  /** Bo góc image/video (px composition) */
  radiusPx: z.number().min(0).max(5000).optional(),
  animation: z
    .looseObject({
      in: z.enum(LAYER_ANIMS).optional(),
      out: z.enum(LAYER_ANIMS).optional(),
      /** Mặc định 0.4s */
      durationSec: z.number().min(0).max(10).optional(),
    })
    .optional(),
  keyframes: z.array(layerKeyframeSchema).optional(),
  /**
   * CHỈ ở bản resolved: tỉ lệ rộng/cao THẬT của file image/video (ffprobe ở
   * server, preview.media ở trình phát) - không lưu trong meta.json.
   */
  mediaAspect: z.number().positive().optional(),
});

/**
 * Logo thương hiệu đóng góc suốt video.
 *
 * Server TỰ chèn từ logo của Style Design (xem jobs/assemble.ts) - KHÔNG phải
 * do AI quyết định. Đây là chủ ý: watermark mà để agent tự nhớ chèn thì sớm
 * muộn cũng có video quên mất, còn logo đóng góc là thứ không được phép quên.
 */
export const watermarkSchema = z.looseObject({
  /** Đường dẫn ảnh trong staging */
  file: z.string().min(1),
  /** Góc đặt - mặc định trên-trái */
  position: z
    .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
    .default("top-left"),
  /**
   * Chiều cao logo theo % chiều cao video - giữ nguyên tỉ lệ khung ảnh.
   * 3% (không phải 6%): mức 6% đo trên khung dọc 1080x1920 ra logo cao 115px,
   * to át cả nội dung. Logo đóng góc là để NHẬN RA, không phải để đọc.
   */
  heightPercent: z.number().positive().max(30).default(3),
  /** Lề tính theo % CHIỀU RỘNG cho cả hai trục, để khoảng cách nhìn đều nhau */
  marginPercent: z.number().min(0).max(30).default(4),
  /** Hơi chìm để không tranh nhìn với nội dung, nhưng vẫn phải đọc ra được */
  opacity: z.number().min(0).max(1).default(0.9),
});

export const manifestSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  /** "draft" | "rendering" | "done" — giữ string để không strict-fail giá trị mới */
  status: z.string(),
  scenes: z.array(sceneSchema).min(1),
  audio: audioSchema.default({ sfx: [], music: null }),
  /**
   * Phụ đề karaoke overlay TOÀN BÀI (việc của tầng lắp ráp, xem skill
   * video-pipeline). Rỗng = không overlay; scene HyperFrames tự lo chữ của nó.
   */
  captions: z.array(captionCueSchema).default([]),
  /**
   * Phụ đề THƯỜNG của tính năng "Dịch video" (bản dịch, không karaoke).
   * Rỗng = không có. Chạy song song được với captions[] - xem Assemble.tsx.
   */
  subtitles: z.array(subtitleCueSchema).default([]),
  /** Kiểu dáng phụ đề dịch - bỏ trống = mặc định giống CaptionTrack */
  subtitleStyle: subtitleStyleSchema.optional(),
  /**
   * Thẻ "làm nổi bật key chính" overlay trên footage — dùng khi brief tắt phụ
   * đề nhưng vẫn cần key nổi bật lúc video chạy (skill noti-tiktok-vn).
   * Rỗng = không overlay.
   */
  overlays: z.array(highlightCueSchema).default([]),
  /** Layer chồng (ảnh/video/chữ/khối) - rỗng = không có. Xem layerSchema. */
  layers: z.array(layerSchema).default([]),
  /** Logo thương hiệu đóng góc - null = Style Design không có logo */
  watermark: watermarkSchema.nullable().default(null),
  output: z.string().nullable().optional(),
});

export type Sfx = z.infer<typeof sfxSchema>;
export type Music = z.infer<typeof musicSchema>;
export type Zoom = z.infer<typeof zoomSchema>;
export type CaptionWord = z.infer<typeof captionWordSchema>;
export type CaptionCue = z.infer<typeof captionCueSchema>;
export type CueTransform = z.infer<typeof cueTransformSchema>;
export type SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type SubtitleStyle = z.infer<typeof subtitleStyleSchema>;
export type HighlightCue = z.infer<typeof highlightCueSchema>;
export type Watermark = z.infer<typeof watermarkSchema>;
export type ColorAdjustValue = z.infer<typeof colorAdjustSchema>;
export type Crop = z.infer<typeof cropSchema>;
export type FrameTransform = z.infer<typeof frameTransformSchema>;
export type TransitionType = (typeof TRANSITION_TYPES)[number];
export type Layer = z.infer<typeof layerSchema>;
export type LayerStyle = z.infer<typeof layerStyleSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

/** Độ dài hiệu dụng của một scene (frame). */
export const resolveSceneDurationInFrames = (scene: Scene, fps: number): number => {
  if (scene.durationInFrames != null) {
    return scene.durationInFrames;
  }
  if (scene.srcVideo && scene.from != null && scene.to != null) {
    // Làm tròn TỪNG ĐẦU như SceneClip (startFrom/endAt), không làm tròn hiệu:
    // from=1.02, to=3.98 @30fps thì round(2.96*30)=89 nhưng video chỉ phát
    // 119-31=88 frame - thừa 1 frame nền đen ở mỗi điểm cắt. Có `speed` thì
    // chia tốc độ SAU khi làm tròn hai đầu (duration.ts - helper dùng chung).
    return footageDurationFrames(scene.from, scene.to, fps, sceneSpeedOf(scene));
  }
  throw new Error(
    `Scene "${scene.id}" thiếu durationInFrames (scene srcVideo có thể thay bằng from/to).`
  );
};

/**
 * Tổng độ dài composition = cộng dồn durationInFrames các scene,
 * trừ transitionOverlap khi chuyển sang scene kế (xem skill remotion-assemble).
 */
export const totalDurationInFrames = (manifest: Manifest): number => {
  let from = 0;
  let total = 0;
  for (const scene of manifest.scenes) {
    const duration = resolveSceneDurationInFrames(scene, manifest.fps);
    total = Math.max(total, from + duration);
    from += duration - (scene.transitionOverlap ?? 0);
  }
  return Math.max(1, total);
};
