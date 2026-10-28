/**
 * Rào đầu vào cho ffmpeg/ffprobe chạy trên file NGƯỜI DÙNG đưa vào (upload,
 * footage, ảnh từ nhà cung cấp ảnh).
 *
 * VÌ SAO: ffmpeg chọn demuxer theo NỘI DUNG file chứ không theo đuôi. Một
 * "clip.mp4" thật ra là playlist HLS (`#EXTM3U` + `http://...`) hay ffconcat sẽ
 * khiến ffmpeg tự mở URL (SSRF - kể cả http://127.0.0.1:6869) hoặc file khác
 * trên đĩa, rồi nướng nội dung vào output mà /media phục vụ lại. Chỉ cho mở
 * `file` + `pipe` + `fd` (ffmpeg 8 mở stdin "-" bằng giao thức fd - thiếu là
 * hỏng luồng rawvideo của postprocess.ts) là đủ cho mọi luồng mp4/mov/mkv/webm/
 * mp3/wav/m4a, concat list nội bộ và lavfi (lavfi không mở giao thức nào).
 *
 * ffmpeg: whitelist là option của TỪNG input nên phải chèn trước MỖI `-i`.
 * ffprobe: một input duy nhất, đặt đầu là đủ.
 */
const INPUT_PROTOCOLS = "file,pipe,fd";

/** Chèn `-protocol_whitelist file,pipe,fd` trước mọi `-i` */
export function ffmpegSafeArgs(args: string[]): string[] {
  const out: string[] = [];
  for (const a of args) {
    if (a === "-i") out.push("-protocol_whitelist", INPUT_PROTOCOLS);
    out.push(a);
  }
  return out;
}

/** Thêm `-protocol_whitelist file,pipe,fd` vào đầu tham số ffprobe */
export function ffprobeSafeArgs(args: string[]): string[] {
  return ["-protocol_whitelist", INPUT_PROTOCOLS, ...args];
}

/**
 * Định dạng "danh sách" (playlist/concat) - không bao giờ là footage thật.
 * format_name của ffprobe dạng "mov,mp4,m4a,..." nên so từng phần tử.
 */
const PLAYLIST_FORMATS = new Set(["hls", "applehttp", "concat", "ffconcat", "dash", "smoothstreaming"]);

/** true = input là playlist/concat trá hình, phải từ chối */
export function isPlaylistFormat(formatName: unknown): boolean {
  if (typeof formatName !== "string") return false;
  return formatName
    .toLowerCase()
    .split(",")
    .some((f) => PLAYLIST_FORMATS.has(f.trim()));
}
