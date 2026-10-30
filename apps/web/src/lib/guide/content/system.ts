import type { GuideContent } from "@/lib/guide/types";

/**
 * Nhóm "Hệ thống" của bảng Hướng dẫn: Render Queue, Cấu hình, Kết nối,
 * tải file từ điện thoại và xử lý sự cố.
 *
 * Nhãn trong **...** phải khớp NGUYÊN VĂN với locales/vi.ts (bản vi) và
 * locales/en.ts (bản en) - đổi chữ trên giao diện thì sửa luôn ở đây.
 */

type Ids = "queue" | "config" | "connections" | "phone-upload" | "troubleshooting";

export const vi: Pick<GuideContent, Ids> = {
  queue: {
    title: "Render Queue",
    summary:
      "Nơi theo dõi mọi job render và xử lý của hệ thống: đang chờ, đang chạy, đã xong hay bị lỗi, kèm tiến độ và log đầy đủ. Mọi lần render, kể cả do AI tự chạy, đều đi qua hàng đợi này.",
    blocks: [
      {
        heading: "Các loại job",
        bullets: [
          "**Scene draft** / **Scene final** - render một scene HyperFrames (chữ chuyển động, phụ đề karaoke, đồ họa) thành MP4.",
          "**Lắp ráp draft** / **Lắp ráp final** - Remotion ghép các scene, footage, giọng đọc, sound effect và nhạc thành video hoàn chỉnh.",
          "**Tạo ảnh** - dựng ảnh của Images Project.",
          "**Cắt tự động** - chia một video dài thành nhiều project con (trang Auto cut videos).",
          "**Cắt tự động (đo)** - đo và cắt khoảng lặng, từ đệm, đoạn quay hỏng khỏi footage trước khi dựng.",
          "**Text to video** và **Dịch video** - các phiên của hai trang cùng tên.",
        ],
      },
      {
        heading: "Đọc bảng job",
        paragraphs: [
          "Bảng hiện 50 job gần nhất và tự cập nhật theo thời gian thực, không cần tải lại trang. Cột **Tiến độ** có thanh phần trăm kèm bước đang làm khi job đang chạy.",
          "Cột **Thời gian** là thời lượng job đã chạy; rê chuột vào để xem job được tạo lúc nào.",
        ],
        bullets: [
          "**Chờ** - đã xếp hàng, đợi tới lượt.",
          "**Đang chạy** - đang render, xem phần trăm ở cột **Tiến độ**.",
          "**Hoàn thành** - xong, file đã được ghi ra.",
          "**Lỗi** - dừng giữa chừng, bấm vào dòng đó để đọc log.",
          "**Đã hủy** - bạn đã tự hủy job này.",
        ],
      },
      {
        heading: "Lọc và tìm job",
        bullets: [
          "Các chip **Tất cả**, **Chờ**, **Đang chạy**, **Hoàn thành**, **Lỗi** lọc theo trạng thái và hiện sẵn số job mỗi loại. Chọn được nhiều chip cùng lúc.",
          "Job **Đã hủy** không có chip riêng - bấm **Tất cả** để thấy chúng.",
          "Ô tìm kiếm lọc theo tên project, tên scene hoặc id job.",
        ],
      },
      {
        heading: "Xem log của một job",
        steps: [
          "Bấm vào một dòng bất kỳ trong bảng.",
          "Khung **Log - <id job>** mở ra bên dưới, kèm trạng thái và thanh tiến độ của job đó.",
          "Log mới tự chảy xuống cuối; kéo lên đọc dòng cũ thì khung đứng yên cho bạn đọc.",
          "Bấm nút **Đóng log** ở góc khung khi xem xong.",
        ],
        tip: "Job bị **Lỗi** thì lý do thường nằm ở mấy dòng cuối cùng của log - đọc từ dưới lên trước.",
      },
      {
        heading: "Hủy và chạy lại",
        paragraphs: [
          "Job đang **Chờ** hoặc **Đang chạy** có nút **Hủy** ở cuối dòng. Hủy giữa chừng thì bản render dở bị bỏ, lần sau phải chạy lại từ đầu.",
          "Hàng đợi không có nút chạy lại. Muốn chạy lại thì vào trang project: **Render scene draft** và **Lắp ráp draft** nằm trong menu **Xem thêm**, còn **Render final** là nút riêng.",
          "Một lượt render gồm nhiều job nối nhau (ví dụ scene final rồi lắp ráp final): job đi trước lỗi thì job đi sau cũng báo **Lỗi** và chỉ đích danh job hỏng, để không lắp ra video bằng bản render cũ.",
        ],
      },
      {
        heading: "Bao nhiêu job chạy cùng lúc",
        paragraphs: [
          "Số job chạy song song đặt ở **Job render đồng thời (queue)** trong trang **Cấu hình**, từ 1 đến 4, mặc định là 2. Đổi là có hiệu lực ngay.",
          "Hai job của CÙNG một project không bao giờ chạy đồng thời, để khỏi ghi đè file của nhau - job sau sẽ đợi job trước xong. Song song chỉ xảy ra giữa các project khác nhau.",
        ],
        tip: "Máy yếu hoặc render hay chết giữa chừng thì để **Job render đồng thời (queue)** ở mức 1.",
      },
      {
        heading: "Luật draft trước, final sau",
        paragraphs: [
          "Hệ thống từ chối mọi job final khi project chưa có một lần **Lắp ráp draft** thành công. Draft render nhanh và rẻ, nên lỗi phải được bắt ở đó chứ không phải ở bản final chạy hàng chục phút.",
          "Ngoài ra, khi công tắc **Chặn render final khi QC chưa đạt** đang bật (mặc định), **Lắp ráp final** bị từ chối nếu bản draft chưa chạy QC, kết quả QC đã cũ, hoặc còn hạng mục không đạt.",
        ],
        steps: [
          "Render bản draft toàn bài và xem lại trên trang project.",
          "Trong card **QC tự động**, bấm **Chạy QC** (hoặc **Đo lại** nếu đã render lại).",
          "Sửa các hạng mục **Không đạt**, render draft và QC lại cho tới khi đạt.",
          "Bấm **Render final** - video thành phẩm được ghi vào thư mục outputs/.",
        ],
      },
      {
        warning:
          "Tắt hệ thống hoặc khởi động lại server khi còn job thì mọi job đang chạy và đang chờ đều chuyển sang **Lỗi** (bước ghi \"Server khởi động lại khi job đang chạy\"). Chờ hàng đợi trống rồi hãy tắt, hoặc chạy lại các job đó sau.",
      },
    ],
  },

  config: {
    title: "Cấu hình",
    summary:
      "Kiểm tra máy đã đủ công cụ chưa, chỉnh tốc độ render cho vừa sức máy (GPU, số luồng, số job song song), cổng QC, chi phí phiên AI và kênh cập nhật. Mọi thay đổi lưu ngay, không cần khởi động lại.",
    blocks: [
      {
        heading: "Lưu và khôi phục",
        paragraphs: [
          "Bấm chọn là lưu ngay, góc card hiện **Đã áp dụng - hiệu lực ngay, không cần restart**. Thay đổi áp cho các job chạy sau đó; job đang chạy vẫn giữ cấu hình cũ.",
          "Đặt lung tung quá thì bấm **Khôi phục mặc định** ở đầu card **Cài đặt render** để quay về mức gốc.",
        ],
        tip: "Mốc có dấu ★ là mức khuyên dùng, tính theo CPU và RAM thật của chính máy này.",
      },
      {
        heading: "Kiểm tra hệ thống",
        paragraphs: [
          "Card trên cùng dò mọi thứ pipeline cần, đúng danh sách mà script khởi động kiểm tra. Đủ hết thì card thu gọn thành badge **Đầy đủ**; bấm **Xem chi tiết** để mở ra.",
          "Bốn mục bắt buộc là Node.js, FFmpeg, Google Chrome và **Đăng nhập Claude** - thiếu một trong số đó là không dựng video được. Các mục còn lại là tính năng phụ, thiếu thì chỉ tính năng đó chưa dùng được.",
        ],
        steps: [
          "Mục thiếu có nút **Cài tự động** (kèm dung lượng tải) thì bấm là xong.",
          "Mục không tự cài được thì có lệnh sẵn - bấm **Chép lệnh** rồi dán vào terminal, hoặc bấm **Mở trang xử lý** / **Hướng dẫn**.",
          "Cài xong bấm **Kiểm tra lại** ở góc card để dò lại.",
        ],
      },
      {
        heading: "Các mục phụ trong Kiểm tra hệ thống",
        bullets: [
          "**faster-whisper** - tạo phụ đề tự động từ giọng nói, khoảng 300 MB.",
          "**VieNeu-TTS** - giọng đọc tiếng Việt chạy trên máy, miễn phí; **PyTorch** (2-3 GB) chỉ cần nếu muốn nhân bản giọng của bạn.",
          "**Model cache** - model AI đang nằm ngoài dự án thì nút cài sẽ chuyển chúng vào .runtime/models, không phải tải lại.",
          "**Gateway tạo ảnh** - khoảng 80 MB, để tạo ảnh bằng tài khoản ChatGPT / Gemini web. Cần Python 3.13 hoặc 3.14, mã AGPL-3.0 chạy tiến trình riêng.",
          "**Khóa API Gemini** - tạo ảnh nền và ảnh minh họa; dán khóa ở trang **Kết nối**.",
          "**cloudflared** - mở dashboard qua 4G/5G, dùng cho tải file từ điện thoại khi không cùng WiFi.",
          "Hai dòng chỉ để biết: dung lượng thư mục .runtime/ và GPU phát hiện được.",
        ],
      },
      {
        heading: "Phần cứng và số luồng",
        paragraphs: [
          "Card **Phần cứng phát hiện được** đọc CPU, RAM, GPU của máy. Nhãn NVENC hoặc VideoToolbox nghĩa là máy có bộ mã hóa video bằng GPU; nhãn **Chỉ CPU** nghĩa là không có, và hai công tắc encode GPU sẽ bị khóa.",
          "**Worker Chrome (HyperFrames)** là số trình duyệt ẩn cùng dựng hình một scene; **Remotion concurrency** là số khung hình Remotion dựng song song khi lắp ráp. **Auto** để hệ thống tự chọn.",
        ],
        warning:
          "Số luồng càng cao càng nhanh nhưng càng ăn RAM. Đặt quá sức máy thì render dễ đứng hoặc chết giữa chừng - không chắc thì chọn mốc có ★.",
      },
      {
        heading: "Công tắc GPU",
        bullets: [
          "**GPU cho capture (browser)** - bật sẵn. Chrome dùng GPU để dựng hình cho cả HyperFrames lẫn Remotion; tắt đi nếu gặp lỗi render lạ.",
          "**Encode GPU cho bản draft** - bật sẵn. Draft chỉ để duyệt nên ưu tiên tốc độ.",
          "**Encode GPU cho bản FINAL** - tắt sẵn. GPU nhanh hơn nhiều, nhưng cùng dung lượng thì CPU (libx264) cho hình nhỉnh hơn; bật nếu bạn cần tốc độ hơn chút chất lượng cuối.",
          "**Fast capture (macOS)** - tắt sẵn. Tăng khoảng gấp đôi tốc độ chụp hình, chỉ thật sự có tác dụng trên macOS có GPU; máy khác bật cũng vô hại.",
        ],
        paragraphs: [
          "Bước mã hóa video lắp ráp cuối cùng luôn chạy trên CPU, không công tắc nào đổi được. Bóc lời bằng faster-whisper tự dùng GPU NVIDIA nếu có, không thì chạy CPU.",
        ],
      },
      {
        heading: "Hàng đợi, draft và cổng QC",
        bullets: [
          "**Job render đồng thời (queue)** - 1 đến 4 job chạy song song giữa các project khác nhau, mặc định 2. Máy yếu để 1.",
          "**Draft fps** - **Giữ nguyên**, 15 fps hoặc 24 fps. Draft 15 fps nhanh gần gấp đôi, chỉ để duyệt nhịp; bản final luôn đúng fps của project.",
          "**Chặn render final khi QC chưa đạt** - bật sẵn. Tắt đi thì AI có thể xuất final dù còn lỗi đo được như âm lượng lệch, frame đen hay chữ bị giao diện nền tảng che.",
        ],
      },
      {
        heading: "Chi phí phiên AI",
        bullets: [
          "**Số lần AI được tự làm lại một video** - mặc định 4. Phiên kết thúc mà chưa có video final thì hệ thống cho AI chạy lại, tối đa bấy nhiêu lần; có tiến bộ thì đếm lại từ đầu.",
          "**Trần số bước AI được làm trong một lần** - mặc định 300. Một bước là một lần AI gọi công cụ rồi đọc kết quả; chạm trần là dừng, phần đã dựng vẫn giữ trong project.",
        ],
        tip: "Mỗi lần làm lại tốn gần bằng một video mới, nên để 3-4 lần là vừa. Đừng hạ trần bước xuống dưới khoảng 50, video phức tạp sẽ không kịp xong.",
      },
      {
        heading: "Kênh cập nhật",
        bullets: [
          "**Bản chính thức (release)** - mặc định, có ★. Chỉ báo có bản mới khi nhóm phát triển đã phát hành một bản chính thức. Ổn định, nên dùng.",
          "**Bản mới nhất (main)** - nhận mọi thay đổi vừa đẩy lên nhánh main. Có bản sửa lỗi sớm hơn nhưng có thể chưa ổn định.",
        ],
        paragraphs: [
          "Khi kho code chưa có bản phát hành nào, hệ thống tạm so với code mới nhất trên nhánh main và báo rõ điều đó trong cửa sổ cập nhật.",
        ],
      },
      {
        heading: "Cập nhật hệ thống",
        steps: [
          "Nhìn chip ở cuối thanh bên trái: **Bản mới nhất**, **Có bản mới** hoặc **Lỗi kiểm tra**. Hệ thống tự kiểm tra mỗi 5 phút.",
          "Bấm vào chip để mở cửa sổ **Cập nhật hệ thống**: xem phiên bản **Đang chạy**, **Bản mới** và mục **Có gì mới**.",
          "Bấm **Cập nhật ngay** (hoặc **Để sau**). Hệ thống chạy lần lượt 4 bước: **Tải bản mới**, **Dừng hệ thống**, **Cài đặt gói**, **Khởi động lại** - mất khoảng 1-3 phút.",
          "Thấy **Cập nhật thành công** thì trang tự tải lại; bấm **Tải lại ngay** nếu không muốn chờ.",
        ],
        warning:
          "Hệ thống từ chối cập nhật khi còn job đang chạy hoặc đang chờ trong Render Queue. Trong lúc cập nhật đừng tắt máy và đừng đóng cửa sổ; nếu báo **Cập nhật chưa hoàn tất** thì bản cũ vẫn chạy bình thường, log đầy đủ ở start/update.log.",
      },
    ],
  },

  connections: {
    title: "Kết nối",
    summary:
      "Khai báo tài khoản và khóa API cho các dịch vụ AI: Claude để dựng video và chat, Gemini và các gateway web để tạo ảnh, cùng Cloudflare Tunnel để mở dashboard ra Internet. Mọi thay đổi có hiệu lực ngay, không cần khởi động lại.",
    blocks: [
      {
        heading: "Đọc một card nhà cung cấp",
        paragraphs: [
          "Mỗi nhà cung cấp là một card, góc phải ghi trạng thái: **Đã kết nối · Subscription**, **Đã kết nối · API key** hoặc **Chưa kết nối**. Các chip dưới tên cho biết nó lo việc gì, ví dụ **Edit video**, **Chat**, **Tạo ảnh**.",
          "Khóa API bạn dán vào được ghi vào file .env ở thư mục gốc của dự án, trên chính máy này. Ô hiển thị chỉ để lộ vài ký tự cuối.",
        ],
      },
      {
        heading: "Claude - bắt buộc để dựng video",
        paragraphs: [
          "Claude là AI đạo diễn: không có Claude thì không edit video bằng AI và không chat được. Có hai cách kết nối, hệ thống ưu tiên cách thứ nhất.",
        ],
        steps: [
          "Cách khuyên dùng - dùng gói subscription: mở terminal trên máy chạy hệ thống, gõ claude, rồi gõ /login và xác nhận trong trình duyệt.",
          "Mở lại trang **Kết nối**: card Claude (Anthropic) hiện **Đã kết nối · Subscription**, không tốn phí API.",
          "Chỉ khi không đăng nhập được: lấy khóa qua **Lấy key tại đây**, dán vào ô API key (ANTHROPIC_API_KEY) và bấm **Lưu key**. Cách này tính tiền theo lượng dùng.",
        ],
      },
      {
        heading: "Thêm, đổi hoặc xóa khóa API",
        steps: [
          "Bấm **Lấy key tại đây** trong card để mở trang lấy khóa của hãng.",
          "Dán khóa vào ô API key (có thể bấm **Hiện key** để soát lại), rồi bấm **Lưu key** hoặc nhấn Enter.",
          "Hệ thống lưu xong tự chạy **Kiểm tra kết nối** và báo kết quả ngay dưới nút.",
          "Muốn thay khóa thì bấm **Đổi key**; muốn bỏ hẳn thì bấm **Xóa key** và xác nhận.",
        ],
        tip: "Dán nhầm cả dòng kiểu GEMINI_API_KEY=AIza... hoặc dính dấu nháy cũng không sao - hệ thống tự cắt phần thừa.",
      },
      {
        heading: "Các nhà cung cấp khác",
        bullets: [
          "**Gemini (Google)** - tạo ảnh nền cho Images Project và ảnh minh họa trong video, tính tiền theo lượt ảnh (khoảng $0.05 mỗi ảnh 1K). Gói Antigravity không thay được khóa API.",
          "**OpenAI (ChatGPT)** - hiện pipeline chưa dùng tới, chỉ lưu sẵn khóa cho tính năng sau này. Đăng nhập ChatGPT qua Codex CLI không dùng được thay khóa.",
          "**Soniox** - bóc lời có phân biệt từng người nói (khoảng $0.10 mỗi giờ), cần khi lồng tiếng để gán đúng giọng nam/nữ. Không có khóa thì vẫn bóc lời được bằng faster-whisper trên máy, miễn phí nhưng không phân vai.",
        ],
      },
      {
        heading: "Tạo ảnh bằng tài khoản web (gateway)",
        paragraphs: [
          "Hai card **ChatGPT (tài khoản web)** và **Gemini (cookie web)** cho phép tạo ảnh bằng lượt có sẵn trong tài khoản của bạn thay vì trả tiền API. Cả hai chạy qua một gateway riêng trên máy.",
          "Lần đầu bấm **Cài gateway** - cài một lần cho cả hai card, mất vài phút và cần Python 3.13 hoặc 3.14. Cũng cài được từ mục **Gateway tạo ảnh** trong trang **Cấu hình**.",
        ],
        warning:
          "Dùng tài khoản web theo cách không chính thức có thể vi phạm điều khoản của nhà cung cấp và tài khoản có thể bị giới hạn - nên dùng tài khoản phụ. Token và cookie chỉ lưu trên máy này.",
      },
      {
        heading: "Thêm tài khoản ChatGPT",
        steps: [
          "Đăng nhập ChatGPT trên trình duyệt.",
          "Mở trang chatgpt.com/api/auth/session trong tab mới (link có sẵn trong card).",
          "Chép toàn bộ nội dung trang đó, dán vào ô **Phiên đăng nhập (JSON hoặc accessToken)** rồi bấm **Thêm tài khoản**.",
          "Nạp được nhiều tài khoản; tài khoản này hết lượt thì gateway dùng tài khoản kế tiếp. Danh sách hiện số lượt còn lại và hạn của từng tài khoản.",
        ],
        tip: "Token ChatGPT thường hết hạn sau vài ngày. Thấy **Sắp hết hạn** thì mở lại trang session và dán phiên mới.",
      },
      {
        heading: "Lưu cookie Gemini web",
        steps: [
          "Đăng nhập Google trên gemini.google.com.",
          "Mở DevTools (F12) → Application → Cookies → https://gemini.google.com.",
          "Chọn **Từng giá trị** để dán __Secure-1PSID và __Secure-1PSIDTS, hoặc chọn **Dán cả chuỗi Cookie** để hệ thống tự tách.",
          "Bấm **Lưu cookie**. Cookie tự làm mới khi gateway đang chạy; đăng xuất Google trên trình duyệt có thể làm nó mất hiệu lực.",
        ],
      },
      {
        heading: "Tạo ảnh mặc định",
        paragraphs: [
          "Card **Tạo ảnh mặc định** chọn nhà cung cấp dùng khi ô model để Mặc định hoặc Tự động - cho ảnh minh họa, Images Project và cảnh trám trong trình chỉnh sửa. Từng project vẫn chọn riêng được.",
        ],
        bullets: [
          "**Tự động** - dùng nhà cung cấp đầu tiên đã cấu hình, lỗi thì chuyển sang cái tiếp theo.",
          "**Gemini API** - ổn định nhất, tính tiền theo lượt.",
          "**ChatGPT (web)** và **Gemini (web)** - dùng lượt trong tài khoản, rẻ hơn nhưng chậm hơn và có thể bị giới hạn.",
          "**Nghỉ giữa hai ảnh (gateway web)** - số giây nghỉ giữa hai ảnh khi vẽ bằng tài khoản web, để tài khoản không bị khóa tạm. Nhập số rồi bấm **Lưu**.",
        ],
      },
      {
        heading: "Cloudflare Tunnel",
        paragraphs: [
          "Card cuối trang mở dashboard ra Internet để dùng qua 4G/5G. Bấm **Bật tunnel** / **Tắt tunnel**; để trống **Domain riêng (TUNNEL_DOMAIN)** thì hệ thống dùng **Quick Tunnel** với địa chỉ ngẫu nhiên.",
          "Chi tiết cách dùng cho việc gửi file từ điện thoại nằm ở mục Tải file từ điện thoại.",
        ],
        warning:
          "Dashboard chưa có đăng nhập: ai có link tunnel đều vào được. Không chia sẻ link, và tắt tunnel ngay khi dùng xong.",
      },
    ],
  },

  "phone-upload": {
    title: "Tải file từ điện thoại",
    summary:
      "Quét mã QR để gửi video và ảnh từ điện thoại thẳng vào một project, không cần cáp hay ứng dụng chuyển file. Cùng WiFi là dùng được ngay; ở xa thì đi qua Cloudflare Tunnel.",
    blocks: [
      {
        heading: "Gửi file khi cùng WiFi",
        steps: [
          "Mở trang project, tìm card **Nguồn & Asset** và bấm **Kết nối điện thoại**.",
          "Máy có nhiều mạng thì chọn đúng địa chỉ trong ô **Mạng (IP máy chủ)** - thường là địa chỉ bắt đầu bằng 192.168.",
          "Dùng camera điện thoại quét mã QR. Trang **Tải file vào project** mở ra trên điện thoại.",
          "Bấm **Chọn video / ảnh** để lấy file có sẵn, hoặc **Quay video / chụp ảnh mới** để quay ngay.",
          "File tải xong vào thẳng card **Nguồn & Asset** của project trên máy tính.",
        ],
      },
      {
        heading: "Lần đầu trên Windows",
        paragraphs: [
          "Điện thoại phải cùng WiFi với máy chạy hệ thống. Lần đầu Windows hỏi về tường lửa (firewall) thì chọn **Allow**.",
          "Script khởi động tự mở cổng 6868 và 6869 trên tường lửa nếu được chạy với quyền quản trị.",
        ],
        tip: "Điện thoại không mở được trang: kiểm tra hai máy cùng một WiFi, thử địa chỉ khác trong ô **Mạng (IP máy chủ)**, và xem tường lửa đã cho phép chưa.",
      },
      {
        warning:
          "Giữ màn hình điện thoại sáng khi đang tải file lớn - tắt màn hình là trình duyệt ngừng gửi. Đợi tới khi trang báo tải xong mới khóa máy.",
      },
      {
        heading: "Link chỉ sống khi cửa sổ QR còn mở",
        paragraphs: [
          "Mỗi lần mở cửa sổ **Kết nối điện thoại** là một link mới mang mã riêng. Đóng cửa sổ là link bị khóa ngay, điện thoại sẽ báo \"Link đã hết hạn - mở lại mã QR trên máy tính.\"",
          "Cần gửi tiếp thì mở lại cửa sổ trên máy tính và quét mã mới.",
        ],
      },
      {
        heading: "Gửi qua 4G/5G (không cùng WiFi)",
        steps: [
          "Máy chạy hệ thống cần có cloudflared - cài bằng nút **Cài tự động** ở mục cloudflared trong trang **Cấu hình**.",
          "Trong cửa sổ **Kết nối điện thoại**, bấm **Bật Internet (Cloudflare Tunnel)** ở cuối cửa sổ. Mã QR tự đổi sang link Internet sau vài giây.",
          "Nếu tunnel đã chạy sẵn, bấm **Dùng link Internet** để đổi mã QR sang đường Internet.",
          "Gửi xong bấm **Tắt Internet**, hoặc đóng cửa sổ - tunnel bật từ chính cửa sổ này sẽ tự tắt theo.",
        ],
        tip: "Tunnel bật từ trang **Kết nối** hoặc bằng script thì vẫn chạy sau khi đóng cửa sổ QR, cho tới khi bạn tự tắt.",
      },
      {
        heading: "Quick Tunnel hay domain riêng",
        bullets: [
          "Không khai domain: hệ thống dùng Quick Tunnel với địa chỉ ngẫu nhiên dạng xxx.trycloudflare.com, ĐỔI mỗi lần bật lại.",
          "Muốn địa chỉ cố định: điền domain vào ô **Domain riêng (TUNNEL_DOMAIN)** ở trang **Kết nối**, hoặc thêm TUNNEL_DOMAIN=<domain-của-bạn> vào file .env. Mã QR khi đó dùng https://<domain>/m/<project>.",
          "Domain riêng cần làm trước một lần trên máy: cloudflared tunnel login, create và route dns.",
        ],
      },
      {
        heading: "Mở tunnel bằng script",
        bullets: [
          "Windows: nhấp đúp start\\tunnel.bat",
          "macOS: nhấp đúp start/tunnel.command",
          "Linux: chạy ./start/tunnel.sh",
        ],
        paragraphs: [
          "Có TUNNEL_DOMAIN trong .env thì script chạy tunnel theo domain đó, không có thì chạy Quick Tunnel.",
        ],
      },
      {
        warning:
          "Dashboard chưa có đăng nhập: ai có link tunnel là vào được toàn bộ dashboard. Không bao giờ chia sẻ link công khai, chỉ mở public khi đã bọc thêm Cloudflare Access, và tắt tunnel ngay khi dùng xong.",
      },
    ],
  },

  troubleshooting: {
    title: "Xử lý sự cố",
    summary:
      "Các lỗi hay gặp và cách xử lý: khởi động, dừng, cập nhật hệ thống, thiếu công cụ, render lỗi, mất dấu tiếng Việt và phiên AI bị gián đoạn.",
    blocks: [
      {
        heading: "Khởi động, dừng và cập nhật",
        bullets: [
          "Khởi động - Windows: start\\start.bat · macOS: start/start.command · Linux: ./start/start.sh",
          "Dừng - Windows: start\\stop.bat (hoặc đóng cửa sổ \"AI Edit Video - LOG\") · macOS: start/stop.command · Linux: ./start/stop.sh",
          "Cập nhật thủ công - Windows: update\\update.bat · macOS: update/update.command · Linux: bash update/update.sh",
        ],
        paragraphs: [
          "Script khởi động tự kiểm tra máy, cài gói lần đầu, build, tạo file .env, chạy hệ thống rồi mở http://localhost:6868. Hệ thống đang chạy sẵn thì script chỉ mở lại trình duyệt; chạy dở dang thì nó tự dọn và khởi động lại.",
          "Bình thường bạn không cần script cập nhật - chip cập nhật ở cuối thanh bên trái làm việc đó. Chỉ dùng script khi giao diện không mở được.",
        ],
      },
      {
        heading: "macOS chặn file hoặc file không chạy",
        bullets: [
          "macOS báo file đến từ nhà phát triển không xác định: chuột phải vào file → **Open** → **Open**.",
          "File .sh không nhấp đúp được trên macOS - hãy dùng file .command.",
          "Tải bản ZIP thay vì git clone thì chạy một lần: chmod +x start/*.sh start/*.command update/*.sh update/*.command",
          "Trên macOS và Linux, log của hệ thống nằm ở start/server.log; trên Windows là cửa sổ \"AI Edit Video - LOG\".",
        ],
      },
      {
        heading: "Chấm trạng thái backend trên thanh trên cùng",
        bullets: [
          "Chấm xanh, **Backend hoạt động** - mọi thứ bình thường.",
          "Chấm đỏ, **Không kết nối được backend** - phần xử lý phía sau đã tắt hoặc bị treo. Chạy lại script khởi động; script tự dọn và bật lại.",
        ],
        paragraphs: [
          "Chấm tự kiểm tra lại mỗi 30 giây. Màn hình hẹp chỉ hiện chấm, rê chuột vào để đọc trạng thái.",
        ],
      },
      {
        heading: "Thiếu công cụ hoặc chưa đăng nhập Claude",
        steps: [
          "Mở **Cấu hình** và xem card **Kiểm tra hệ thống**. Mục bắt buộc thiếu sẽ có badge đỏ và đứng đầu danh sách.",
          "Bấm **Cài tự động** với FFmpeg, Google Chrome, Claude Code; Node.js thì tải ở nodejs.org (cần bản 22 trở lên).",
          "**Đăng nhập Claude** không tự làm thay được: mở terminal, gõ claude rồi /login - hoặc dán ANTHROPIC_API_KEY ở trang **Kết nối**.",
          "Bấm **Kiểm tra lại**. Muốn làm từ terminal thì chạy node start/doctor.mjs --fix ở thư mục gốc.",
        ],
        tip: "Thiếu công cụ không chặn hệ thống khởi động - dashboard vẫn lên để bạn sửa ngay trên giao diện.",
      },
      {
        heading: "Python quá cũ hoặc quá mới",
        paragraphs: [
          "Phụ đề (faster-whisper) và giọng đọc VieNeu-TTS cần Python 3.11 đến 3.14. Gateway tạo ảnh cần Python 3.13 hoặc 3.14. Python 3.15 trở lên hiện chưa dùng được vì vài gói chưa hỗ trợ.",
        ],
        bullets: [
          "macOS: chạy brew install python@3.13. Python 3.9 có sẵn của macOS quá cũ, còn brew install python có thể ra bản quá mới.",
          "Windows và Linux: tải Python 3.13 tại python.org/downloads.",
          "Cài xong bấm lại **Cài tự động** ở mục đó - môi trường Python cũ dựng bằng bản không hợp lệ sẽ được xóa và dựng lại tự động.",
        ],
      },
      {
        heading: "Render bị lỗi",
        steps: [
          "Mở **Render Queue**, bấm chip **Lỗi** rồi bấm vào job hỏng để đọc log - lý do thường nằm ở mấy dòng cuối.",
          "Sửa nguyên nhân (thiếu file, scene lỗi...) hoặc nhờ AI sửa trong khung chat của project.",
          "Chạy lại bản draft từ trang project (**Render scene draft** hoặc **Lắp ráp draft** trong menu **Xem thêm**), xem lại rồi mới render final.",
        ],
        bullets: [
          "Job final bị từ chối ngay: project chưa có **Lắp ráp draft** thành công, hoặc QC chưa chạy / chưa đạt trên bản draft hiện tại.",
          "Render hay đứng hoặc chết giữa chừng: trong **Cấu hình** hạ **Worker Chrome (HyperFrames)** và **Remotion concurrency** về mốc có ★, đặt **Job render đồng thời (queue)** về 1, hoặc tắt **GPU cho capture (browser)**.",
          "Job báo \"Server khởi động lại khi job đang chạy\": hệ thống bị tắt giữa chừng - chỉ cần chạy lại.",
        ],
      },
      {
        heading: "Chữ tiếng Việt bị mất dấu hoặc lệch dấu",
        bullets: [
          "Dùng font có trong Style Design: gõ tên font Google Fonts là hệ thống tự tải bản đủ bộ dấu tiếng Việt. Font lạ máy không có thì trình duyệt thay font khác, và thứ vỡ đầu tiên luôn là dấu.",
          "Thấy lỗi trong bản draft: ở card **Duyệt bản draft**, ghim ghi chú đúng giây bị lỗi (ví dụ \"chữ ở 00:12 bị cụt dấu\") rồi bấm **Gửi cho AI sửa**. AI đã có sẵn cách sửa lỗi chữ gradient mất dấu trong skill.",
          "Sau khi sửa, render lại bản draft và soi kỹ chỗ đó trước khi render final.",
        ],
      },
      {
        heading: "Phiên AI bị gián đoạn",
        paragraphs: [
          "Phiên AI bị ngắt (server khởi động lại, lỗi mạng...) hiện trạng thái **Tạm dừng**. Khi công tắc **Tự chạy tiếp** trong khung chat đang bật, phiên tự chạy tiếp khoảng 15 giây sau khi hệ thống lên lại, hoặc vài giây sau khi gặp lỗi.",
          "Phiên tự dừng hẳn nếu chạy lại nhiều lần liên tiếp mà không có tiến bộ (phiên dựng video theo **Số lần AI được tự làm lại một video** trong **Cấu hình**, phiên chat thường 3 lần). Khi đó gửi một tin nhắn để AI làm tiếp.",
        ],
      },
      {
        heading: "Video thành phẩm nằm ở đâu",
        bullets: [
          "Mọi video lắp ráp nằm trong thư mục outputs/ ở thư mục gốc của dự án.",
          "Bản draft: outputs/<tên-project>-draft.mp4 - mỗi lần render draft sẽ ghi đè bản trước.",
          "Bản final: outputs/<tên-project>-v1.mp4, -v2.mp4... - mỗi lần render final thêm một phiên bản mới, không ghi đè.",
          "Cũng xem và tải được ngay trên trang project hoặc trang **Assets**.",
        ],
      },
      {
        heading: "Dùng chung công cụ giữa nhiều bản cài",
        paragraphs: [
          "Mọi thứ nặng (môi trường Python, model AI vài GB, ffmpeg/cloudflared tải riêng, tài khoản gateway) nằm trong .runtime/ của từng thư mục. Clone thêm một bản là tải lại từ đầu, trừ khi bạn trỏ chúng về một chỗ.",
        ],
        steps: [
          "Thêm dòng AIEV_RUNTIME_DIR=<đường-dẫn> vào file .env của TỪNG bản cài (đường dẫn tuyệt đối, hoặc tương đối tính từ thư mục gốc).",
          "Cách đơn giản nhất: trỏ thẳng vào .runtime của bản đang chạy, ví dụ AIEV_RUNTIME_DIR=D:\\AIEV\\.runtime - không phải chuyển gì, chỉ đừng xóa bản cũ.",
          "Muốn chuyển .runtime sang chỗ trung lập: chuyển xong thì XÓA hai thư mục venv và venv-gateway trong đó, rồi chạy script khởi động một lần để dựng lại. Model không phải tải lại.",
        ],
        warning:
          "Không chạy hai bản cài cùng lúc trên một .runtime. Giọng đã nhân bản nằm ở assets/voices/, không đi theo .runtime - chép thư mục đó sang bằng tay.",
      },
      {
        heading: "Cập nhật không xong",
        paragraphs: [
          "Cửa sổ báo **Cập nhật chưa hoàn tất** thì bản cũ vẫn chạy bình thường, vì script tải code mới trước rồi mới tắt hệ thống. Log đầy đủ ở start/update.log.",
          "Báo \"Đang có job render - chờ xong rồi cập nhật.\": chờ Render Queue trống (không còn job **Đang chạy** hay **Chờ**) rồi bấm lại.",
        ],
      },
    ],
  },
};

export const en: Pick<GuideContent, Ids> = {
  queue: {
    title: "Render Queue",
    summary:
      "Track every render and processing job in the system - waiting, running, finished or failed - with live progress and the full log. Every render goes through this queue, including the ones the AI starts on its own.",
    blocks: [
      {
        heading: "Job types",
        bullets: [
          "**Scene draft** / **Scene final** - renders one HyperFrames scene (kinetic text, karaoke subtitles, motion graphics) to MP4.",
          "**Assemble draft** / **Assemble final** - Remotion stitches the scenes, footage, voice, sound effects and music into the finished video.",
          "**Image generation** - builds an Images Project image.",
          "**Auto cut** - splits a long video into several child projects (the Auto cut videos page).",
          "**Auto-trim** - measures and removes silences, fillers and bad takes from the footage before editing.",
          "**Text to video** and **Translate video** - sessions from the pages of the same name.",
        ],
      },
      {
        heading: "Reading the job table",
        paragraphs: [
          "The table shows the 50 most recent jobs and updates live, no reload needed. While a job runs, the **Progress** column shows a percentage bar plus the current step.",
          "The **Time** column is how long the job ran; hover it to see when the job was created.",
        ],
        bullets: [
          "**Queued** - waiting for its turn.",
          "**Running** - rendering now; watch the **Progress** column.",
          "**Done** - finished and the file has been written.",
          "**Failed** - stopped partway; click the row to read the log.",
          "**Canceled** - you canceled it yourself.",
        ],
      },
      {
        heading: "Filtering and searching",
        bullets: [
          "The **All**, **Queued**, **Running**, **Done** and **Failed** chips filter by status and show how many jobs are in each. You can pick several at once.",
          "**Canceled** jobs have no chip of their own - click **All** to see them.",
          "The search box matches project name, scene name or job id.",
        ],
      },
      {
        heading: "Reading a job's log",
        steps: [
          "Click any row in the table.",
          "A **Log - <job id>** panel opens below, with that job's status and progress bar.",
          "New lines scroll in at the bottom; scroll up to read older lines and the panel stays put.",
          "Click **Close log** in the panel corner when you are done.",
        ],
        tip: "When a job is **Failed**, the reason is usually in the last few lines - read the log from the bottom up.",
      },
      {
        heading: "Canceling and running again",
        paragraphs: [
          "**Queued** and **Running** jobs have a **Cancel** button at the end of the row. Cancel midway and the partial render is thrown away, so the next run starts from scratch.",
          "There is no retry button in the queue. To run something again, go to the project page: **Render scene draft** and **Assemble draft** are in the **More** menu, and **Render final** has its own button.",
          "Some renders are a chain of jobs (for example a scene final followed by an assemble final). If an earlier job fails, the later one is marked **Failed** too and names the job that broke, so you never get a video assembled from stale renders.",
        ],
      },
      {
        heading: "How many jobs run at once",
        paragraphs: [
          "**Concurrent render jobs (queue)** on the **Settings** page sets how many jobs run in parallel - 1 to 4, default 2. Changes apply immediately.",
          "Two jobs of the SAME project never run at the same time, so they cannot overwrite each other's files - the second one waits. Parallel runs only happen across different projects.",
        ],
        tip: "On a slow machine, or if renders keep dying halfway, set **Concurrent render jobs (queue)** to 1.",
      },
      {
        heading: "Draft first, final second",
        paragraphs: [
          "Any final job is refused until the project has at least one successful **Assemble draft**. Drafts are quick and cheap, so problems should be caught there - not in a final that takes tens of minutes.",
          "On top of that, while **Block the final render while QC has not passed** is on (the default), **Assemble final** is refused if the current draft has not been through QC, the QC result is out of date, or any check failed.",
        ],
        steps: [
          "Render the full draft and watch it on the project page.",
          "In the **Automatic QC** card, click **Run QC** (or **Re-run** after a new render).",
          "Fix anything that failed, render the draft and run QC again until it passes.",
          "Click **Render final** - the finished video is written to the outputs/ folder.",
        ],
      },
      {
        warning:
          "If you stop the system or the server restarts while jobs are in the queue, every running and queued job is marked **Failed** (the step reads that the server restarted). Wait until the queue is empty before shutting down, or run those jobs again afterwards.",
      },
    ],
  },

  config: {
    title: "Settings",
    summary:
      "Check that the machine has every tool it needs, tune render speed to your hardware (GPU, thread counts, parallel jobs), and set the QC gate, AI session costs and update channel. Every change saves instantly, no restart needed.",
    blocks: [
      {
        heading: "Saving and resetting",
        paragraphs: [
          "Each click saves right away and the card shows **Applied - effective immediately, no restart needed**. Changes apply to jobs that start afterwards; a job already running keeps its old settings.",
          "If things get out of hand, **Restore defaults** at the top of the **Render settings** card brings everything back.",
        ],
        tip: "Options marked ★ are the recommended values, worked out from this machine's actual CPU and RAM.",
      },
      {
        heading: "System check",
        paragraphs: [
          "The top card checks everything the pipeline needs - the same list the start script checks. When nothing is missing it collapses to an **All set** badge; click **Show details** to expand it.",
          "Four items are required: Node.js, FFmpeg, Google Chrome and **Claude login** - without any of them you cannot edit video. Everything else is optional and only affects its own feature.",
        ],
        steps: [
          "If a missing item has an **Install** button (with the download size), click it and you are done.",
          "If it cannot be installed automatically, click **Copy command** and paste it into a terminal, or use **Open page** / **Guide**.",
          "When the install finishes, click **Check again** in the card corner.",
        ],
      },
      {
        heading: "Optional items in the System check",
        bullets: [
          "**faster-whisper** - automatic subtitles from speech, about 300 MB.",
          "**VieNeu-TTS** - free on-device Vietnamese narration; **PyTorch** (2-3 GB) is only needed to clone your own voice.",
          "**Model cache** - if AI models already sit outside the project, the install button moves them into .runtime/models instead of downloading them again.",
          "**Image gateway** - about 80 MB, lets you generate images with a ChatGPT or Gemini web account. Needs Python 3.13 or 3.14; the AGPL-3.0 code runs as a separate process.",
          "**Gemini API key** - backgrounds and illustrations; paste the key on the **Connections** page.",
          "**cloudflared** - opens the dashboard over 4G/5G, used for phone uploads away from your Wi-Fi.",
          "Two rows are for information only: the size of the .runtime/ folder and the detected GPU.",
        ],
      },
      {
        heading: "Hardware and thread counts",
        paragraphs: [
          "The **Detected hardware** card reads the machine's CPU, RAM and GPU. An NVENC or VideoToolbox badge means the GPU has a hardware video encoder; **CPU only** means it does not, and the two GPU encode switches are locked.",
          "**Chrome workers (HyperFrames)** is how many headless browsers render a scene together; **Remotion concurrency** is how many frames Remotion renders in parallel while assembling. **Auto** lets the system decide.",
        ],
        warning:
          "Higher numbers are faster but use more RAM. Push past what the machine can handle and renders stall or die partway - when unsure, pick the ★ option.",
      },
      {
        heading: "GPU switches",
        bullets: [
          "**GPU for capture (browser)** - on by default. Chrome uses the GPU to draw frames for both HyperFrames and Remotion; turn it off if you hit strange render errors.",
          "**GPU encode for drafts** - on by default. Drafts are only for review, so speed wins.",
          "**GPU encode for FINAL** - off by default. The GPU is much faster, but at the same file size the CPU (libx264) looks slightly better; turn it on if you would rather have speed.",
          "**Fast capture (macOS)** - off by default. Roughly doubles capture speed, but only really works on a Mac with a GPU; harmless elsewhere.",
        ],
        paragraphs: [
          "Encoding the final assembled video always runs on the CPU - no switch changes that. Transcription with faster-whisper uses an NVIDIA GPU automatically when there is one, and the CPU otherwise.",
        ],
      },
      {
        heading: "Queue, drafts and the QC gate",
        bullets: [
          "**Concurrent render jobs (queue)** - 1 to 4 jobs in parallel across different projects, default 2. Use 1 on a weak machine.",
          "**Draft fps** - **Keep as-is**, 15 fps or 24 fps. A 15 fps draft is nearly twice as fast and fine for checking the pacing; the final always uses the project's fps.",
          "**Block the final render while QC has not passed** - on by default. Turn it off and the AI can export a final even with measurable problems such as off loudness, black frames or text hidden behind the platform UI.",
        ],
      },
      {
        heading: "AI session costs",
        bullets: [
          "**How many times the AI may redo a video** - default 4. If a session ends without a final video, the system lets the AI run again up to this many times; any real progress resets the count.",
          "**Step limit for a single run** - default 300. One step is the AI calling a tool and reading the result; hitting the limit stops the run, but whatever was built stays in the project.",
        ],
        tip: "Each redo costs nearly as much as a fresh video, so 3-4 is plenty. Don't drop the step limit much below 50, or complex videos will run out of steps before they finish.",
      },
      {
        heading: "Update channel",
        bullets: [
          "**Stable (release)** - the default, marked ★. You are only offered versions the team has published as a release. Stable and recommended.",
          "**Latest (main)** - every change pushed to the main branch. Fixes arrive sooner, but it can be unstable.",
        ],
        paragraphs: [
          "If the repository has no releases yet, the system compares against the latest code on main for now and says so in the update window.",
        ],
      },
      {
        heading: "Updating the system",
        steps: [
          "Check the chip at the bottom of the left sidebar: **Up to date**, **New version** or **Check failed**. It checks on its own every 5 minutes.",
          "Click the chip to open **System update**, which shows the **Running** and **New** versions plus **What's new**.",
          "Click **Update now** (or **Later**). The system goes through 4 steps - **Download update**, **Stop the system**, **Install packages**, **Restart** - in about 1-3 minutes.",
          "Once you see **Update successful** the page reloads by itself; click **Reload now** if you don't want to wait.",
        ],
        warning:
          "Updates are refused while any job is running or queued in the Render Queue. Don't turn off the machine or close the window mid-update. If you see **The update did not finish**, the old version is still running normally and the full log is in start/update.log.",
      },
    ],
  },

  connections: {
    title: "Connections",
    summary:
      "Connect the AI services the system uses: Claude for editing and chat, Gemini and the web-account gateways for images, plus a Cloudflare Tunnel to reach the dashboard from the Internet. Changes take effect immediately, no restart needed.",
    blocks: [
      {
        heading: "Reading a provider card",
        paragraphs: [
          "Each provider has its own card with a status in the corner: **Connected · Subscription**, **Connected · API key** or **Not connected**. The chips under the name show what it is used for, such as **Video editing**, **Chat** or **Image generation**.",
          "API keys you paste are written to the .env file in the project's root folder on this machine. The field only ever reveals the last few characters.",
        ],
      },
      {
        heading: "Claude - required for editing",
        paragraphs: [
          "Claude is the AI director: without it there is no AI editing and no chat. There are two ways to connect, and the first one is preferred.",
        ],
        steps: [
          "Recommended - use your subscription: open a terminal on the machine running the system, type claude, then /login, and confirm in the browser.",
          "Reopen **Connections**: the Claude (Anthropic) card now shows **Connected · Subscription**, with no API fees.",
          "Only if you cannot sign in: get a key through **Get a key here**, paste it into the API key (ANTHROPIC_API_KEY) field and click **Save key**. This is billed by usage.",
        ],
      },
      {
        heading: "Adding, changing or removing a key",
        steps: [
          "Click **Get a key here** in the card to open the provider's key page.",
          "Paste the key into the API key field (**Show key** lets you double-check it), then click **Save key** or press Enter.",
          "Once saved, the system runs **Test connection** automatically and shows the result right under the button.",
          "Use **Change key** to replace it, or **Delete key** and confirm to remove it.",
        ],
        tip: "Pasting a whole line like GEMINI_API_KEY=AIza..., or a key wrapped in quotes, is fine - the extra bits are stripped automatically.",
      },
      {
        heading: "Other providers",
        bullets: [
          "**Gemini (Google)** - paints backgrounds for Images Project and illustrations inside videos, billed per image (about $0.05 per 1K image). An Antigravity subscription cannot stand in for the API key.",
          "**OpenAI (ChatGPT)** - not used by the pipeline yet; you can store a key now for future features. A ChatGPT login through Codex CLI cannot replace the key.",
          "**Soniox** - transcription that tells speakers apart (about $0.10 per hour), needed when dubbing so each speaker gets the right male or female voice. Without it, faster-whisper still transcribes on your machine for free, just without speaker labels.",
        ],
      },
      {
        heading: "Images from web accounts (gateways)",
        paragraphs: [
          "The **ChatGPT (web account)** and **Gemini (web cookie)** cards let you generate images with the allowance already in your accounts instead of paying per API call. Both run through a separate gateway on this machine.",
          "The first time, click **Install gateway** - one install covers both cards, takes a few minutes and needs Python 3.13 or 3.14. You can also install it from the **Image gateway** row on the **Settings** page.",
        ],
        warning:
          "Using web accounts this way is unofficial and may break the provider's terms, and the account can be limited - use a secondary account. Tokens and cookies stay on this machine.",
      },
      {
        heading: "Adding a ChatGPT account",
        steps: [
          "Sign in to ChatGPT in your browser.",
          "Open chatgpt.com/api/auth/session in a new tab (the card has the link).",
          "Copy everything on that page, paste it into **Login session (JSON or accessToken)** and click **Add account**.",
          "You can add several accounts; when one runs out of image credits the gateway moves to the next. The list shows remaining credits and the expiry of each account.",
        ],
        tip: "ChatGPT tokens usually expire after a few days. When you see **Expiring soon**, open the session page again and paste a fresh one.",
      },
      {
        heading: "Saving a Gemini web cookie",
        steps: [
          "Sign in to Google on gemini.google.com.",
          "Open DevTools (F12) → Application → Cookies → https://gemini.google.com.",
          "Choose **Separate values** to paste __Secure-1PSID and __Secure-1PSIDTS, or **Paste the whole Cookie string** and let the system pick them out.",
          "Click **Save cookie**. It refreshes itself while the gateway runs; signing out of Google in the browser can invalidate it.",
        ],
      },
      {
        heading: "Default image provider",
        paragraphs: [
          "The **Default image provider** card picks who draws when a model field is left on default or auto - for illustrations, Images Project and filler shots in the editor. Each project can still choose its own.",
        ],
        bullets: [
          "**Auto** - uses the first configured provider and falls back to the next one on failure.",
          "**Gemini API** - the most reliable, billed per image.",
          "**ChatGPT (web)** and **Gemini (web)** - use your account's allowance; cheaper, but slower and can be rate-limited.",
          "**Pause between images (web gateways)** - seconds to wait between images drawn with web accounts, so the account is not throttled. Enter a number and click **Save**.",
        ],
      },
      {
        heading: "Cloudflare Tunnel",
        paragraphs: [
          "The last card puts the dashboard on the Internet so you can use it over 4G/5G. Use **Start tunnel** / **Stop tunnel**; leave **Custom domain (TUNNEL_DOMAIN)** empty and the system uses a **Quick Tunnel** with a random address.",
          "How to use it for phone uploads is covered in the Upload from your phone section.",
        ],
        warning:
          "The dashboard has no login: anyone with the tunnel link can get in. Never share the link, and stop the tunnel as soon as you are done.",
      },
    ],
  },

  "phone-upload": {
    title: "Upload from your phone",
    summary:
      "Scan a QR code to send videos and photos from your phone straight into a project - no cable or transfer app. It works right away on the same Wi-Fi, and through a Cloudflare Tunnel when you are elsewhere.",
    blocks: [
      {
        heading: "Sending files on the same Wi-Fi",
        steps: [
          "Open the project page, find the **Sources & Assets** card and click **Connect phone**.",
          "If the machine has several networks, pick the right address under **Network (server IP)** - usually the one starting with 192.168.",
          "Scan the QR code with your phone camera. The **Upload files to project** page opens on the phone.",
          "Tap **Choose videos / photos** for existing files, or **Record video / take photo** to shoot something new.",
          "Uploaded files go straight into the project's **Sources & Assets** card on the computer.",
        ],
      },
      {
        heading: "The first time on Windows",
        paragraphs: [
          "The phone must be on the same Wi-Fi as the machine running the system. The first time, Windows asks about the firewall - choose **Allow**.",
          "When the start script runs with administrator rights, it opens ports 6868 and 6869 in the firewall by itself.",
        ],
        tip: "If the phone cannot open the page: make sure both are on the same Wi-Fi, try another address under **Network (server IP)**, and check that the firewall allowed it.",
      },
      {
        warning:
          "Keep the phone's screen on while uploading large files - once the screen turns off, the browser stops sending. Wait until the page says the upload is finished before locking the phone.",
      },
      {
        heading: "The link only lives while the QR window is open",
        paragraphs: [
          "Every time you open **Connect phone** you get a new link with its own token. Close the window and the link is locked at once; the phone then says \"The link has expired - reopen the QR code on the computer.\"",
          "To send more, reopen the window on the computer and scan the new code.",
        ],
      },
      {
        heading: "Sending over 4G/5G (not on the same Wi-Fi)",
        steps: [
          "The machine running the system needs cloudflared - install it with the **Install** button on the cloudflared row in **Settings**.",
          "In the **Connect phone** window, click **Turn on Internet (Cloudflare Tunnel)** at the bottom. After a few seconds the QR code switches to the Internet link.",
          "If a tunnel is already running, click **Use the Internet link** to switch the QR code over.",
          "When you are done, click **Turn off Internet**, or just close the window - a tunnel started from this window stops with it.",
        ],
        tip: "A tunnel started from **Connections** or from the tunnel script keeps running after you close the QR window, until you stop it yourself.",
      },
      {
        heading: "Quick Tunnel or your own domain",
        bullets: [
          "No domain set: the system uses a Quick Tunnel with a random xxx.trycloudflare.com address that CHANGES every time it starts.",
          "For a fixed address: enter your domain in **Custom domain (TUNNEL_DOMAIN)** on **Connections**, or add TUNNEL_DOMAIN=<your-domain> to the .env file. The QR code then uses https://<domain>/m/<project>.",
          "A custom domain needs a one-time setup on the machine: cloudflared tunnel login, create and route dns.",
        ],
      },
      {
        heading: "Starting the tunnel with a script",
        bullets: [
          "Windows: double-click start\\tunnel.bat",
          "macOS: double-click start/tunnel.command",
          "Linux: run ./start/tunnel.sh",
        ],
        paragraphs: [
          "With TUNNEL_DOMAIN in .env the script runs a tunnel for that domain; without it, a Quick Tunnel.",
        ],
      },
      {
        warning:
          "The dashboard has no login: anyone with the tunnel link can open the whole dashboard. Never share the link publicly, only expose it behind Cloudflare Access, and stop the tunnel as soon as you are done.",
      },
    ],
  },

  troubleshooting: {
    title: "Troubleshooting",
    summary:
      "Common problems and how to fix them: starting, stopping and updating, missing tools, failed renders, missing Vietnamese diacritics and interrupted AI sessions.",
    blocks: [
      {
        heading: "Starting, stopping and updating",
        bullets: [
          "Start - Windows: start\\start.bat · macOS: start/start.command · Linux: ./start/start.sh",
          "Stop - Windows: start\\stop.bat (or close the \"AI Edit Video - LOG\" window) · macOS: start/stop.command · Linux: ./start/stop.sh",
          "Update manually - Windows: update\\update.bat · macOS: update/update.command · Linux: bash update/update.sh",
        ],
        paragraphs: [
          "The start script checks the machine, installs packages on the first run, builds, creates the .env file, starts everything and opens http://localhost:6868. If the system is already running it just reopens the browser; if it is half-running it cleans up and restarts.",
          "You normally never need the update script - the update chip at the bottom of the left sidebar does it. Use the script only when the dashboard will not open.",
        ],
      },
      {
        heading: "macOS blocks a file, or a file will not run",
        bullets: [
          "macOS says the file is from an unidentified developer: right-click the file → **Open** → **Open**.",
          "A .sh file cannot be double-clicked on macOS - use the .command file instead.",
          "If you downloaded a ZIP instead of cloning, run this once: chmod +x start/*.sh start/*.command update/*.sh update/*.command",
          "On macOS and Linux the system log is start/server.log; on Windows it is the \"AI Edit Video - LOG\" window.",
        ],
      },
      {
        heading: "The backend status dot in the top bar",
        bullets: [
          "Green, **Backend online** - all good.",
          "Red, **Cannot reach backend** - the processing side has stopped or hung. Run the start script again; it cleans up and restarts it.",
        ],
        paragraphs: [
          "The dot re-checks every 30 seconds. On narrow screens only the dot shows - hover it to read the status.",
        ],
      },
      {
        heading: "Missing tools or not signed in to Claude",
        steps: [
          "Open **Settings** and look at the **System check** card. Missing required items get a red badge and sit at the top of the list.",
          "Click **Install** for FFmpeg, Google Chrome or Claude Code; get Node.js from nodejs.org (version 22 or later).",
          "**Claude login** cannot be done for you: open a terminal, type claude, then /login - or paste ANTHROPIC_API_KEY on the **Connections** page.",
          "Click **Check again**. From a terminal you can run node start/doctor.mjs --fix in the root folder instead.",
        ],
        tip: "Missing tools never block startup - the dashboard still comes up so you can fix things from the UI.",
      },
      {
        heading: "Python too old or too new",
        paragraphs: [
          "Subtitles (faster-whisper) and VieNeu-TTS narration need Python 3.11 to 3.14. The image gateway needs Python 3.13 or 3.14. Python 3.15 and later cannot be used yet because some packages do not support it.",
        ],
        bullets: [
          "macOS: run brew install python@3.13. The built-in Python 3.9 is too old, and brew install python may give you one that is too new.",
          "Windows and Linux: download Python 3.13 from python.org/downloads.",
          "Then click **Install** on that row again - an environment built with an unsupported Python is deleted and rebuilt automatically.",
        ],
      },
      {
        heading: "A render failed",
        steps: [
          "Open **Render Queue**, click the **Failed** chip, then click the broken job to read its log - the reason is usually in the last lines.",
          "Fix the cause (a missing file, a broken scene...) or ask the AI to fix it in the project's chat.",
          "Run the draft again from the project page (**Render scene draft** or **Assemble draft** in the **More** menu), check it, and only then render the final.",
        ],
        bullets: [
          "A final job is refused straight away: the project has no successful **Assemble draft** yet, or QC has not run or not passed on the current draft.",
          "Renders stall or die halfway: in **Settings**, lower **Chrome workers (HyperFrames)** and **Remotion concurrency** to the ★ values, set **Concurrent render jobs (queue)** to 1, or turn off **GPU for capture (browser)**.",
          "The job says the server restarted while it was running: the system was shut down mid-job - just run it again.",
        ],
      },
      {
        heading: "Vietnamese text loses its diacritics",
        bullets: [
          "Use fonts from Style Design: type a Google Fonts name and the system downloads the full Vietnamese character set. A font the machine does not have gets silently swapped, and the diacritics are always the first thing to break.",
          "If a draft shows the problem: in the **Review draft** card, pin a note at the exact second (for example \"diacritics cut off at 00:12\") and click **Send to AI**. The AI's skills already include the fix for gradient text dropping diacritics.",
          "After the fix, render the draft again and check that spot closely before the final.",
        ],
      },
      {
        heading: "An AI session was interrupted",
        paragraphs: [
          "A session that gets cut off (server restart, network error...) shows as **Paused**. With the **Auto-resume** switch on in the chat panel, it picks up again about 15 seconds after the system comes back, or a few seconds after an error.",
          "It gives up after several runs in a row with no progress (video edit sessions follow **How many times the AI may redo a video** in **Settings**, ordinary chats stop after 3). Then just send a message and the AI carries on.",
        ],
      },
      {
        heading: "Where finished videos go",
        bullets: [
          "Every assembled video is saved in the outputs/ folder at the project root.",
          "Draft: outputs/<project-name>-draft.mp4 - each new draft overwrites the previous one.",
          "Final: outputs/<project-name>-v1.mp4, -v2.mp4... - each final render adds a new version and never overwrites.",
          "You can also watch and download them on the project page or the **Assets** page.",
        ],
      },
      {
        heading: "Sharing installed tools between several copies",
        paragraphs: [
          "Everything heavy (the Python environments, several GB of AI models, separately downloaded ffmpeg/cloudflared, gateway accounts) lives in .runtime/ inside each copy. A fresh clone downloads it all again, unless you point them at one place.",
        ],
        steps: [
          "Add AIEV_RUNTIME_DIR=<path> to the .env file of EACH copy (an absolute path, or relative to the root folder).",
          "Simplest: point straight at the .runtime of the copy you already run, for example AIEV_RUNTIME_DIR=D:\\AIEV\\.runtime - nothing moves, just don't delete the old copy.",
          "To move .runtime somewhere neutral instead: after moving it, DELETE the venv and venv-gateway folders inside, then run the start script once to rebuild them. The models are not downloaded again.",
        ],
        warning:
          "Never run two copies at the same time on one .runtime. Cloned voices live in assets/voices/, not in .runtime - copy that folder across by hand.",
      },
      {
        heading: "An update did not finish",
        paragraphs: [
          "If the window says **The update did not finish**, the old version is still running normally - the script downloads the new code before stopping anything. The full log is in start/update.log.",
          "\"A render job is running - wait for it to finish, then update.\": wait until the Render Queue is empty (nothing **Running** or **Queued**) and try again.",
        ],
      },
    ],
  },
};
