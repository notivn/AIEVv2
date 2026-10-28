import type { NextConfig } from "next";

const SERVER_PORT = process.env.SERVER_PORT || "6869";

const nextConfig: NextConfig = {
  // MỘT biến SERVER_PORT điều khiển cả hai đường tới backend:
  // - rewrites bên dưới (proxy /api, /media qua Next);
  // - serverOrigin() trong lib/api.ts (client gọi THẲNG backend cho upload,
  //   bootstrap token) - phía client chỉ đọc được biến NEXT_PUBLIC_*.
  // Lưu ý: NEXT_PUBLIC_* được "nướng" vào bundle LÚC BUILD - đổi SERVER_PORT
  // thì phải build lại (dev server tự restart là đủ).
  env: {
    NEXT_PUBLIC_SERVER_PORT:
      process.env.SERVER_PORT ?? process.env.NEXT_PUBLIC_SERVER_PORT ?? "6869",
  },
  // Huy hiệu dev-tools của Next mặc định neo góc TRÁI DƯỚI - đúng chỗ nút thu gọn
  // thanh điều hướng nằm, nên lúc chạy `npm run dev` nó đè lên nút (bản production
  // không có huy hiệu này). Đẩy sang phải cho khỏi vướng.
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    // Proxy rewrite mặc định timeout 30s - video lớn (media/stream) cần lâu hơn.
    // Trên LAN upload đi thẳng backend, nhưng qua domain công cộng thì mọi thứ
    // kể cả upload đều chui qua đây, nên hai mốc dưới là đường đi chính.
    proxyTimeout: 10 * 60 * 1000,
    // Proxy mặc định CẮT body ở 10MB: phần vượt bị bỏ, multer chờ hết stream
    // rồi timeout -> upload video qua domain công cộng chết với lỗi 500 khó hiểu.
    // Nới bằng mức multer đang cho phép (2GB) để một chỗ không âm thầm chặn chỗ kia.
    proxyClientMaxBodySize: 2 * 1024 * 1024 * 1024,
  },
  // Header an toàn cho mọi trang dashboard. KHÔNG đặt CSP đầy đủ (script-src...):
  // Next chèn script inline để hydrate, Remotion Player cần blob:/media, và
  // dashboard còn gọi thẳng backend :6869 / IP LAN - một CSP chặt sẽ vỡ ngầm.
  // Chỉ khóa những thứ app không bao giờ dùng: bị nhúng khung (clickjacking),
  // plugin, <base> lạ, form gửi ra ngoài.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // URL có thể mang ?t= (token chính) hoặc ?k= (token QR)
          { key: "Referrer-Policy", value: "same-origin" },
          // Trang Giọng đọc thu âm bằng micro - chỉ cho chính origin này
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${SERVER_PORT}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `http://localhost:${SERVER_PORT}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
