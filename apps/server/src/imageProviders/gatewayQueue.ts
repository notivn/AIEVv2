/**
 * Hàng đợi ảnh cho hai gateway web (ChatGPT web, Gemini cookie web): MỖI gateway
 * chỉ vẽ MỘT ảnh một lúc, ảnh xong thì nghỉ `delayMs()` rồi mới tới ảnh kế tiếp
 * - kể cả khi ảnh trước lỗi, và kể cả ảnh đến muộn sau khi hàng đã trống. Tài
 * khoản web bị bắn liên tục (editor, ảnh minh họa của agent, image project,
 * thumbnail cùng lúc) dễ bị giới hạn hoặc khóa; Gemini API trả tiền theo lượt
 * thì không đi qua đây.
 *
 * Hàng đợi nằm trong RAM của server: mọi lời gọi tạo ảnh đều đi qua
 * generateImage() (imageProviders/index.ts) nên chặn một chỗ là đủ.
 */

export type GatewayQueueId = "chatgpt-web" | "gemini-web";

interface Lane {
  /** Lượt cuối cùng đã xếp - lượt mới nối đuôi vào đây */
  tail: Promise<void>;
  /** Số lượt đang chờ + đang vẽ */
  pending: number;
  /** Ảnh gần nhất xong lúc nào (ms) - khoảng nghỉ tính từ mốc này */
  lastDoneAt: number;
}

const lanes = new Map<GatewayQueueId, Lane>();

function laneOf(id: GatewayQueueId): Lane {
  let lane = lanes.get(id);
  if (!lane) {
    lane = { tail: Promise.resolve(), pending: 0, lastDoneAt: 0 };
    lanes.set(id, lane);
  }
  return lane;
}

/** Số ảnh đang chờ + đang vẽ trên một gateway */
export function gatewayQueueLength(id: GatewayQueueId): number {
  return lanes.get(id)?.pending ?? 0;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Chạy `fn` khi tới lượt trên gateway `id`. `delayMs()` đọc ngay trước mỗi lượt,
 * nên đổi cấu hình giữa chừng có hiệu lực từ ảnh kế tiếp.
 */
export async function runInGatewayQueue<T>(
  id: GatewayQueueId,
  fn: () => Promise<T>,
  opts: { delayMs: () => number; onLog?: (line: string) => void; isCanceled?: () => boolean },
): Promise<T> {
  const lane = laneOf(id);
  const ahead = lane.pending;
  lane.pending++;
  if (ahead > 0) opts.onLog?.(`[image] ${id}: chờ lượt (${ahead} ảnh phía trước)`);

  const prev = lane.tail;
  let release!: () => void;
  lane.tail = new Promise<void>((r) => (release = r));

  let ran = false;
  try {
    await prev;
    const rest = lane.lastDoneAt + Math.max(0, opts.delayMs()) - Date.now();
    if (rest > 0) {
      opts.onLog?.(`[image] ${id}: nghỉ ${Math.ceil(rest / 1000)}s trước ảnh kế tiếp`);
      await sleep(rest);
    }
    // Job bị hủy trong lúc chờ lượt: chưa gửi gì đi thì đừng gửi - không mất lượt ảnh
    if (opts.isCanceled?.()) throw new Error("Job đã bị hủy");
    ran = true;
    return await fn();
  } finally {
    // Lượt bị bỏ vì hủy không vẽ gì - không bắt ảnh kế tiếp phải nghỉ theo nó
    if (ran) lane.lastDoneAt = Date.now();
    lane.pending--;
    release();
  }
}
