import { Router } from "express";
import { HttpError } from "../util.js";
import {
  GATEWAY_DELAY_MAX_SEC,
  isGatewayDelaySec,
  isImageProviderChoice,
  listImageProviders,
  readDefaultProvider,
  readGatewayDelaySec,
  writeDefaultProvider,
  writeGatewayDelaySec,
} from "../imageProviders/index.js";

/**
 * Chọn nhà cung cấp tạo ảnh mặc định (docs/EDITOR-V2-PLAN.md §4.3) + khoảng
 * nghỉ giữa hai ảnh trên gateway web (imageProviders/gatewayQueue.ts).
 * Cấu hình lưu apps/server/data/image-providers.json. "auto" = provider mặc
 * định rồi lần lượt các provider đã cấu hình còn lại (imageProviders/index.ts).
 */
const router = Router();

// GET /api/image-providers → {default, gatewayDelaySec, providers:[{id, label, configured, models}]}
router.get("/", (_req, res) => {
  res.json(listImageProviders());
});

// PUT /api/image-providers {default?, gatewayDelaySec?} → {default, gatewayDelaySec}
router.put("/", (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!("default" in body) && !("gatewayDelaySec" in body)) {
    throw new HttpError(400, "NOTHING_TO_UPDATE", "Cần gửi default hoặc gatewayDelaySec");
  }
  if ("default" in body && !isImageProviderChoice(body.default)) {
    throw new HttpError(
      400,
      "INVALID_PROVIDER",
      'default phải là một trong: "auto", "gemini-api", "chatgpt-web", "gemini-web"',
    );
  }
  if ("gatewayDelaySec" in body && !isGatewayDelaySec(body.gatewayDelaySec)) {
    throw new HttpError(
      400,
      "INVALID_GATEWAY_DELAY",
      `gatewayDelaySec phải là số nguyên giây từ 0 đến ${GATEWAY_DELAY_MAX_SEC}`,
    );
  }
  if (isImageProviderChoice(body.default)) writeDefaultProvider(body.default);
  if (isGatewayDelaySec(body.gatewayDelaySec)) writeGatewayDelaySec(body.gatewayDelaySec);
  res.json({ default: readDefaultProvider(), gatewayDelaySec: readGatewayDelaySec() });
});

export default router;
