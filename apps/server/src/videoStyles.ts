import fs from "node:fs";
import path from "node:path";
import { paths } from "./config.js";
import { ensureDir, nowIso } from "./util.js";

/**
 * Phong cách dựng video - "video này TRÔNG như thế nào".
 *
 * KHÁC HẲN Style Design: Style Design là bộ NHẬN DIỆN THƯƠNG HIỆU (màu, font,
 * logo) và luôn được cưỡng chế. Phong cách dựng là NGÔN NGỮ THỊ GIÁC của riêng
 * video đó: giấy gấp, tranh mực tàu, người que... Hai thứ chồng lên nhau -
 * cùng một bộ màu thương hiệu vẫn dựng được video giấy gấp hay video pixel art.
 *
 * VÌ SAO PHẢI THAY THẾ CHỨ KHÔNG CỘNG THÊM: prompt ảnh mặc định trong
 * gemini.ts luôn kết bằng "professional advertising background, cinematic
 * depth" - tức là ngầm định ảnh quảng cáo bóng bẩy. Cộng thêm "origami giấy"
 * vào đó là ra một thứ nửa nọ nửa kia. Nên mỗi phong cách mang theo câu chỉ đạo
 * mỹ thuật RIÊNG (`art`) để đá hẳn câu mặc định ra, kèm `avoid` để chặn đúng
 * những thứ hay lẫn vào.
 *
 * ---------------------------------------------------------------------------
 * TỪ CODE SANG DỮ LIỆU (giống hệt styles.ts của Style Design)
 *
 * Trước đây các phong cách là một mảng hằng trong file này, sửa được thì phải
 * sửa code. Giờ nguồn sự thật là `assets/video-styles/video-styles.json`, còn
 * mảng `BUILTIN_VIDEO_STYLES` bên dưới chỉ còn là HẠT GIỐNG:
 *
 * - Lần đọc đầu tiên chưa có file JSON -> ghi ra từ mảng này (repo mới clone
 *   vẫn có đủ phong cách mặc định, không cần bước cài đặt nào).
 * - Bản cập nhật repo sau này thêm phong cách dựng mới vào mảng -> lần đọc kế
 *   tiếp tự chèn phong cách đó vào file của người dùng, TRỪ KHI họ đã xóa nó
 *   (id nằm trong `removedBuiltins`). Không có danh sách đó thì phong cách vừa
 *   xóa sẽ mọc lại sau mỗi lần khởi động server.
 * - Người dùng sửa/xóa/thêm gì trên dashboard cũng chỉ ghi vào file JSON; mảng
 *   hạt giống giữ nguyên để nút "Khôi phục bản gốc" còn cái mà khôi phục.
 */

/** Bảng màu: đa số phong cách vẫn theo màu thương hiệu; vài phong cách thì không thể */
export type VideoStylePalette = "brand" | "loose";

export const VIDEO_STYLE_PALETTES: VideoStylePalette[] = ["brand", "loose"];

export interface VideoStyle {
  id: string;
  /**
   * Tên tiếng Việt. Web ưu tiên bản dịch theo key `vstyle.<id>`; tên này là
   * lưới an toàn và là thứ đưa vào prompt cho AI đọc.
   */
  name: string;
  /**
   * Chỉ đạo mỹ thuật cho Gemini - viết TIẾNG ANH vì model bám sát hơn hẳn so
   * với tiếng Việt ở phần mô tả chất liệu/kỹ thuật vẽ.
   */
  art: string;
  /** Thứ phải tránh - chặn đúng cái hay lẫn vào của riêng phong cách này */
  avoid: string;
  /**
   * "brand" = giữ nguyên bảng màu thương hiệu (mặc định).
   * "loose" = phong cách có bảng màu ruột của nó, ép màu brand vào là mất chất;
   * màu thương hiệu lúc đó chỉ dùng làm điểm nhấn. UI PHẢI nói rõ chỗ này.
   */
  palette: VideoStylePalette;
  /** Dựng cảnh và chuyển động cho HyperFrames/Remotion - tiếng Việt, cho agent đọc */
  motion: string;
  createdAt: string;
  updatedAt: string;
}

/** Hạt giống chưa có mốc thời gian - timestamp sinh lúc gieo vào file JSON */
export type VideoStyleSeed = Omit<VideoStyle, "createdAt" | "updatedAt">;

export interface VideoStylesFile {
  styles: VideoStyle[];
  /**
   * Id phong cách MẶC ĐỊNH đã bị người dùng xóa. Giữ lại để lần đọc sau không
   * gieo lại - xóa rồi mà cứ mọc lại thì tính năng xóa coi như không có.
   */
  removedBuiltins: string[];
}

/**
 * 50 phong cách mặc định (20 ban đầu + 30 thêm sau). Tiêu chí chọn: (1) nhìn là
 * phân biệt được ngay với các phong cách còn lại, (2) Gemini vẽ ra được ổn định,
 * (3) HTML/CSS/GSAP dựng chuyển động hợp với nó được - đẹp mà pipeline không
 * dựng nổi thì chỉ là danh sách trang trí.
 */
export const BUILTIN_VIDEO_STYLES: VideoStyleSeed[] = [
  {
    id: "giay-gap-nhat",
    name: "Gấp giấy Nhật Bản",
    art: "Japanese paper craft scene: layered origami and kirigami cut-paper shapes, visible washi paper fibre texture, crisp folded creases, soft realistic drop shadows between paper layers, shallow paper-diorama depth, gentle even studio light.",
    avoid: "no photographic realism, no 3D glossy render, no digital gradients, no metallic surfaces",
    palette: "brand",
    motion:
      "Chuyển cảnh kiểu GẤP và LẬT giấy, không mờ chồng. Vật thể trượt vào theo lớp, mỗi lớp một bóng đổ nhẹ. Chữ đặt như dán trên mảnh giấy, hơi nghiêng vài độ. Nhịp thong thả, easing mềm.",
  },
  {
    id: "vox-explainer",
    name: "Giải thích kiểu VOX",
    art: "Editorial explainer illustration in the VOX/Vice News style: bold flat graphic shapes, halftone dot texture, cut-out archival photo collage elements, hand-drawn circles and arrows annotating the subject, high contrast, confident modern editorial layout.",
    avoid: "no soft airbrush, no photoreal 3D, no cute mascots, no pastel decoration",
    palette: "brand",
    motion:
      "Chữ tiêu đề CỰC ĐẬM, co hẹp, vào bằng cách trượt kèm khối màu quét ngang. Mũi tên và vòng khoanh vẽ tay chạy nét theo lời nói. Cắt cảnh dứt khoát đúng nhịp nhấn giọng, không dùng fade.",
  },
  {
    id: "tranh-ve-tay",
    name: "Tranh vẽ tay (màu nước)",
    art: "Hand-painted illustration: watercolour and gouache on textured cotton paper, visible brush strokes and pigment blooms, soft bleeding edges, subtle paper grain showing through, warm hand-made imperfection.",
    avoid: "no vector sharpness, no digital gradients, no 3D render, no photographic detail",
    palette: "brand",
    motion:
      "Hình hiện ra như mực loang, dùng mask quét dần chứ không phóng to. Chuyển động nhẹ, hơi trôi như giấy. Chữ viết tay hoặc serif mảnh. Tránh mọi chuyển động máy móc, giật cục.",
  },
  {
    id: "nguoi-que",
    name: "Người que bảng trắng",
    art: "Whiteboard marker drawing: simple black stick figures and quick schematic doodles on a clean white board, uneven hand-drawn marker line weight, minimal shading, a few colour accents only where meaning requires it.",
    avoid: "no realistic anatomy, no shading, no background scenery, no photographic elements",
    palette: "brand",
    motion:
      "Nét VẼ DẦN như đang được viết ra (stroke-dashoffset), không hiện sẵn. Mỗi ý một nét mới, ý cũ mờ bớt chứ không biến mất. Nhịp bám sát lời giảng, dừng lại đúng lúc người nói nhấn.",
  },
  {
    id: "flat-vector",
    name: "Vector phẳng",
    art: "Clean flat vector illustration: solid colour fills, no gradients, geometric simplified forms, generous negative space, consistent stroke weight, modern editorial infographic feel.",
    avoid: "no textures, no drop shadows, no 3D, no photographic elements, no gradients",
    palette: "brand",
    motion:
      "Hình khối trượt và xoay theo trục rõ ràng, easing dứt khoát. Chuyển cảnh bằng khối màu quét kín màn hình. Bố cục căn lưới nghiêm, chữ sans-serif đậm.",
  },
  {
    id: "isometric",
    name: "Đẳng cự 3D",
    art: "Isometric technical illustration: 30-degree axonometric projection, clean geometric buildings/objects/systems, flat shading with two light levels, precise edges, diagram-like clarity.",
    avoid: "no perspective vanishing points, no photographic texture, no hand-drawn wobble",
    palette: "brand",
    motion:
      "Camera trượt ngang chậm giữ đúng góc đẳng cự, KHÔNG xoay phối cảnh. Khối dựng lên từng tầng theo thứ tự giải thích. Đường nối giữa các khối chạy nét khi nhắc tới.",
  },
  {
    id: "dat-set",
    name: "Đất sét stop-motion",
    art: "Claymation scene: hand-moulded plasticine characters and props, visible fingerprints and tool marks in the clay, soft matte surface, tabletop miniature set, warm practical lighting with soft shadows.",
    avoid: "no smooth digital 3D, no glossy plastic, no vector flatness",
    palette: "brand",
    motion:
      "Chuyển động GIẬT nhẹ như stop-motion: giảm còn 12 hình/giây cho vật thể chính, nền vẫn mượt. Vật nảy nhẹ khi dừng. Tuyệt đối không easing quá mượt - mất chất thủ công.",
  },
  {
    id: "cat-dan-zine",
    name: "Cắt dán báo",
    art: "Cut-and-paste zine collage: torn newspaper and magazine scraps, ransom-note mixed typography, photocopied high-contrast textures, visible tape and staples, rough torn paper edges, punk DIY energy.",
    avoid: "no clean vector shapes, no smooth gradients, no polished corporate look",
    palette: "brand",
    motion:
      "Mảnh giấy DẬP xuống đúng nhịp trống, hơi lệch góc mỗi lần. Rung giật 1-2px giữ nhịp. Chữ nhảy cỡ và font liên tục. Cắt cảnh thô, không chuyển mượt.",
  },
  {
    id: "muc-tau",
    name: "Tranh mực tàu",
    art: "East Asian ink wash painting (sumi-e): black ink on rice paper, gradient washes from deep black to pale grey, confident single brush strokes, vast empty space as composition, subtle bleed into the paper fibre.",
    avoid: "no bright colours, no hard vector edges, no digital gradients, no busy detail",
    palette: "loose",
    motion:
      "Nét mực chạy theo hướng bút, đầu đậm cuối nhạt. Giữ RẤT NHIỀU khoảng trống, đừng lấp đầy khung. Chuyển cảnh bằng loang mực. Nhịp chậm, tĩnh, để hình thở.",
  },
  {
    id: "dong-ho",
    name: "Tranh Đông Hồ",
    art: "Vietnamese Dong Ho folk woodblock print: hand-carved block print look, bold black outlines, flat traditional mineral pigments, printed on textured diep paper with visible shimmering shell-powder ground, naive charming folk figures.",
    avoid: "no modern vector cleanliness, no photographic realism, no 3D shading, no anime styling",
    palette: "loose",
    motion:
      "Hình xuất hiện như ĐÓNG DẤU xuống giấy: hiện nhanh kèm rung nhẹ rồi đứng yên. Giữ nét viền dày đặc trưng. Bố cục cân đối kiểu tranh dân gian. Không dùng chuyển động bay lượn hiện đại.",
  },
  {
    id: "neon-cyber",
    name: "Neon cyberpunk",
    art: "Neon cyberpunk night scene: rain-slicked reflective surfaces, glowing neon signage, dense atmospheric haze, strong magenta-cyan rim lighting, deep black shadows, cinematic anamorphic flare.",
    avoid: "no daylight, no pastel, no flat vector, no clean minimal white space",
    palette: "brand",
    motion:
      "Chữ phát sáng kèm quầng nhẹ, nhấp nháy như đèn neon hỏng ở khung đầu. Nhiễu số và lệch kênh màu ở mỗi lần cắt cảnh. Camera trôi chậm liên tục, không đứng yên hẳn.",
  },
  {
    id: "in-retro-70",
    name: "In retro thập niên 70",
    art: "1970s offset print aesthetic: limited three-colour ink palette, visible misregistration between plates, heavy paper grain and print noise, halftone dots, warm faded inks, vintage poster composition.",
    avoid: "no crisp digital edges, no modern gradients, no 3D, no pure white brightness",
    palette: "brand",
    motion:
      "Mỗi lần cắt cảnh lệch bản in 2-3px rồi khớp lại. Hạt nhiễu chạy liên tục. Chữ dùng serif hoặc chữ cong kiểu poster cũ. Nhịp vừa phải, ấm áp.",
  },
  {
    id: "ban-ve-ky-thuat",
    name: "Bản vẽ kỹ thuật",
    art: "Technical blueprint schematic: precise white and pale cyan line work on deep blue ground, dimension lines and callout leaders, cross-section cutaways, drafting grid, engineering annotation marks.",
    avoid: "no photographic texture, no painterly shading, no decorative illustration",
    palette: "loose",
    motion:
      "Đường nét VẼ DẦN theo thứ tự lắp ráp, kèm đường kích thước bung ra. Lưới nền trôi rất chậm. Chữ dùng font đều nét kiểu bản vẽ. Cảm giác chính xác, không ngẫu hứng.",
  },
  {
    id: "pixel-art",
    name: "Pixel art",
    art: "16-bit pixel art: crisp aligned pixel grid, limited indexed palette, deliberate dithering for shading, chunky readable sprites, retro game scene composition.",
    avoid: "no anti-aliasing, no smooth curves, no gradients, no photographic detail",
    palette: "brand",
    motion:
      "Mọi thứ dịch chuyển theo BƯỚC pixel, không trượt mượt nửa pixel. Chuyển cảnh bằng ô vuông lấp dần. Chữ dùng font pixel. Giữ khung hình thấp cho đúng chất game cũ.",
  },
  {
    id: "anime-cel",
    name: "Anime cel-shading",
    art: "Anime cel-shaded illustration: clean confident line art, two-tone flat cel shading with hard shadow edges, expressive characters, dramatic speed lines, vivid saturated key light.",
    avoid: "no photorealism, no painterly blending, no 3D render, no western cartoon proportions",
    palette: "brand",
    motion:
      "Nhấn mạnh bằng đường tốc độ và rung khung hình ngắn. Cắt cảnh nhanh ở cao trào. Hiệu ứng loé sáng một khung khi nhấn. Chữ katakana-style hoặc sans đậm nghiêng.",
  },
  {
    id: "3d-studio",
    name: "3D studio bóng bẩy",
    art: "Polished 3D studio render: soft global illumination, seamless infinite backdrop, matte and glossy material contrast, subtle depth of field, product-visualisation quality, clean soft shadows.",
    avoid: "no hand-drawn texture, no flat vector, no grain, no visible brush strokes",
    palette: "brand",
    motion:
      "Camera trôi rất mượt kèm xoá phông nông. Vật thể xoay chậm liên tục. Chuyển cảnh bằng đẩy camera xuyên qua vật thể. Chữ mảnh, nhiều khoảng thở, sang trọng.",
  },
  {
    id: "anh-tai-lieu",
    name: "Ảnh thật tài liệu",
    art: "Documentary editorial photography: natural available light, authentic candid moments, realistic depth of field, true-to-life colour, photojournalistic framing, no staging.",
    avoid: "no illustration, no 3D render, no cartoon, no artificial studio gloss",
    palette: "loose",
    motion:
      "Ken Burns nhẹ: phóng và trôi rất chậm trên ảnh tĩnh. Chuyển cảnh cắt thẳng hoặc mờ chồng ngắn. Chữ đặt trên dải nền mờ để đọc được trên mọi ảnh.",
  },
  {
    id: "infographic",
    name: "Infographic số liệu",
    art: "Data-driven infographic: clean charts and diagrams, clear numeric hierarchy, generous white space, restrained iconography, precise alignment grid, editorial data-journalism clarity.",
    avoid: "no decorative clutter, no photographic background, no 3D chart effects, no drop shadows",
    palette: "brand",
    motion:
      "Cột và đường biểu đồ MỌC LÊN từ 0 đúng lúc đọc tới con số. Số đếm tăng dần thay vì hiện sẵn. Mỗi màn chỉ một ý số liệu. Căn lưới tuyệt đối.",
  },
  {
    id: "cat-out-puppet",
    name: "Rối giấy cắt",
    art: "Cut-out paper puppet animation: flat character parts with visible joint pivots, construction-paper texture, slightly crude hand-cut edges, simple layered stage-like backdrop.",
    avoid: "no smooth 3D, no realistic anatomy, no gradients, no photographic depth",
    palette: "brand",
    motion:
      "Nhân vật cử động bằng cách XOAY quanh khớp nối, chân tay là mảnh rời. Miệng đổi giữa vài hình cố định theo lời. Chuyển động thô, hài hước, hơi vụng về có chủ ý.",
  },
  {
    id: "giao-dien-app",
    name: "Giao diện app",
    art: "Modern app UI showcase: floating interface panels with frosted translucent glass, soft layered shadows, rounded corners, crisp iconography, subtle depth, clean tech product presentation.",
    avoid: "no hand-drawn texture, no grain, no photographic clutter, no skeuomorphic ornament",
    palette: "brand",
    motion:
      "Panel trượt vào kèm mờ nền phía sau. Con trỏ giả lập thao tác thật, bấm đâu có phản hồi đó. Chuyển cảnh bằng phóng vào một phần giao diện. Chữ sans hiện đại, cỡ chuẩn hệ thống.",
  },

  // ---- Đợt 2: thêm 30 phong cách. Cùng ba tiêu chí như trên; ưu tiên chất liệu
  // Việt/Á Đông (sơn mài, tranh lụa, gốm men lam) và các ngôn ngữ hay gặp trên
  // video ngắn hiện nay (chữ động, neo-brutalism, 3D đồ chơi, Y2K).
  {
    id: "vector-phat-sang",
    name: "Vector phát sáng (khoa học)",
    art: "Glowing science-explainer vector illustration: rounded friendly flat shapes with subtle soft gradients, gentle inner glow and rim light, deep dark backgrounds with tiny star or particle specks, layered parallax depth, cute simplified creatures and cosmic objects.",
    avoid: "no hard black outlines, no photographic texture, no realistic anatomy, no grunge, no harsh contrast",
    palette: "brand",
    motion:
      "Nhiều lớp parallax trôi chậm với tốc độ khác nhau, hạt sáng lơ lửng liên tục. Vật thể vào bằng phóng nhẹ kèm quầng sáng bừng lên. Chuyển cảnh bằng zoom xuyên qua một vật thể sang thế giới kế tiếp. Nhịp đều, mượt, tò mò.",
  },
  {
    id: "son-mai",
    name: "Tranh sơn mài",
    art: "Vietnamese son mai lacquer painting: many layers of lacquer polished to a deep glossy surface, gold and silver leaf, crushed eggshell inlay creating crackled white textures, rich vermilion red, deep black and warm brown lacquer tones, stylised figures and landscapes.",
    avoid: "no flat vector, no photographic realism, no 3D render, no pastel colours, no matte surfaces",
    palette: "loose",
    motion:
      "Hình hiện ra như lớp sơn được MÀI lộ dần: mask quét từ tối sang sáng, vàng lá lóe lên sau cùng. Dải sáng phản chiếu lướt chậm qua mặt tranh bóng. Nhịp trang trọng, chậm. Chữ serif mạ vàng, ít chữ.",
  },
  {
    id: "tranh-lua",
    name: "Tranh lụa Việt Nam",
    art: "Vietnamese silk painting: delicate translucent pigment washes on visible silk weave, soft muted earthy tones, fine ink contour lines, gentle atmospheric haze, poetic quiet scenes of figures, landscapes and daily life.",
    avoid: "no saturated colours, no hard vector edges, no heavy black outlines, no 3D render, no busy composition",
    palette: "loose",
    motion:
      "Hình hiện như màu THẤM vào lụa: mờ dần lên từ trong ra, không trượt. Camera trôi ngang rất chậm như cuộn tranh mở ra. Chuyển cảnh mờ chồng dài. Chữ serif mảnh hoặc thư pháp, đặt ở khoảng trống.",
  },
  {
    id: "gom-men-lam",
    name: "Gốm men lam",
    art: "Blue-and-white porcelain painting: cobalt blue underglaze brushwork on glossy white ceramic glaze, varied blue tonal washes, traditional floral, cloud and wave border motifs, subtle curved ceramic surface highlights, Chu Dau and Ming ware inspiration.",
    avoid: "no colours other than cobalt blue and white, no flat vector, no 3D plastic look, no photographic scenes",
    palette: "loose",
    motion:
      "Nét lam CHẠY như bút lông vẽ trên men, dày ở đầu nét. Họa tiết viền chạy vòng quanh khung rồi đứng yên làm khung tranh. Chuyển cảnh bằng xoay như bàn xoay gốm. Nhịp chậm, tinh tế.",
  },
  {
    id: "ukiyo-e",
    name: "Khắc gỗ Ukiyo-e",
    art: "Japanese ukiyo-e woodblock print: bold flowing outlines, flat areas of traditional pigment, Prussian blue and muted earth tones, stylised wave, cloud and wind patterns, visible woodgrain and washi paper texture, dramatic asymmetric composition.",
    avoid: "no 3D shading, no photographic realism, no anime styling, no modern gradients",
    palette: "loose",
    motion:
      "Các lớp màu in CHỒNG lần lượt như từng bản khắc, mỗi lớp một nhịp. Sóng và mây chuyển động theo đường cong cách điệu, lặp vòng. Camera trượt ngang kiểu tranh cuộn. Chữ dọc hoặc đặt trong ô chữ nhật như dấu triện.",
  },
  {
    id: "chu-dong",
    name: "Chữ động (kinetic typography)",
    art: "Minimal abstract background plates for kinetic typography: large calm fields of colour, subtle paper or film grain, simple geometric accents, lots of empty space reserved for text, no focal objects competing with type.",
    avoid: "no detailed scenes, no characters, no busy patterns, no text or letters in the image",
    palette: "brand",
    motion:
      "CHỮ LÀ NHÂN VẬT CHÍNH, hình ảnh chỉ làm nền. Từng từ vào đúng nhịp lời nói: phóng, xoay, tách chữ, đổi cỡ để nhấn từ khóa. Khung hình liên tục co giãn và xoay theo chữ. Rất ít ảnh minh họa, cắt nhanh theo nhịp.",
  },
  {
    id: "truyen-tranh-my",
    name: "Truyện tranh Mỹ (comic)",
    art: "American comic book art: bold inked outlines with confident brush weight, flat CMYK colours with Ben-Day dot shading, dynamic foreshortened poses, dramatic panel compositions, action burst shapes.",
    avoid: "no photorealism, no soft painterly blending, no 3D render, no manga screentone styling",
    palette: "brand",
    motion:
      "Mỗi ý là một Ô TRUYỆN: ô trượt vào lưới trang, camera nhảy từ ô này sang ô kia. Bong bóng thoại và chữ tượng thanh (BOOM, ZAP) bật ra với rung khung. Cắt cảnh nhanh, giật, nhiều năng lượng.",
  },
  {
    id: "pop-art",
    name: "Pop art",
    art: "1960s pop art: screen-printed look, bold flat saturated colour blocks, oversized Ben-Day halftone dots, thick black outlines, repeated grid of the same image in different colour variations, everyday objects made iconic.",
    avoid: "no subtle gradients, no muted tones, no photographic realism, no painterly texture",
    palette: "brand",
    motion:
      "Hình lặp thành LƯỚI 2x2 hoặc 3x3, mỗi ô đổi màu theo nhịp. Chấm halftone phóng to rồi thu lại khi nhấn. Cắt cảnh bằng đổi bảng màu tức thì, không mờ. Chữ đậm có viền đen dày.",
  },
  {
    id: "manga-den-trang",
    name: "Manga đen trắng",
    art: "Black-and-white manga page art: crisp pen ink lines, screentone dot and gradient shading, dramatic speed lines and focus lines, high-contrast spot blacks, expressive close-ups, paneled composition on white paper.",
    avoid: "no colour, no 3D render, no painterly blending, no western comic dot colouring",
    palette: "loose",
    motion:
      "Khung hình là các Ô MANGA chéo, camera lướt theo thứ tự đọc. Đường tập trung bung ra từ tâm khi nhấn ý. Hình hiện bằng nét mực vẽ dần rồi phủ tram. Chữ trong bong bóng thoại, chữ tượng thanh to và nghiêng.",
  },
  {
    id: "y2k-chrome",
    name: "Y2K chrome",
    art: "Y2K millennium aesthetic: liquid chrome and iridescent holographic surfaces, bubbly inflated 3D shapes, glossy reflections, translucent jelly plastic, sparkles and star glints, early-2000s digital optimism.",
    avoid: "no matte flat vector, no hand-drawn texture, no muted earthy colours, no grain",
    palette: "brand",
    motion:
      "Vật thể chrome xoay chậm, ánh phản chiếu chạy dọc bề mặt. Lấp lánh chớp ở góc mỗi khi chữ vào. Chữ phồng như bong bóng, bật nảy đàn hồi. Chuyển cảnh bằng gợn sóng lỏng hoặc biến hình mượt.",
  },
  {
    id: "3d-do-choi",
    name: "3D đồ chơi (claymorphism)",
    art: "Cute 3D toy-like illustration: soft rounded inflated shapes, smooth matte plastic and soft-touch materials, pastel-friendly lighting with soft ambient occlusion, chunky simplified characters and objects, playful miniature composition.",
    avoid: "no realistic textures, no sharp edges, no gritty detail, no hand-drawn lines, no photographic backgrounds",
    palette: "brand",
    motion:
      "Mọi thứ NẢY: vào bằng phóng từ 0 với easing đàn hồi, chạm đất thì bẹp nhẹ rồi bật lại. Vật thể lắc lư nhẹ khi đứng yên. Chuyển cảnh bằng khối tròn phóng to lấp màn hình. Chữ tròn, đậm, thân thiện.",
  },
  {
    id: "voxel",
    name: "Voxel khối vuông",
    art: "Voxel art 3D scene: everything built from small uniform cubes, clean blocky silhouettes, soft global lighting with gentle shadows, miniature diorama on a floating block island, playful game-world feel.",
    avoid: "no smooth curves, no organic surfaces, no 2D pixel flatness, no photographic textures",
    palette: "brand",
    motion:
      "Vật thể được LẮP từng khối rơi xuống xếp vào chỗ. Đảo khối xoay chậm như bàn trưng bày. Chuyển cảnh bằng tan thành khối vuông rồi ghép lại. Chữ font khối vuông hoặc pixel đậm.",
  },
  {
    id: "phan-bang-den",
    name: "Phấn bảng đen",
    art: "Chalk drawing on a dark green-black chalkboard: dusty chalk strokes with broken textured edges, soft pastel chalk colours, smudged erased traces in the background, hand-lettered labels, classroom diagram feel.",
    avoid: "no clean vector lines, no white background, no 3D render, no photographic elements",
    palette: "loose",
    motion:
      "Nét phấn VẼ DẦN với cạnh nhòe, có bụi phấn rơi nhẹ. Ý cũ bị xóa bằng khăn quét để lại vệt mờ chứ không biến sạch. Chữ viết tay nghiêng. Nhịp như thầy giảng bài, dừng đúng chỗ nhấn.",
  },
  {
    id: "so-tay-but-bi",
    name: "Sổ tay bút bi",
    art: "Notebook doodle sketchnotes: blue ballpoint pen drawings on lined or grid notebook paper, quick hatching, arrows, boxes and hand lettering, a few highlighter marker accents, coffee-ring and page-margin details.",
    avoid: "no clean vector, no digital gradients, no 3D render, no painterly colour fills",
    palette: "brand",
    motion:
      "Nét bút bi vẽ dần, mũi tên nối các ý theo lời nói. Bút dạ quang QUÉT qua từ khóa đúng lúc đọc. Lật trang sổ để chuyển cảnh. Chữ viết tay, xếp như ghi chú bài giảng.",
  },
  {
    id: "son-dau",
    name: "Sơn dầu ấn tượng",
    art: "Impressionist oil painting: thick impasto brush strokes with visible directional texture, broken colour dabs, vibrant light and atmosphere, canvas weave visible in thin areas, expressive loose rendering of subjects.",
    avoid: "no vector sharpness, no flat colour fills, no 3D render, no photographic detail",
    palette: "brand",
    motion:
      "Nét cọ ĐẮP dần lên canvas theo hướng vẽ. Ảnh trôi và phóng rất chậm, ánh sáng lung linh nhẹ. Chuyển cảnh bằng nét cọ quét ngang phủ kín. Chữ serif cổ điển, ít và lớn.",
  },
  {
    id: "phac-chi-than",
    name: "Phác thảo chì than",
    art: "Graphite and charcoal sketch on toned paper: expressive gestural lines, cross-hatching and smudged shading, visible construction lines, white chalk highlights, unfinished sketchbook edges fading into the paper.",
    avoid: "no colour fills, no vector cleanliness, no 3D render, no digital gradients",
    palette: "loose",
    motion:
      "Nét phác chạy trước, rồi lớp tô bóng mới phủ vào - thấy được quá trình vẽ. Phần chưa nói tới để dạng nét dựng hình mờ. Chuyển cảnh bằng lật trang sổ phác. Nhịp suy tư, chậm vừa.",
  },
  {
    id: "film-noir",
    name: "Film noir đen trắng",
    art: "1940s film noir still: high-contrast black-and-white photography, hard low-key lighting, venetian-blind shadow stripes, wet streets, fog and cigarette smoke, dramatic silhouettes and tilted Dutch angles.",
    avoid: "no colour, no flat lighting, no cartoon, no cheerful bright scenes",
    palette: "loose",
    motion:
      "Ánh đèn quét chậm, bóng rèm trượt qua khung. Nhiễu phim và chớp sáng nhẹ chạy liên tục. Chuyển cảnh bằng đóng mở vòng tròn (iris) hoặc cắt thẳng. Chữ serif kiểu máy chữ, hồi hộp, nhịp chậm.",
  },
  {
    id: "dien-anh-35mm",
    name: "Điện ảnh phim nhựa 35mm",
    art: "Cinematic 35mm film still: anamorphic widescreen framing, teal-and-orange colour grade, natural film grain and halation around highlights, shallow depth of field, motivated practical lighting, storytelling composition.",
    avoid: "no illustration, no cartoon, no flat digital look, no oversaturated HDR",
    palette: "loose",
    motion:
      "Khung hình có DẢI ĐEN letterbox trên dưới. Camera dolly chậm, ánh lóe ống kính khi có nguồn sáng. Hạt phim chạy liên tục. Chuyển cảnh cắt thẳng theo nhịp kể; chữ nhỏ, căn giữa như phụ đề phim.",
  },
  {
    id: "scrapbook",
    name: "Sổ ảnh kỷ niệm (scrapbook)",
    art: "Nostalgic scrapbook page: polaroid and instant photos with white borders, washi tape strips, handwritten notes, stickers, pressed flowers and ticket stubs, layered on kraft or cream paper with soft shadows.",
    avoid: "no clean vector, no 3D render, no harsh grunge, no corporate polish",
    palette: "brand",
    motion:
      "Ảnh polaroid THẢ xuống trang hơi xoay lệch, băng dính dán theo. Ghi chú viết tay hiện dần bên cạnh. Camera trượt dọc trang sổ. Chuyển cảnh bằng lật trang. Nhịp ấm áp, hoài niệm.",
  },
  {
    id: "kinh-mau",
    name: "Kính màu ghép chì",
    art: "Stained glass window art: jewel-toned translucent glass panes separated by dark lead came lines, light shining through with glow and colour bleed, textured cathedral glass, symmetric decorative framing.",
    avoid: "no photographic realism, no soft gradients across lead lines, no 3D render, no flat opaque colours",
    palette: "brand",
    motion:
      "Từng mảnh kính SÁNG LÊN lần lượt như có nắng chiếu qua. Vệt sáng quét chéo khung. Chuyển cảnh bằng mảnh kính ghép lại hoặc vỡ tách ra. Nhịp trang nghiêm, đối xứng.",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    art: "1920s Art Deco poster: bold geometric symmetry, gold metallic linework on deep black or navy, sunburst rays, stepped and fan motifs, elegant elongated figures, luxurious streamlined composition.",
    avoid: "no organic sloppy lines, no grunge, no cartoon, no pastel colours",
    palette: "loose",
    motion:
      "Đường vàng CHẠY NÉT đối xứng từ tâm ra hai bên. Tia nắng xòe ra sau tiêu đề. Chuyển cảnh bằng cửa mở đối xứng. Chữ display cao, mảnh, giãn chữ rộng. Nhịp sang trọng.",
  },
  {
    id: "memphis",
    name: "Memphis thập niên 80",
    art: "1980s Memphis design: playful clashing bright colours, squiggles, zigzags, confetti dots and terrazzo patterns, primitive geometric shapes floating with hard offset shadows, bold flat composition.",
    avoid: "no realism, no muted palette, no 3D render, no texture grain",
    palette: "brand",
    motion:
      "Hình khối và nét ngoằn ngoèo BAY vào từ mép khung, xoay và nảy. Họa tiết nền trôi lặp vòng. Chuyển cảnh bằng khối màu đổ ụp xuống. Chữ đậm, vui, hơi xoay lệch.",
  },
  {
    id: "neo-brutalism",
    name: "Neo-brutalism",
    art: "Neo-brutalist graphic design: flat bright colour blocks, thick black outlines on every shape, hard solid offset drop shadows, oversized raw typography areas, deliberately blunt layout, no decoration for decoration's sake.",
    avoid: "no soft shadows, no gradients, no rounded glossy UI, no photographic texture",
    palette: "brand",
    motion:
      "Thẻ và khối TRƯỢT vào rồi dừng cứng, bóng đổ cứng lệch theo. Khi nhấn, khối nhún xuống đè lên bóng của nó như nút bấm. Cắt cảnh dứt khoát, không mờ. Chữ cực to, đen, sans đậm.",
  },
  {
    id: "terminal-crt",
    name: "Màn hình terminal CRT",
    art: "Retro computer terminal on a CRT monitor: green or amber phosphor monospace text and ASCII diagrams on black, scanlines, curved screen glass with bloom and slight barrel distortion, hacker command-line aesthetic.",
    avoid: "no modern flat UI, no colour photography, no illustration, no rounded app components",
    palette: "loose",
    motion:
      "Chữ GÕ từng ký tự kèm con trỏ nhấp nháy. Vạch quét chạy dọc màn hình, nháy nhiễu khi chuyển cảnh. Sơ đồ ASCII hiện theo dòng. Chữ monospace toàn bộ, nhịp gõ phím.",
  },
  {
    id: "ban-do-co",
    name: "Bản đồ cổ",
    art: "Antique cartography: aged parchment map with ink linework, hand-lettered place names, compass rose, sea monsters and sailing ships, dotted travel routes, sepia washes, worn folds and torn edges.",
    avoid: "no modern GIS map look, no flat vector, no 3D render, no bright saturated colours",
    palette: "loose",
    motion:
      "Camera BAY trên bản đồ, đường hành trình đứt nét chạy dần theo câu chuyện. Địa danh và dấu mốc hiện như mực in xuống. Chuyển cảnh bằng cuộn giấy. Chữ serif cổ, nhịp kể chuyện lịch sử.",
  },
  {
    id: "sach-tranh-thieu-nhi",
    name: "Sách tranh thiếu nhi",
    art: "Children's picture book illustration: soft coloured pencil and crayon texture, gentle rounded characters, warm cosy palette, simple storybook scenes, visible paper tooth, charming slightly naive drawing.",
    avoid: "no harsh contrast, no realistic anatomy, no 3D render, no scary or dark themes",
    palette: "brand",
    motion:
      "Mỗi cảnh là một TRANG SÁCH, chuyển bằng lật trang. Nhân vật cử động nhẹ, lắc lư, chớp mắt. Chữ tròn, to, đặt như lời kể dưới tranh. Nhịp chậm, ấm, dễ theo.",
  },
  {
    id: "bong-cat",
    name: "Bóng cắt (silhouette)",
    art: "Silhouette shadow-puppet art: intricate solid black cut-out silhouettes of figures and scenery against a warm glowing backlit gradient sky, delicate lace-like cut details, layered depth by silhouette density.",
    avoid: "no interior detail inside silhouettes, no visible faces, no 3D shading, no photographic texture",
    palette: "loose",
    motion:
      "Bóng người cử động bằng cách XOAY KHỚP như rối bóng. Các lớp bóng trượt parallax trước nền trời sáng. Chuyển cảnh bằng nền trời đổi màu. Chữ mảnh, đặt ở vùng sáng, nhịp kể chuyện cổ tích.",
  },
  {
    id: "duotone",
    name: "Ảnh duotone",
    art: "Duotone photography: real photos mapped to exactly two bold colours, high contrast, graphic poster feel, clean cut-out subjects on solid colour fields, modern music-streaming campaign look.",
    avoid: "no full natural colour, no illustration, no busy multicolour scenes, no soft vintage fade",
    palette: "brand",
    motion:
      "Ảnh cắt nền TRƯỢT vào trên khối màu đặc, hơi phóng chậm. Mỗi lần nhấn đổi cặp màu duotone tức thì. Chuyển cảnh bằng khối màu quét. Chữ sans cực đậm chồng lên ảnh.",
  },
  {
    id: "khac-dong",
    name: "Tranh khắc đồng cổ",
    art: "Vintage copperplate engraving: fine cross-hatched and stippled linework in black ink, 19th-century encyclopedia illustration feel, scientific precision, off-white aged paper, ornamental borders and captions.",
    avoid: "no colour fills, no vector flatness, no 3D render, no modern photographic look",
    palette: "loose",
    motion:
      "Hình hiện bằng lớp nét đan DÀY DẦN như đang khắc. Kính lúp quét qua để phóng chi tiết. Chuyển cảnh bằng lật trang sách cổ. Chữ serif cổ điển kèm chú thích đánh số.",
  },
  {
    id: "editorial-toi-gian",
    name: "Tạp chí tối giản sang trọng",
    art: "Minimal luxury magazine editorial: refined still-life and product compositions, soft natural daylight, neutral beige, stone and linen textures, large calm negative space, high-end fashion and lifestyle photography.",
    avoid: "no clutter, no saturated neon, no cartoon, no glossy CGI look",
    palette: "brand",
    motion:
      "Rất CHẬM và ít: ảnh mờ dần lên, phóng cực nhẹ. Chữ serif lớn chạy giãn chữ, kèm dòng sans nhỏ. Bố cục lệch, chừa nhiều khoảng trắng. Chuyển cảnh mờ chồng dài, không hiệu ứng thừa.",
  },
];

const BUILTIN_IDS = new Set(BUILTIN_VIDEO_STYLES.map((s) => s.id));

/** Phong cách này có phải bản mặc định ship kèm repo không (để UI gắn nhãn + cho phép khôi phục) */
export function isBuiltinVideoStyle(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

/** Bản gốc của một phong cách mặc định - dùng cho nút "Khôi phục bản gốc" */
export function builtinVideoStyle(id: string): VideoStyle | null {
  const seed = BUILTIN_VIDEO_STYLES.find((s) => s.id === id);
  if (!seed) return null;
  const now = nowIso();
  return { ...seed, createdAt: now, updatedAt: now };
}

// Thư mục dữ liệu đặt cạnh assets/styles/ (Style Design) cho dễ tìm và dễ sao lưu.
// KHÔNG khai vào paths của config.ts: prompts.ts cũng tự dựng đường dẫn kiểu này,
// và giữ nó ở đây thì cả tính năng nằm gọn trong một file.
const videoStylesDir = path.join(paths.assetsDir, "video-styles");
const videoStylesFile = path.join(videoStylesDir, "video-styles.json");

/**
 * Chuẩn hóa một phong cách đọc từ đĩa (dữ liệu đĩa không tin kiểu).
 * Thiếu id hợp lệ -> null (bỏ khỏi danh sách, không làm hỏng cả file).
 */
function normVideoStyle(raw: unknown): VideoStyle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id.trim()) return null;
  const id = s.id.trim();
  const str = (key: string, fallback: string): string =>
    typeof s[key] === "string" && (s[key] as string).trim() ? (s[key] as string) : fallback;
  const now = nowIso();
  return {
    id,
    name: str("name", id),
    art: str("art", ""),
    avoid: str("avoid", ""),
    palette: s.palette === "loose" ? "loose" : "brand",
    motion: str("motion", ""),
    createdAt: str("createdAt", now),
    updatedAt: str("updatedAt", now),
  };
}

/**
 * Cache theo mtime+size của file: `videoStyleExists()` bị gọi cho MỌI project khi
 * web nạp danh sách, đọc lại và parse JSON từng lần là phí. File đổi (server tự
 * ghi hoặc người dùng sửa tay) thì stat đổi theo và cache tự hỏng.
 */
let cache: { key: string; data: VideoStylesFile } | null = null;

function cacheKey(): string | null {
  try {
    const st = fs.statSync(videoStylesFile);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return null; // chưa có file
  }
}

/** Gieo file lần đầu từ mảng hạt giống - repo mới clone vẫn có đủ phong cách mặc định */
function seedFile(): VideoStylesFile {
  const now = nowIso();
  const data: VideoStylesFile = {
    styles: BUILTIN_VIDEO_STYLES.map((s) => ({ ...s, createdAt: now, updatedAt: now })),
    removedBuiltins: [],
  };
  writeVideoStyles(data);
  return data;
}

/**
 * File có mà hỏng (sửa tay gõ sai, ghi dở) thì GIỮ LẠI một bản trước khi gieo
 * lại - gieo đè thẳng là mất sạch mọi phong cách người dùng đã tạo/sửa.
 */
function reseedCorrupt(): VideoStylesFile {
  const backup = `${videoStylesFile}.corrupt-${Date.now()}`;
  try {
    fs.copyFileSync(videoStylesFile, backup);
    console.warn(`[video-styles] file hỏng - đã lưu bản cũ ở ${backup} rồi gieo lại mặc định`);
  } catch {
    /* không chép được thì vẫn phải gieo lại để hệ thống chạy tiếp */
  }
  return seedFile();
}

/**
 * Đọc video-styles.json. Lần đầu chưa có file thì gieo từ BUILTIN_VIDEO_STYLES;
 * file đã có mà repo vừa thêm phong cách mặc định mới thì chèn bổ sung (trừ các
 * id người dùng đã xóa). File hỏng -> gieo lại, vì một danh sách rỗng sẽ làm
 * mọi project đang trỏ tới phong cách tụt hết về "AI tự quyết".
 */
export function readVideoStyles(): VideoStylesFile {
  const key = cacheKey();
  if (key === null) {
    cache = null;
    return seedFile();
  }
  if (cache && cache.key === key) return cache.data;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(videoStylesFile, "utf8"));
  } catch {
    cache = null;
    return reseedCorrupt();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    cache = null;
    return reseedCorrupt();
  }
  const r = parsed as Record<string, unknown>;
  const styles: VideoStyle[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.styles)) {
    for (const item of r.styles) {
      const s = normVideoStyle(item);
      if (s && !seen.has(s.id)) {
        seen.add(s.id);
        styles.push(s);
      }
    }
  }
  const removedBuiltins = Array.isArray(r.removedBuiltins)
    ? [...new Set(r.removedBuiltins.filter((x): x is string => typeof x === "string"))]
    : [];

  // Phong cách mặc định mới có trong bản cập nhật repo mà file chưa có -> chèn thêm
  const missing = BUILTIN_VIDEO_STYLES.filter(
    (s) => !seen.has(s.id) && !removedBuiltins.includes(s.id),
  );
  const data: VideoStylesFile = { styles, removedBuiltins };
  if (missing.length > 0) {
    const now = nowIso();
    for (const s of missing) data.styles.push({ ...s, createdAt: now, updatedAt: now });
    writeVideoStyles(data);
    return data;
  }
  cache = { key, data };
  return data;
}

export function writeVideoStyles(data: VideoStylesFile): void {
  ensureDir(videoStylesDir);
  // Ghi file tạm rồi rename: tắt máy giữa lúc ghi không để lại JSON cụt
  const tmp = `${videoStylesFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, videoStylesFile);
  const key = cacheKey();
  if (key !== null) cache = { key, data };
}

/**
 * null / không khớp = không áp phong cách nào, dựng theo skill + Style Design.
 *
 * Truyền vào đây phải là `activeVideoStyleId(brief)` chứ không phải
 * `brief.videoStyleId` thô - công tắc tắt thì id vẫn còn nguyên trong meta.
 */
export function getVideoStyle(id: string | null | undefined): VideoStyle | null {
  if (!id) return null;
  return readVideoStyles().styles.find((s) => s.id === id) ?? null;
}

export function videoStyleExists(id: string): boolean {
  return readVideoStyles().styles.some((s) => s.id === id);
}

// ------------------------------------------------------------- Đang dùng ở đâu

/** Loại "project" có brief - mỗi loại một thư mục con ở gốc repo */
export type VideoStyleUsageKind =
  | "video-project"
  | "text-to-video"
  | "auto-cut"
  | "translate-video";

export interface VideoStyleUsage {
  kind: VideoStyleUsageKind;
  id: string;
  name: string;
}

/**
 * Quét mọi project/phiên đang trỏ tới một phong cách.
 *
 * Đọc thẳng meta.json bằng fs chứ KHÔNG import meta.ts: meta.ts đã import file
 * này (videoStyleExists), thêm chiều ngược lại là vòng import.
 */
export function videoStyleUsage(styleId: string): VideoStyleUsage[] {
  const roots: Array<{ kind: VideoStyleUsageKind; dir: string }> = [
    { kind: "video-project", dir: paths.videoProjectsDir },
    { kind: "text-to-video", dir: paths.textToVideoDir },
    { kind: "auto-cut", dir: paths.autoCutDir },
    { kind: "translate-video", dir: paths.translateVideoDir },
  ];
  const out: VideoStyleUsage[] = [];
  for (const { kind, dir } of roots) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // thư mục chưa tồn tại - không phải lỗi
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(dir, entry.name, "meta.json"), "utf8"),
        ) as Record<string, unknown>;
        const brief = raw.brief as Record<string, unknown> | undefined;
        if (!brief || brief.videoStyleId !== styleId) continue;
        // Công tắc phong cách dựng đang TẮT = phong cách không có hiệu lực, đừng
        // đếm là "đang dùng" (xóa nhầm vì thấy con số là chuyện có thật). So với
        // `=== false` chứ không dùng falsy: brief cũ THIẾU hẳn field này, mà
        // thiếu + có id thì briefOf coi là đang bật (xem meta.ts).
        if (brief.videoStyleEnabled === false) continue;
        out.push({
          kind,
          id: entry.name,
          name: typeof raw.name === "string" && raw.name ? raw.name : entry.name,
        });
      } catch {
        /* không có meta.json hoặc JSON hỏng - bỏ qua */
      }
    }
  }
  return out;
}
