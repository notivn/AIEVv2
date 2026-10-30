import type { GuideContent } from "@/lib/guide/types";

/**
 * Nhóm "Bắt đầu" của bảng Hướng dẫn: tổng quan, Dashboard, danh sách Videos
 * Project, trang project và trình chỉnh sửa video.
 *
 * Tên nút/ô trong `**...**` phải khớp đúng chữ trên giao diện (locales/vi.ts cho
 * `vi`, locales/en.ts cho `en`) - đổi nhãn ở locales thì sửa luôn ở đây.
 */

type Ids = "overview" | "dashboard" | "projects" | "project-detail" | "editor";

export const vi: Pick<GuideContent, Ids> = {
  overview: {
    title: "Bắt đầu",
    summary:
      "AI Edit Video là bàn dựng video tự động: bạn đưa footage hoặc ý tưởng, AI dựng thành video hoàn chỉnh, còn bạn theo dõi, chỉnh sửa và duyệt ngay trên giao diện này.",
    blocks: [
      {
        heading: "Ứng dụng làm gì",
        paragraphs: [
          "Claude đóng vai đạo diễn: đọc kịch bản edit bạn viết, dựng từng scene chuyển động (chữ động, phụ đề karaoke, đồ họa) bằng HyperFrames, rồi lắp scene, footage, giọng đọc, nhạc và sound effect thành video hoàn chỉnh bằng Remotion.",
          "Giao diện web dùng để xem, quản lý và chỉnh sửa. Việc mã hóa video luôn chạy ở máy chủ phía sau, kể cả khi bạn bấm render từ trình chỉnh sửa.",
        ],
      },
      {
        heading: "Ba nguyên tắc nên nhớ",
        bullets: [
          "Mỗi project có một file meta.json là nguồn sự thật duy nhất của timeline. AI, trình chỉnh sửa và bạn cùng sửa một chỗ đó, nên thay đổi ở đâu cũng thấy ở mọi nơi.",
          "Luôn có bản draft trước bản final. Draft render nhanh, chất lượng thấp để soi lỗi; final chậm và nặng máy, chỉ chạy khi draft đã ổn.",
          "Mọi lượt render đều xếp vào **Render Queue** và chạy lần lượt, kể cả khi AI tự render. Muốn biết máy đang làm gì thì xem ở đó.",
        ],
      },
      {
        heading: "Làm video đầu tiên",
        steps: [
          "Vào **Videos Project**, bấm **Tạo project**, đặt tên, chọn **Định dạng video** và FPS.",
          "Trong trang project, chọn loại nguồn ở card **Nguồn video**: tải footage lên **Nguồn & Asset** (hoặc quét QR từ điện thoại), dán link bài viết, hoặc mô tả yêu cầu bằng chữ.",
          "Điền **Kịch bản edit (Brief)**: viết **Yêu cầu edit (prompt)**, bật tắt các tính năng, chọn **Style Design**.",
          "Chọn **AI làm tới đâu**, bấm **Bắt đầu edit bằng AI**, xem lại tóm tắt rồi bấm **Bắt đầu edit**. AI làm việc thế nào hiện ngay ở panel bên phải.",
          "Có bản nháp thì xem ở **Video output**, sửa tay bằng **Mở trình chỉnh sửa** hoặc ghim ghi chú ở **Duyệt bản draft** để AI sửa.",
          "Chạy **QC tự động**, đạt rồi bấm **Render final**. File MP4 hoàn chỉnh nằm trong thư mục outputs.",
        ],
      },
      {
        heading: "Thanh điều hướng bên trái",
        paragraphs: ["Các mục xếp theo nhịp làm việc, từ trên xuống:"],
        bullets: [
          "**Dashboard** và **Videos Project** - tổng quan và nơi làm video chính.",
          "**Images Project**, **Auto cut videos**, **Text to video**, **Dịch video**, **Giọng đọc** - các công cụ tạo nội dung riêng.",
          "**Style Design** và **Phong cách dựng** - nhận diện thương hiệu (màu, font, logo) và ngôn ngữ thị giác của từng video.",
          "**Render Queue**, **Assets**, **Sound Effects**, **Prompts**, **Skills** - hàng đợi render và các thư viện dùng chung.",
          "**Cấu hình** và **Kết nối** - chỉnh tốc độ render, khai API key và đăng nhập các dịch vụ.",
        ],
        tip: "Nút **Thu gọn menu** ở đầu thanh thu thanh về dạng chỉ còn icon, lựa chọn được nhớ cho lần sau. Vào trình chỉnh sửa video thì thanh tự thu gọn để nhường chỗ cho trình phát.",
      },
      {
        heading: "Nút Hướng dẫn",
        paragraphs: [
          "Bấm **Hướng dẫn** trên thanh trên cùng ở bất kỳ trang nào, bảng này mở ra đúng mục của trang bạn đang đứng. Bảng không che trang, nên bạn vừa đọc vừa làm theo được; chuyển trang thì mục cũng đổi theo.",
          "Bấm tên mục ở đầu bảng để mở menu và chọn mục khác - mục của trang hiện tại có nhãn **Trang này**. Đang đọc mục khác thì nút **Về trang đang mở** đưa bạn quay lại.",
          "Hai nút **Mục trước** và **Mục sau** ở cuối bảng giúp đọc lần lượt toàn bộ hướng dẫn.",
        ],
      },
      {
        heading: "Thanh trên cùng",
        bullets: [
          "Đồng hồ **CPU** và **GPU** cho biết máy đang chạy nặng tới đâu, chuyển màu cảnh báo khi vượt 85%. Rê chuột vào để xem tên chip và VRAM; GPU chỉ hiện khi máy có card đồ họa đo được.",
          "Chấm trạng thái: màu xanh là **Backend hoạt động**; màu cảnh báo là backend thiếu thành phần hoặc không kết nối được.",
          "Nút lá cờ đổi ngôn ngữ giao diện giữa tiếng Việt và tiếng Anh.",
          "Nút mặt trời/mặt trăng chuyển giao diện sáng và tối. Mặc định là sáng, lựa chọn được nhớ trên trình duyệt này.",
          "Trang nào có AI (như trang project) thì panel AI nằm bên phải, gấp lại được thành dải mỏng. Màn hình hẹp thì mở panel bằng nút **Panel AI** trên thanh này.",
        ],
      },
      {
        heading: "Badge cập nhật cuối thanh điều hướng",
        paragraphs: [
          "Badge cuối thanh trái cho biết phiên bản đang chạy: **Bản mới nhất** là đã cập nhật, **Có bản mới** là đã có bản phát hành mới, **Lỗi kiểm tra** là chưa kiểm tra được. Hệ thống tự kiểm tra mỗi 5 phút.",
          "Bấm badge để xem **Có gì mới**, rồi bấm **Cập nhật ngay**. Hệ thống tự tắt, tải bản mới và khởi động lại trong khoảng 1-3 phút, trang tự tải lại khi xong.",
        ],
        tip: "Mặc định bạn chỉ nhận bản chính thức đã phát hành. Muốn nhận cả thay đổi mới nhất chưa phát hành thì đổi kênh cập nhật ở trang **Cấu hình**.",
        warning:
          "Không cập nhật được khi đang có job render chạy - chờ job xong đã. Trong lúc cập nhật, đừng tắt máy hay đóng cửa sổ.",
      },
    ],
  },

  dashboard: {
    title: "Dashboard",
    summary:
      "Trang tổng quan cả hệ thống: có bao nhiêu project, máy đang chạy gì, AI tiêu bao nhiêu token và tiền. Dashboard chỉ để nhìn, không dựng video.",
    blocks: [
      {
        heading: "Banner cảnh báo trên cùng",
        paragraphs: [
          "Thiếu thành phần quan trọng (FFmpeg, đăng nhập Claude, HyperFrames) thì banner **Hệ thống thiếu thành phần cần thiết:** liệt kê từng thứ. Còn banner này thì render hoặc phiên AI sẽ thất bại.",
          "Banner job lỗi cho biết hôm nay có bao nhiêu job lỗi, kèm tên project, loại job và thời điểm của vài job gần nhất.",
        ],
        bullets: [
          "**Xem hàng đợi** - mở Render Queue để đọc log lỗi.",
          "**Xóa khỏi trang chủ** - chỉ ẩn banner trên Dashboard; job lỗi và log vẫn còn nguyên trong Render Queue, job lỗi mới phát sinh sau đó vẫn tự hiện lại.",
        ],
      },
      {
        heading: "Năm ô số liệu",
        bullets: [
          "**Tổng project** - số project video, kèm số đã hoàn thành.",
          "**Video đã xuất** - số project đã có video output.",
          "**Token 30 ngày** - tổng token AI trong 30 ngày gần nhất và số tiền tương ứng.",
          "**Job hôm nay** - số job tạo hôm nay, bao nhiêu xong, bao nhiêu lỗi.",
          "**Hàng đợi** - số job đang chờ chạy.",
        ],
        tip: "Bấm vào một ô là sang thẳng danh sách tương ứng (Videos Project hoặc Render Queue). Riêng ô token không bấm được.",
      },
      {
        heading: "Biểu đồ Token AI theo ngày",
        paragraphs: [
          "Cột là tổng token mỗi ngày, các đường là token của từng AI (Claude, Gemini, OpenAI). AI nào không phát sinh token thì không có đường trên biểu đồ.",
          "Chọn khoảng **7 ngày**, **30 ngày** hoặc **90 ngày**, và lọc loại project **Tất cả**, **Video** hoặc **Ảnh**. Dòng chữ trên biểu đồ ghi tổng token, tổng tiền, token vào và token ra của khoảng đã chọn.",
        ],
      },
      {
        heading: "Cột bên phải",
        bullets: [
          "**AI đang làm việc** chỉ hiện khi có phiên AI đang chạy: mỗi dòng cho biết AI đang làm gì, tới bước mấy, kèm **Mở project →** để nhảy tới project đó.",
          "**Job đang chạy** liệt kê các job render đang chạy với thanh tiến trình và tên bước. Bấm tên để mở đúng project (hoặc đúng phiên Auto cut, Text to video, Dịch video, Images Project).",
        ],
      },
      {
        heading: "Chi phí AI theo model",
        paragraphs: [
          "Bảng chia số tiền thật đã trả theo từng AI và model: **Token vào**, **Token ra**, **$ vào**, **$ ra** và **Tổng $**. Bảng dùng chung khoảng ngày với biểu đồ nhưng luôn tính mọi loại project.",
          "Token AI viết ra thường đắt gấp khoảng 5 lần token đọc vào, còn nội dung AI đã đọc lần trước được tính rẻ hơn nhiều khi đọc lại. Model chưa có bảng giá thì hai ô $ để dấu gạch, nhưng tiền vẫn được tính đủ ở **Tổng $**.",
        ],
      },
      {
        heading: "Project gần đây và Phiên AI gần đây",
        paragraphs: [
          "**Project gần đây** liệt kê 5 project vừa sửa, kèm trạng thái và số token đã dùng. Bấm tên để mở, hoặc **Xem tất cả →** để sang Videos Project.",
          "**Phiên AI gần đây** là 5 phiên chat mới nhất, mỗi phiên có **Mở project →** để quay lại đúng project.",
        ],
        tip: "Render chậm bất thường thì liếc đồng hồ **CPU** và **GPU** trên thanh trên cùng: thanh đổi màu cảnh báo nghĩa là máy đã chạy hết công suất, nên giảm số job song song ở trang **Cấu hình**.",
      },
    ],
  },

  projects: {
    title: "Videos Project",
    summary:
      "Danh sách mọi video bạn đang làm. Mỗi project là một video riêng, có kích thước, FPS, kịch bản edit và các bản render của nó.",
    blocks: [
      {
        heading: "Tạo project mới",
        steps: [
          "Bấm **Tạo project** ở góc trên bên phải.",
          "Gõ **Tên**. **ID (tên folder)** tự sinh từ tên; sửa được, nhưng chỉ gồm chữ thường, số và gạch nối (vd: my-video-1).",
          "Thêm **Tags** nếu muốn nhóm project để lọc sau này (gõ tag rồi Enter).",
          "Chọn **Định dạng video**: **TikTok/Reels dọc** (1080×1920), **YouTube ngang** (1920×1080), **Vuông**, **Dọc 4:5**, **Ngang 4K**, **Dọc 4K**, hoặc **Tùy chỉnh** để tự nhập **Rộng (px)** và **Cao (px)**.",
          "Chọn FPS 24, 25, 30 hoặc 60 (mặc định 30); chọn **Khác** để nhập số riêng.",
          "Bấm **Tạo project** - hệ thống mở thẳng trang của project mới.",
        ],
        tip: "Chọn đúng khung hình ngay từ đầu. Cần thêm bản khác tỉ lệ cho cùng nội dung thì dùng **Tái chế tỉ lệ khung** trong trang project, không phải dựng lại từ đầu.",
      },
      {
        heading: "Đọc bảng danh sách",
        paragraphs: ["Bấm vào một hàng để mở project. Các cột gồm:"],
        bullets: [
          "**Tên** kèm ID. Project do Text to video sinh ra có nhãn **Từ Text to video**, bấm vào để về đúng phiên đó.",
          "**Kích thước** gồm khung hình và FPS.",
          "**Trạng thái**: **Nháp**, **Đang render** hoặc **Hoàn thành**.",
          "**Token AI** - lượng token AI project đã tiêu; rê chuột để xem số chính xác và số tiền.",
          "**Tạo lúc** và **Sửa cuối**.",
        ],
      },
      {
        heading: "Tìm và lọc",
        paragraphs: [
          "Gõ vào ô **Tìm project theo tên hoặc ID…** để lọc ngay khi gõ.",
          "Khi có project gắn tag, hàng chip tag hiện phía trên bảng. Bấm một hay nhiều tag để chỉ xem project mang các tag đó, bấm **Tất cả** để bỏ lọc; bấm chip tag ngay trong một hàng cũng lọc theo tag đó.",
        ],
      },
      {
        heading: "Đổi tên và nhân bản",
        paragraphs: [
          "Nút bút chì cuối hàng đổi tên hiển thị của project; ID (tên folder) giữ nguyên.",
          "Nút nhân bản tạo project mới chép compositions, assets kèm mô tả, brief, tags và scenes - không chép renders và video output. Bản sao bắt đầu ở trạng thái nháp, ID tự sinh từ tên mới.",
        ],
      },
      {
        heading: "Thao tác hàng loạt",
        paragraphs: [
          "Tích ô đầu hàng (hoặc ô trên tiêu đề cột để chọn mọi project đang hiện), thanh thao tác hàng loạt sẽ xuất hiện:",
        ],
        bullets: [
          "**Xóa file rác** - dọn bản draft cũ, frame tạm và file trung gian trong renders để lấy lại dung lượng. Hệ thống hỏi lại kèm dung lượng sẽ giải phóng; video final và file nguồn được giữ nguyên.",
          "**Xóa đã chọn** - xóa vĩnh viễn cả thư mục của các project đã chọn.",
          "**Render final** (kèm số project đã chọn) - xếp job dựng bản final của từng project vào hàng đợi, chạy lần lượt. Project chưa đủ điều kiện (chưa có draft, QC chưa đạt) bị báo lỗi và bỏ qua, các project còn lại vẫn chạy.",
          "**Tạo video** (kèm số project) - mở hộp **Tạo video bằng AI**: AI dựng song song từng project theo brief đã lưu của nó, ô **Dặn dò thêm (áp dụng cho tất cả)** áp cho cả loạt.",
        ],
        tip: "Tạo video hàng loạt tốn token thật cho từng project, và mỗi project là một phiên AI riêng - muốn dừng phải vào từng project.",
      },
      {
        heading: "Xóa project",
        paragraphs: [
          "Chọn project rồi bấm **Xóa đã chọn**. Hộp xác nhận liệt kê project sẽ xóa và bắt gõ đúng chữ DELETE mới cho bấm nút xóa.",
        ],
        warning:
          "Xóa project là xóa vĩnh viễn cả thư mục, kể cả asset và bản render, không khôi phục được. Muốn giữ lại một bản thì nhân bản trước khi xóa.",
      },
    ],
  },

  "project-detail": {
    title: "Trang project",
    summary:
      "Nơi dựng một video từ đầu tới cuối: đưa nguồn vào, viết kịch bản edit, giao việc cho AI, duyệt bản nháp, kiểm tra chất lượng và xuất bản.",
    blocks: [
      {
        heading: "Bố cục trang",
        paragraphs: [
          "Đầu trang là tên project (bấm bút chì để đổi tên), kích thước, FPS và thanh 6 giai đoạn: **Phân tích**, **Dựng scene**, **Render draft**, **Lắp draft**, **Render final**, **Hoàn thành**. Chấm nhấp nháy nghĩa là đang có việc chạy nền.",
          "Góc phải có **Danh sách project**, **Mở trình chỉnh sửa** và **Xóa**. Dải bên dưới hiện trạng thái, ID, nút **Nhân bản** và hàng tag - bấm dấu cộng để thêm tag, Enter để lưu.",
          "Phần chính chia ba cột theo nhịp làm việc: **Nguồn**, **Yêu cầu & thiết lập**, **Tiến trình & kết quả**. Mỗi khối gấp/mở được; project đã xong thì các khối nhập liệu tự thu gọn.",
        ],
      },
      {
        heading: "Nguồn video",
        paragraphs: ["Card **Nguồn video** quyết định video dựng từ đâu:"],
        bullets: [
          "**Video** - AI edit footage bạn tải lên ở **Nguồn & Asset**: cắt, phụ đề, key, hiệu ứng.",
          "**Link bài viết** - dán link rồi bấm **Lấy bài** để xem trước nội dung AI sẽ dùng; không bấm thì AI tự lấy khi bắt đầu edit. Trang chặn bot thì chuyển sang **Yêu cầu** và dán nội dung vào.",
          "**Yêu cầu** - gõ chủ đề, kịch bản hoặc nội dung vào ô **Yêu cầu / nội dung**. AI không bịa số liệu bạn không đưa.",
        ],
        tip: "Hai loại không có footage (**Link bài viết**, **Yêu cầu**) cho ra video motion graphics: chữ động, số liệu, ảnh minh họa.",
      },
      {
        heading: "Khi không có footage: minh họa và lồng tiếng",
        bullets: [
          "**Chèn ảnh minh họa AI** - BẬT: ảnh AI là nguồn hình chính của video. TẮT: AI chỉ dùng chữ, đồ họa và ảnh có sẵn. Đây là cùng một công tắc với **Ảnh minh họa AI (Gemini)** trong Brief.",
          "**Lồng tiếng (giọng đọc)** - BẬT: giọng đọc làm xương sống thời gian, phụ đề karaoke khớp theo giọng. TẮT: video chỉ có chữ và nhạc.",
          "Bật lồng tiếng thì chọn **Giọng AI** (AI viết lời đọc từ nguồn rồi đọc bằng đúng giọng bạn chọn, không tự đổi giọng) hoặc **File thu sẵn** (chọn hoặc **Tải lên** file thu âm của bạn, video dựng theo đúng lời trong file).",
        ],
      },
      {
        heading: "Nguồn & Asset",
        paragraphs: [
          "Kéo thả video, ảnh, âm thanh vào card **Nguồn & Asset**, hoặc bấm **Tải lên**. File âm thanh và file khác được tách ra khối **Sound Effect** và **Khác** bên dưới.",
          "Mỗi file có ô **Mô tả cho AI** - AI đọc đúng dòng này để biết dùng file vào lúc nào. File chưa mô tả có nhãn **Chưa mô tả**.",
          "Video có nút **Chỉnh màu**: chọn một ô trong **Template màu**, kéo các thanh **Điều chỉnh**, giữ **So với gốc** để so, rồi bấm **Lưu lựa chọn**. AI sẽ áp đúng màu này lên toàn bộ video khi edit.",
          "**Kết nối điện thoại** hiện mã QR: quét bằng camera điện thoại để gửi video, ảnh thẳng vào project. Điện thoại phải chung WiFi với máy này; muốn dùng 4G/5G thì bấm **Bật Internet (Cloudflare Tunnel)**.",
        ],
        warning:
          "Link QR chỉ dùng được khi cửa sổ QR đang mở, và nên giữ màn hình điện thoại sáng khi tải file lớn. Xóa asset là xóa file thật trong project, không hoàn tác được.",
      },
      {
        heading: "Kịch bản edit (Brief)",
        paragraphs: [
          "Brief là bản yêu cầu AI đọc trước khi dựng. Nó tự lưu sau khi bạn ngừng gõ và được dùng lại cho mọi phiên edit sau.",
        ],
        bullets: [
          "**Mô tả video gốc** (chỉ hiện với nguồn Video) - video quay gì, ai nói, nói về chủ đề gì.",
          "**Yêu cầu edit (prompt)** - nội dung chính gửi AI. **Dùng prompt mẫu…** đổ một prompt có sẵn vào ô (hệ thống hỏi trước khi ghi đè), **Quản lý prompt** mở trang Prompts.",
          "**Style Design** - màu, font, logo mà video bắt buộc tuân theo 100%, thắng mọi quy định màu/font trong skill hay prompt. **Mặc định** là style mặc định của hệ thống.",
          "**Skill dùng để edit** - quy trình edit đã lưu sẵn. **Để AI tự chọn** thì AI đọc mô tả các skill và chọn cái hợp nhất.",
        ],
        tip: "Phần mô tả nguồn và yêu cầu edit quan trọng nhất: viết càng rõ, AI càng ít đoán sai.",
      },
      {
        heading: "Công tắc trong Brief: cắt, phụ đề, key",
        paragraphs: [
          "Mỗi công tắc là lệnh thật cho AI ở cả hai chiều: bật là bắt buộc làm, tắt là cấm làm, kể cả khi skill gợi ý ngược lại.",
        ],
        bullets: [
          "**Tự động cắt ngắn video** - BẬT: AI cắt khoảng lặng và đoạn thừa (từ đệm, vấp, câu nói lại) trước khi dựng theo **Mức mạnh tay khi cắt**: **Tự nhiên** (chỉ cắt lặng từ 0,9 giây), **Mặc định** (từ 0,45 giây, khuyên dùng) hoặc **Sát** (từ 0,3 giây, nhịp TikTok/Shorts). TẮT: giữ nguyên nhịp, không cắt đoạn nào. Nguồn không có footage thì công tắc này không có tác dụng.",
          "**Tạo phụ đề** - BẬT: phụ đề karaoke khớp lời. TẮT: video không có phụ đề.",
          "**Làm nổi bật key chính** - BẬT: AI tự chọn keyword quan trọng để tô nổi trong phụ đề và chữ; bấm **Chỉ định thêm keyword (tùy chọn)** để bắt buộc thêm từ của bạn. TẮT: không highlight keyword nào.",
          "**Bố cục Key chính / Key liên quan** - BẬT: key chính ở vùng trên video, các key liên quan ở vùng dưới theo nội dung đang nói. Chọn **AI tự đề xuất & sử dụng**, hoặc **Tự chỉ định key** để nhập **Key chính** (AI dùng nguyên văn) và **Key liên quan** (AI bắt buộc dùng đủ). TẮT: không có dải key.",
        ],
      },
      {
        heading: "Công tắc trong Brief: ảnh, phong cách, âm thanh",
        bullets: [
          "**Ảnh minh họa AI (Gemini)** - BẬT: Claude chọn các ý chính, AI vẽ minh họa theo Style Design rồi ghép vào (khoảng $0.05/ảnh); chỉnh thêm **Model vẽ**, **Mật độ ảnh (mỗi phút video)** (bỏ trống là AI tự quyết), **Vị trí chủ thể trong ảnh** và **Ảnh có chữ (Gemini tự vẽ chữ vào ảnh)**. TẮT: cấm hẳn ảnh do AI sinh, hệ thống từ chối mọi yêu cầu tạo ảnh minh họa cho video này.",
          "**Phong cách dựng** - BẬT và chọn một phong cách: video dùng chất liệu và chuyển động của phong cách đó (giấy gấp, mực tàu…), thắng skill ở phần hình ảnh, còn Style Design vẫn giữ màu và font. TẮT (mặc định): dựng đúng theo skill và Style Design. Bật mà chưa chọn phong cách nào thì vẫn như tắt.",
          "**Sound effect** - **Dùng bộ đề xuất** (chỉ dùng các sound được đánh dấu đề xuất trong thư viện), **AI tự tìm trong thư viện** (tự chọn trong toàn bộ thư viện Sound Effects), hoặc **Không dùng**.",
          "**Nhạc nền** - **AI tự chọn theo mood**: AI chọn một bài trong thư viện nhạc và tự giảm âm lượng khi có lời. **Không dùng**: video không có nhạc nền.",
        ],
        warning:
          "Ảnh minh họa cần ít nhất một nhà cung cấp tạo ảnh (Gemini API key, tài khoản ChatGPT hoặc cookie Gemini ở trang **Kết nối**). Thiếu hết thì AI bỏ qua phần minh họa.",
      },
      {
        heading: "AI làm tới đâu",
        paragraphs: [
          "Khối **Bắt đầu & thao tác** là nơi giao việc cho AI. Trước khi bắt đầu, chọn điểm dừng ở **AI làm tới đâu**:",
        ],
        bullets: [
          "**AI dựng nháp, tôi duyệt** - AI dừng ở bản nháp đã QC. Ô **Bản nháp sẵn sàng** hiện ra với **Mở trình chỉnh sửa** để xem và sửa tay, và **Xuất final** khi bạn đã ưng.",
          "**AI làm trọn tới final** - AI tự dựng, kiểm tra rồi render luôn bản final, không chờ bạn duyệt.",
        ],
      },
      {
        heading: "Bắt đầu edit bằng AI",
        steps: [
          "Bấm **Bắt đầu edit bằng AI** (đã có phiên trước đó thì nút là **Bắt đầu Edit bằng AI với phiên mới**).",
          "Kiểm tra bảng tóm tắt: nguồn, yêu cầu edit, các công tắc, Style Design, Skill và sound effect.",
          "Chọn model và **Chế độ** (**Nhanh**, **Chuẩn** hoặc **Sâu**); thêm **Dặn dò thêm lần này** nếu cần.",
          "Bấm **Bắt đầu edit**, rồi theo dõi AI trong panel **AI của project** bên phải.",
        ],
        tip: "Mỗi lần bấm là một phiên mới và tốn token. Chỉ cần sửa vài chỗ trên bản đã có thì dùng **Duyệt bản draft** - nhanh và rẻ hơn nhiều.",
      },
      {
        heading: "Panel AI của project",
        paragraphs: [
          "Panel bên phải hiện cuộc trò chuyện với AI: từng bước nó đang làm (đọc file, chạy lệnh, dùng skill), trạng thái và thời gian chạy. Gõ vào ô chat để dặn thêm giữa chừng, bấm **Dừng** để dừng phiên.",
          "Ô chọn phía trên cho xem lại các phiên cũ. Công tắc **Tự chạy tiếp** cho phiên bị lỗi hoặc gián đoạn tự chạy lại; phiên bạn tự bấm dừng thì không tự chạy lại.",
        ],
      },
      {
        heading: "Render và các thao tác tay",
        bullets: [
          "**Render final** - xuất video hoàn chỉnh chất lượng cao vào thư mục outputs. Bị chặn nếu chưa có lượt lắp draft thành công, hoặc QC chưa chạy, đã cũ hay còn mục không đạt.",
          "**Xem thêm** › **Render scene draft** - render nháp các scene.",
          "**Xem thêm** › **Lắp ráp draft** - ghép bản draft toàn bài.",
          "**Xem thêm** › **Xóa file rác** - dọn scene render, frame kiểm tra và bản draft cũ để lấy lại dung lượng; file nguồn và video final được giữ.",
        ],
        warning:
          "Một lượt final tốn hàng chục phút máy chạy. Chỉ bấm khi đã xem draft thật kỹ và QC đã đạt.",
      },
      {
        heading: "Duyệt bản draft",
        steps: [
          "Phát bản draft trong card **Duyệt bản draft**, dừng ở chỗ cần sửa.",
          "Bấm **Ghim tại** (kèm mốc giờ đang xem), gõ việc cần sửa rồi bấm **Thêm**.",
          "Lặp lại cho mọi chỗ cần sửa; điền **Ghi chú thêm (tùy chọn)** nếu muốn dặn chung.",
          "Bấm **Gửi cho AI sửa** - AI nhận cả loạt ghi chú kèm mốc giờ và chỉ sửa đúng những chỗ đó.",
        ],
        paragraphs: [
          "Bấm mốc giờ của một ghi chú để tua video tới đúng chỗ. Ghi chú có trạng thái **Đang mở**, **Đã gửi** hoặc **Đã xong**; các nút cạnh ghi chú để sửa, đánh dấu đã xong hoặc xóa.",
        ],
        warning: "Không gửi được ghi chú khi phiên AI của project đang chạy - đợi phiên đó xong đã.",
      },
      {
        heading: "Cắt short và tái chế tỉ lệ",
        paragraphs: [
          "**Cắt short từ video dài**: đặt **Số clip**, **Ngắn nhất (giây)**, **Dài nhất (giây)** rồi bấm **Gợi ý clip**. AI đọc transcript, chấm điểm từng đoạn trên thang 10; tích đoạn muốn lấy rồi bấm **Tạo project** - mỗi đoạn thành một project riêng.",
          "**Tái chế tỉ lệ khung**: chọn 9:16, 16:9, 1:1 hoặc 4:5 rồi bấm **Tạo bản tái chế**. Project mới mang toàn bộ scene và asset sang khung mới để AI dựng lại bố cục; tỉ lệ trùng project hiện tại bị khóa.",
        ],
        tip: "Tích **Chạy AI edit luôn** để AI bắt tay dựng ngay sau khi tạo (tối đa 3 project chạy ngay). Gợi ý clip cần transcript, nên project phải qua edit bằng AI trước; project gốc không bị đụng tới.",
      },
      {
        heading: "Cột kết quả",
        bullets: [
          "**Video output** - thành phẩm mới nhất. Khi AI đang dựng, khối này là thanh tiến trình; xong thì video tự hiện, có nút phóng to và nút mở file.",
          "**Scenes** - danh sách scene, nguồn, độ dài (frame) và đã render hay chưa. Bấm tên scene để xem bản render, **Draft scene này** để render nháp riêng scene đó.",
          "**Renders** - các file render đã sinh ra trong lúc dựng.",
          "**Cắt tự động** (chỉ hiện khi project đã được cắt) - thời lượng trước và sau, đã bỏ bao nhiêu, chỗ chết còn lại và kết luận **Đạt** hay **Chưa đạt**.",
        ],
      },
      {
        heading: "QC tự động",
        paragraphs: [
          "Bấm **Chạy QC** để đo bản draft bằng ffmpeg (mất 1-2 phút): âm lượng, clipping, frame đen, đứng hình, đuôi im lặng, lệch tiếng và hình. Mỗi mục có kết quả **Đạt**, **Cảnh báo** hoặc **Không đạt**.",
          "Chữ có lọt vào vùng bị giao diện nền tảng che hay không thì máy không tự kết luận được: bấm **Mở ảnh vùng bị che** và tự soi vùng khoanh đỏ.",
        ],
        warning:
          "Còn mục **Không đạt**, hoặc kết quả đã cũ vì video vừa render lại, thì **Render final** bị chặn. Sửa xong rồi bấm **Đo lại**.",
      },
      {
        heading: "Thumbnail và Gói xuất bản",
        paragraphs: [
          "**Tạo thumbnail**: nhập **Title trên thumbnail** (4-8 từ), **Cắt frame tại giây** và **Prompt nền (tùy chọn)**. Hệ thống cắt khung hình từ video, Gemini vẽ nền theo Style Design rồi ghép tiêu đề, mất khoảng 1 phút.",
          "Không có Gemini API key thì vẫn tạo được ảnh bìa, chỉ là nền gradient đơn giản theo style. Tạo lại sẽ ghi đè ảnh bìa cũ.",
          "**Gói xuất bản**: bấm **Tạo gói xuất bản** để AI soạn tiêu đề, mô tả, hashtag riêng cho TikTok, YouTube, Facebook, kèm phụ đề **Tải .srt** và **Tải .vtt**. Mỗi phần có nút copy để dán thẳng lên nền tảng.",
        ],
        tip: "Gói xuất bản cần transcript, nên phải chạy edit bằng AI trước. **Soạn lại** thay toàn bộ nội dung cũ - copy phần muốn giữ trước khi bấm.",
      },
    ],
  },

  editor: {
    title: "Trình chỉnh sửa video",
    summary:
      "Xem trước video ngay trong trình duyệt và sửa timeline bằng tay hoặc nhờ AI: scene, layer, highlight, karaoke, phụ đề, sound effect, giọng đọc và nhạc nền.",
    blocks: [
      {
        heading: "Trình chỉnh sửa làm gì",
        paragraphs: [
          "Bấm **Mở trình chỉnh sửa** ở trang project. Trình phát chạy đúng bản lắp ráp của video ngay trong trình duyệt, nên bạn xem trước tức thì mà không phải chờ render.",
          "Mọi thao tác, tay hay nhờ AI, ghi thẳng vào timeline của project - cũng là chỗ AI đọc khi dựng. Trình duyệt chỉ xem trước; muốn ra file MP4 vẫn phải render qua Render Queue.",
        ],
      },
      {
        heading: "Bố cục",
        bullets: [
          "Thanh trên: nút **Project** về trang project, tên project, trạng thái lưu, **Hoàn tác** và **Làm lại**, tiến trình render, **Giao cho AI**, **Render draft**, **Xuất video** và menu **Thêm**.",
          "**Thư viện** (bên trái, gập được) với bốn tab **Project**, **SFX**, **Nhạc**, **AI**.",
          "Trình phát ở giữa, kèm nút phát và đồng hồ phút:giây.khung hình - số sau dấu chấm là khung hình trong giây, không phải phần trăm giây.",
          "**Thuộc tính** (bên phải) - sửa phần tử đang chọn.",
          "**Timeline** (bên dưới) - kéo mép trên để đổi chiều cao, thu phóng bằng các nút ở góc hoặc Ctrl + lăn chuột.",
          "Chat **AI chỉnh sửa** nằm ở panel bên phải của ứng dụng.",
        ],
        tip: "Thanh điều hướng trái tự thu gọn khi vào trình chỉnh sửa và trở lại như cũ khi bạn rời trang.",
      },
      {
        heading: "Các track trên timeline",
        bullets: [
          "**Video** - các scene nối tiếp nhau: footage, ảnh tĩnh, scene HyperFrames hoặc file render. Vùng chồng giữa hai scene là chuyển cảnh mờ chồng.",
          "**Layer** - chữ, khối màu, ảnh, video chồng lên trên; nhiều layer cùng lúc xếp thành nhiều làn.",
          "**Highlight** - thẻ key nổi bật (key chính hoặc key phụ).",
          "**Karaoke** - phụ đề karaoke chạy từng từ theo giọng.",
          "**Phụ đề** - phụ đề thường theo dòng.",
          "**Hiệu ứng âm** - sound effect đặt tại từng thời điểm.",
          "**Giọng đọc** - chạy suốt video và là xương sống đồng bộ; muốn đổi giọng thì nhờ AI ở khung chat.",
          "**Nhạc nền** - một bài nhạc, tự hạ âm lượng dưới giọng đọc.",
        ],
        paragraphs: [
          "Nút + ở cột tên các track **Layer**, **Highlight**, **Karaoke**, **Phụ đề** thêm phần tử mới tại playhead. Bấm hoặc kéo trên thước giờ để tua.",
        ],
      },
      {
        heading: "Sửa trên timeline và khung xem trước",
        bullets: [
          "Bấm một khối để chọn, kéo để dời, kéo mép để cắt. Kéo scene trong track **Video** để đổi thứ tự.",
          "Khi kéo, khối tự hít vào playhead và mép phần tử khác; giữ Alt để tắt hít.",
          "**Tách tại playhead (S)** tách scene footage/ảnh hoặc cue đang chọn làm hai. **Nhân bản (Ctrl+D)** và **Xóa (Delete)** cũng có trong bảng **Thuộc tính**.",
          "Bấm thẳng vào chữ hay hình trên trình phát để chọn: kéo để dời (Shift khóa trục), kéo góc để đổi cỡ, kéo tay xoay để xoay (Shift xoay theo bước 15°). Nhấp đúp vào chữ để sửa nội dung.",
        ],
        warning:
          "Video phải còn ít nhất một scene. Footage không cắt dài quá độ dài file, và scene HyperFrames không dài quá bản render của nó.",
      },
      {
        heading: "Bảng Thuộc tính",
        bullets: [
          "**Scene** - nguồn, **Điểm vào** và **Điểm ra**, **Độ dài**, **Tắt tiếng gốc**, âm lượng, tốc độ, chuyển cảnh sang scene sau, **Zoom (punch-in)**, khung hình (cắt, lật, vừa khung) và màu (preset, độ sáng, tương phản…).",
          "**Layer** - nội dung và kiểu chữ hoặc khối màu, vị trí, cỡ, xoay, độ mờ đục, hiệu ứng vào/ra, và keyframe để layer chuyển động mượt giữa các mốc.",
          "**Phụ đề karaoke** - sửa **Cả câu** hoặc từng từ, mốc thời gian của từ, đánh dấu **Từ nhấn**.",
          "**Phụ đề** - nội dung (Enter để xuống dòng) và kiểu phụ đề áp cho cả track.",
          "**Thẻ highlight** - nhãn nhỏ phía trên, các mẩu chữ có tô màu nhấn, cấp **Key chính** hoặc **Key phụ**, màu nhấn **Nóng** hoặc **Lạnh**.",
          "**Hiệu ứng âm** - file, **Phát lúc**, âm lượng, **Bỏ qua đầu file**. **Nhạc nền** - âm lượng lúc không có lời và lúc đang có lời.",
        ],
        tip: "Karaoke, phụ đề và highlight có nút áp vị trí, cỡ cho mọi cue cùng loại (vd **Áp dụng cho mọi câu karaoke**) - đỡ phải chỉnh từng cái.",
      },
      {
        heading: "Thư viện",
        paragraphs: [
          "Tab **Project** là file của project; **SFX** và **Nhạc** là thư viện dùng chung, tìm theo tên và lọc theo tag. Bấm một mục để xem hoặc nghe thử.",
          "Kéo một mục lên timeline, hoặc bấm **Thêm tại playhead**. Ảnh và video còn có **Thêm làm layer tại playhead**, nhạc có **Đặt làm nhạc nền**. Bấm **Tải lên** hoặc kéo file từ máy vào trình chỉnh sửa để thêm file mới vào project.",
          "Tab **AI** tạo ảnh mới từ mô tả theo Style Design của project, rồi **Thêm làm layer** hoặc **Chèn làm cảnh trám** (scene ảnh 3 giây tại playhead).",
        ],
      },
      {
        heading: "Tạo bằng AI tại một mốc",
        steps: [
          "Chuột phải vào timeline tại mốc muốn chèn, hoặc nhấn G (tại mốc dưới con trỏ; không rê chuột trên timeline thì tại playhead).",
          "Chọn **Tạo gì**: **Ảnh** (ảnh AI chồng lên video 3 giây), **Cảnh trám** (scene ảnh 3 giây chèn vào, phần sau lùi lại), **Chữ** (AI viết một dòng từ lời thoại quanh mốc thành layer chữ), hoặc **Nhờ AI** (giao cho chat kèm mốc giờ).",
          "Gõ **Yêu cầu** rồi nhấn Enter, hoặc bấm **Tạo** / **Gửi cho AI**.",
        ],
        tip: "Trong lúc tạo, timeline có dấu đánh dấu mốc đang chờ. Bấm vào dấu để thôi chờ - ảnh vẫn vào thư viện project khi xong.",
      },
      {
        heading: "Phím tắt",
        bullets: [
          "Space - phát / tạm dừng.",
          "← / → - lùi / tiến 1 khung hình; Shift + ← / → - lùi / tiến 1 giây; Home / End - về đầu / về cuối.",
          "Alt + ← / → - dời scene đang chọn sớm hơn / muộn hơn.",
          "S - tách tại playhead; Delete hoặc Backspace - xóa phần tử đang chọn; Esc - bỏ chọn.",
          "Ctrl + D - nhân bản; Ctrl + C / Ctrl + V - sao chép / dán tại playhead; Ctrl + ] / Ctrl + [ - đưa layer lên / xuống một lớp.",
          "Ctrl + Z - hoàn tác; Ctrl + Shift + Z hoặc Ctrl + Y - làm lại.",
          "Ctrl + lăn chuột - thu phóng timeline; giữ Alt khi kéo - tắt hít; chuột phải hoặc G - tạo bằng AI tại mốc.",
          "? - mở bảng **Phím tắt** (cũng có trong menu **Thêm**).",
        ],
        tip: "Trên Mac dùng ⌘ thay cho Ctrl. Phím tắt không chạy khi bạn đang gõ trong một ô nhập.",
      },
      {
        heading: "Khóa track",
        paragraphs: [
          "Bấm biểu tượng ổ khóa ở cột tên track để khóa: track khóa không kéo, sửa, xóa hay thêm vào được, nhưng vẫn bấm chọn để xem. Bấm lại để mở khóa.",
          "Khóa là tiện ích riêng của bạn trên trình duyệt này, được nhớ theo project và không ràng buộc AI.",
        ],
      },
      {
        heading: "Tự lưu, xung đột và lịch sử",
        paragraphs: [
          "Trình chỉnh sửa tự lưu khoảng 0,7 giây sau thay đổi cuối. Badge trên thanh trên báo **Đã lưu**, **Đang lưu…**, **Chưa lưu** hoặc **Lỗi lưu** (kèm nút **Lưu lại**).",
          "AI hoặc một tab khác đổi timeline trong lúc bạn còn thay đổi chưa lưu thì banner xung đột hiện ra: chọn **Giữ bản của tôi** để ghi đè, hoặc **Tải bản mới (bỏ thay đổi của tôi)**.",
          "Menu **Thêm** › **Lịch sử phiên bản** giữ trạng thái timeline trước mỗi lần lưu, khôi phục và trước/sau mỗi lượt AI sửa (100 bản gần nhất). Bấm **Khôi phục** để quay về; bản hiện tại cũng được lưu lại nên luôn đổi ý được.",
        ],
        warning:
          "Rời trang khi lần lưu cuối thất bại hoặc đang xung đột sẽ mất thay đổi chưa lưu - hệ thống hỏi lại trước khi cho rời.",
      },
      {
        heading: "Chat AI và Giao cho AI",
        paragraphs: [
          "Panel **AI chỉnh sửa** bên phải nhận yêu cầu sửa bằng lời, ví dụ “dời phụ đề thứ hai sớm 0,5 giây”. Thay đổi hiện ngay trong trình phát, và AI không tự render trừ khi bạn yêu cầu; **Cuộc trò chuyện mới** bắt đầu lại từ đầu.",
          "**Giao cho AI** dành cho việc lớn: AI đọc lại timeline đã chỉnh, giữ nguyên chỉnh sửa tay của bạn và làm tiếp theo **Yêu cầu**, dừng ở **Bản nháp, tôi duyệt** hoặc **Làm trọn tới final**.",
          "Xong việc, banner **AI đã chỉnh xong** cho chọn **Giữ**, **Hoàn tác** (về đúng bản trước khi giao) hoặc **Xem lịch sử**.",
        ],
        warning:
          "Trong lúc AI đang sửa project, trình chỉnh sửa chỉ xem: không kéo, sửa hay thêm được, còn thay đổi của AI hiện ngay trong trình phát. Đợi AI xong rồi sửa tiếp.",
      },
      {
        heading: "Render và xuất file",
        paragraphs: [
          "**Render draft** lưu thay đổi rồi xếp bản nháp nhanh vào hàng đợi; chỉ scene HyperFrames còn thiếu bản render mới phải render lại. Thanh trên hiện tiến trình, xong thì có nút **Xem bản draft**.",
          "**Xuất video** render bản final, cần một lượt draft thành công trước đó và QC đạt. QC chưa chạy hoặc đang lỗi thì bạn có thể bấm **Vẫn render final** nếu đã chắc chắn.",
          "Menu **Thêm** › **Xuất XML (Premiere/DaVinci)** tải file timeline mở được bằng Premiere Pro hoặc DaVinci Resolve. Đường dẫn media trong file trỏ tới máy này, mở ở máy khác phải liên kết lại.",
        ],
        tip: "Bản render đang chạy không có những thay đổi bạn sửa sau khi nó bắt đầu - đợi nó xong rồi render lại.",
      },
    ],
  },
};

export const en: Pick<GuideContent, Ids> = {
  overview: {
    title: "Getting started",
    summary:
      "AI Edit Video is an automated editing desk: you bring footage or an idea, the AI builds a finished video, and you follow along, tweak and approve it right here.",
    blocks: [
      {
        heading: "What the app does",
        paragraphs: [
          "Claude acts as the director: it reads the edit brief you write, builds each motion scene (kinetic text, karaoke captions, graphics) with HyperFrames, then assembles scenes, footage, voice, music and sound effects into the final video with Remotion.",
          "The web interface is for watching, managing and editing. Video encoding always runs on the server behind it, even when you hit render inside the editor.",
        ],
      },
      {
        heading: "Three rules worth remembering",
        bullets: [
          "Every project has one meta.json file that is the single source of truth for its timeline. The AI, the editor and you all edit that same file, so a change made anywhere shows up everywhere.",
          "A draft always comes before the final. Drafts render fast at low quality so you can spot problems; finals are slow and heavy, so only run one once the draft looks right.",
          "Every render goes through the **Render Queue** and runs in turn, including renders the AI starts itself. Check there to see what the machine is busy with.",
        ],
      },
      {
        heading: "Your first video",
        steps: [
          "Open **Videos Project**, click **Create project**, give it a name, then pick a **Video format** and FPS.",
          "On the project page, choose a source type in the **Video source** card: upload footage to **Sources & Assets** (or scan a QR code from your phone), paste an article link, or describe what you want in text.",
          "Fill in the **Edit script (Brief)**: write the **Edit request (prompt)**, flip the feature switches and pick a **Style Design**.",
          "Choose **How far the AI goes**, click **Start editing with AI**, check the summary and click **Start editing**. You can watch the AI work in the panel on the right.",
          "Once a draft exists, watch it under **Video output**, then fix it by hand with **Open editor** or pin notes in **Review draft** for the AI to fix.",
          "Run **Automatic QC**, and once it passes click **Render final**. The finished MP4 lands in the outputs folder.",
        ],
      },
      {
        heading: "The left navigation",
        paragraphs: ["Items follow the order you usually work in, top to bottom:"],
        bullets: [
          "**Dashboard** and **Videos Project** - the overview and where most videos get made.",
          "**Images Project**, **Auto cut videos**, **Text to video**, **Translate video**, **Voices** - standalone content tools.",
          "**Style Design** and **Edit styles** - your brand identity (colors, fonts, logo) and the visual language of each video.",
          "**Render Queue**, **Assets**, **Sound Effects**, **Prompts**, **Skills** - the render queue and the shared libraries.",
          "**Settings** and **Connections** - render speed, API keys and service sign-ins.",
        ],
        tip: "**Collapse menu** at the top of the bar shrinks it to icons only, and the choice is remembered. The bar also collapses on its own inside the video editor to give the player more room.",
      },
      {
        heading: "The Guide button",
        paragraphs: [
          "Click **Guide** in the top bar on any page and this panel opens at the section for the page you are on. It does not cover the page, so you can read and follow along at the same time; switch pages and the section follows.",
          "Click the section name at the top of the panel to open the menu and jump elsewhere - the section for the current page is tagged **This page**. When you are reading another section, **Back to this page** takes you back.",
          "**Previous** and **Next** at the bottom let you read the whole guide in order.",
        ],
      },
      {
        heading: "The top bar",
        bullets: [
          "The **CPU** and **GPU** meters show how hard the machine is working and change to a warning color above 85%. Hover for the chip name and VRAM; GPU only appears when a measurable graphics card is present.",
          "The status dot is green for **Backend online**; a warning color means the backend is missing components or cannot be reached.",
          "The flag button switches the interface between Vietnamese and English.",
          "The sun/moon button switches between light and dark themes. Light is the default, and your choice is remembered in this browser.",
          "Pages with AI (such as a project page) have an AI panel on the right that folds down to a thin strip. On narrow screens, open it with the **AI panel** button in this bar.",
        ],
      },
      {
        heading: "The update badge",
        paragraphs: [
          "The badge at the bottom of the left bar shows the running version: **Up to date** means you are current, **New version** means a new release is out, **Check failed** means the check did not go through. It checks automatically every 5 minutes.",
          "Click the badge to read **What's new**, then click **Update now**. The system shuts down, pulls the new version and restarts in about 1-3 minutes, and the page reloads itself when it is done.",
        ],
        tip: "By default you only receive official releases. To get the latest unreleased changes too, switch the update channel on the **Settings** page.",
        warning:
          "You cannot update while a render job is running - wait for it to finish. During the update, do not shut down the computer or close the window.",
      },
    ],
  },

  dashboard: {
    title: "Dashboard",
    summary:
      "The overview of the whole system: how many projects you have, what the machine is doing, and how many tokens and dollars the AI is using. It is for looking only - no video is built here.",
    blocks: [
      {
        heading: "Warning banners at the top",
        paragraphs: [
          "If a key component is missing (FFmpeg, Claude sign-in, HyperFrames), a banner headed **The system is missing required components:** lists each one. While it is there, renders or AI sessions will fail.",
          "The failed-jobs banner counts today's failed jobs and shows the project, job type and time of the most recent ones.",
        ],
        bullets: [
          "**View queue** - opens the Render Queue so you can read the error logs.",
          "**Clear from dashboard** - hides the banner on the Dashboard only; the failed jobs and logs stay in the Render Queue, and new failures still show up again.",
        ],
      },
      {
        heading: "The five stat tiles",
        bullets: [
          "**Total projects** - the number of video projects, plus how many are done.",
          "**Exported videos** - how many projects have an output video.",
          "**Tokens, 30 days** - total AI tokens over the last 30 days and what they cost.",
          "**Jobs today** - jobs created today, with how many finished and how many failed.",
          "**Queue** - jobs waiting to run.",
        ],
        tip: "Click a tile to jump straight to the matching list (Videos Project or Render Queue). The token tile is the only one that is not clickable.",
      },
      {
        heading: "The AI tokens by day chart",
        paragraphs: [
          "Bars show total tokens per day, and the lines show tokens per AI (Claude, Gemini, OpenAI). An AI that used no tokens gets no line.",
          "Pick **7 days**, **30 days** or **90 days**, and filter by project type: **All**, **Video** or **Images**. The line above the chart gives total tokens, total cost, tokens in and tokens out for that range.",
        ],
      },
      {
        heading: "The right-hand column",
        bullets: [
          "**AI working** only appears while an AI session is running: each line says what the AI is doing and which step it is on, with **Open project →** to jump there.",
          "**Running job** lists render jobs in progress with a progress bar and the current step. Click a name to open the right project (or the right Auto cut, Text to video, Translate video or Images Project session).",
        ],
      },
      {
        heading: "AI cost by model",
        paragraphs: [
          "This table splits the money you actually paid by AI and model: **Tokens in**, **Tokens out**, **$ in**, **$ out** and **Total $**. It shares the chart's day range but always covers every project type.",
          "Tokens the AI writes usually cost about 5 times more than tokens it reads, and content it has already read is billed much cheaper when read again. Models without a price table show a dash in the two $ cells, but the money is still counted in full under **Total $**.",
        ],
      },
      {
        heading: "Recent projects and recent AI sessions",
        paragraphs: [
          "**Recent projects** lists the 5 most recently edited projects with their status and token use. Click a name to open it, or **View all →** to go to Videos Project.",
          "**Recent AI sessions** shows the 5 latest chat sessions, each with **Open project →** to get back to the right project.",
        ],
        tip: "If renders feel unusually slow, glance at the **CPU** and **GPU** meters in the top bar: a bar in the warning color means the machine is maxed out, so lower the number of parallel jobs on the **Settings** page.",
      },
    ],
  },

  projects: {
    title: "Videos Project",
    summary:
      "The list of every video you are working on. Each project is one video with its own size, FPS, edit brief and renders.",
    blocks: [
      {
        heading: "Create a project",
        steps: [
          "Click **Create project** in the top-right corner.",
          "Type a **Name**. The **ID (folder name)** is generated from it; you can change it, but only lowercase letters, numbers and hyphens are allowed (e.g. my-video-1).",
          "Add **Tags** if you want to group projects for filtering later (type a tag and press Enter).",
          "Pick a **Video format**: **TikTok/Reels vertical** (1080×1920), **YouTube landscape** (1920×1080), **Square**, **Portrait 4:5**, **Landscape 4K**, **Portrait 4K**, or **Custom** to enter your own **Width (px)** and **Height (px)**.",
          "Pick 24, 25, 30 or 60 FPS (30 by default), or **Other** to type your own value.",
          "Click **Create project** - the new project's page opens right away.",
        ],
        tip: "Get the frame size right from the start. If you later need another aspect ratio of the same content, use **Repurpose aspect ratio** on the project page instead of starting over.",
      },
      {
        heading: "Reading the list",
        paragraphs: ["Click any row to open that project. The columns are:"],
        bullets: [
          "**Name** with the ID. Projects created by Text to video carry a **From Text to video** tag that takes you back to that session.",
          "**Size** - frame size and FPS.",
          "**Status** - **Draft**, **Rendering** or **Done**.",
          "**AI tokens** - how many tokens the project has used; hover for the exact count and cost.",
          "**Created** and **Updated**.",
        ],
      },
      {
        heading: "Search and filter",
        paragraphs: [
          "Type in **Search projects by name or ID…** to filter as you type.",
          "When projects have tags, a row of tag chips appears above the table. Click one or more tags to show only projects carrying them, or **All** to clear the filter; clicking a tag chip inside a row filters by it too.",
        ],
      },
      {
        heading: "Rename and clone",
        paragraphs: [
          "The pencil button at the end of a row changes the project's display name; the ID (folder name) stays the same.",
          "The clone button creates a new project with the compositions, assets and their descriptions, brief, tags and scenes - but not the renders or output video. The copy starts as a draft, with an ID generated from the new name.",
        ],
      },
      {
        heading: "Bulk actions",
        paragraphs: [
          "Tick the box at the start of a row (or the one in the header to select every visible project) and the bulk action bar appears:",
        ],
        bullets: [
          "**Clean junk files** - removes old drafts, temporary frames and intermediate files from renders to reclaim disk space. You get a confirmation with the space to be freed; final videos and source files are kept.",
          "**Delete selected** - permanently deletes the folders of the selected projects.",
          "**Render final** (with the number selected) - queues a final render for each project, one after another. Projects that are not ready (no draft yet, QC not passed) are reported and skipped while the rest still run.",
          "**Create video** (with the number selected) - opens **Create videos with AI**: the AI builds each project in parallel from its saved brief, and **Extra notes (applied to all)** goes to the whole batch.",
        ],
        tip: "Bulk creation spends real tokens on every project, and each project gets its own AI session - to stop them you have to open each project.",
      },
      {
        heading: "Deleting projects",
        paragraphs: [
          "Select the projects and click **Delete selected**. The confirmation lists what will be removed and only enables the delete button once you type DELETE exactly.",
        ],
        warning:
          "Deleting a project removes its whole folder for good, assets and renders included. If you want to keep a copy, clone it first.",
      },
    ],
  },

  "project-detail": {
    title: "Project page",
    summary:
      "Where a single video is made from start to finish: add the source, write the edit brief, hand the work to the AI, review the draft, check quality and publish.",
    blocks: [
      {
        heading: "Page layout",
        paragraphs: [
          "The header shows the project name (click the pencil to rename it), size, FPS and the 6-stage bar: **Analyze**, **Build scenes**, **Render draft**, **Assemble draft**, **Render final**, **Done**. A pulsing dot means something is running in the background.",
          "On the right are **Project list**, **Open editor** and **Delete**. The strip below shows the status, ID, a **Clone** button and the tag row - click the plus to add a tag and press Enter to save it.",
          "The main area has three columns that follow your workflow: **Source**, **Request & setup**, **Progress & output**. Every block folds open and shut, and once the project is done the input blocks collapse on their own.",
        ],
      },
      {
        heading: "Video source",
        paragraphs: ["The **Video source** card decides what the video is built from:"],
        bullets: [
          "**Video** - the AI edits the footage you upload under **Sources & Assets**: cuts, captions, keys, effects.",
          "**Article link** - paste a link and click **Fetch** to preview what the AI will use; if you skip it, the AI fetches the article when the edit starts. If the site blocks bots, switch to **Request** and paste the text instead.",
          "**Request** - type a topic, script or pasted content into **Request / content**. The AI will not invent figures you did not give it.",
        ],
        tip: "The two footage-free types (**Article link** and **Request**) produce motion graphics videos: kinetic text, figures and illustrations.",
      },
      {
        heading: "Without footage: illustrations and voice-over",
        bullets: [
          "**Insert AI illustrations** - ON: AI images are the video's main visuals. OFF: the AI only uses text, graphics and images you already have. This is the same switch as **AI illustrations (Gemini)** in the Brief.",
          "**Voice-over** - ON: the voice becomes the video's timeline and karaoke captions follow it. OFF: the video has only text and music.",
          "With voice-over on, choose **AI voice** (the AI writes a narration from the source, read in exactly the voice you pick - it cannot swap voices) or **Recorded file** (pick or **Upload** your own recording, and the video follows what is said in it).",
        ],
      },
      {
        heading: "Sources & Assets",
        paragraphs: [
          "Drag videos, images and audio onto the **Sources & Assets** card, or click **Upload**. Audio and other files are split out into the **Sound Effects** and **Other** blocks below.",
          "Each file has a **Description for the AI** field - the AI reads exactly that line to decide when to use the file. Files without one are tagged **Not described**.",
          "Videos have a **Color grade** button: pick a tile under **Color templates**, drag the **Adjust** sliders, hold **Compare with original** to compare, then click **Save selection**. The AI applies exactly that look to the whole video when it edits.",
          "**Connect phone** shows a QR code: scan it with your phone camera to send videos and photos straight into the project. The phone must be on the same WiFi as this computer; to use 4G/5G, click **Turn on Internet (Cloudflare Tunnel)**.",
        ],
        warning:
          "The QR link only works while the QR window is open, and you should keep the phone screen on while uploading large files. Deleting an asset deletes the real file in the project and cannot be undone.",
      },
      {
        heading: "Edit script (Brief)",
        paragraphs: [
          "The brief is what the AI reads before it builds anything. It saves itself once you stop typing and is reused by every later edit session.",
        ],
        bullets: [
          "**Describe the source video** (only for the Video source) - what was filmed, who speaks, what it is about.",
          "**Edit request (prompt)** - the main instruction to the AI. **Use a prompt template…** fills in a saved prompt (you are asked before anything is overwritten), and **Manage prompts** opens the Prompts page.",
          "**Style Design** - the colors, fonts and logo the video must follow 100%, overriding any color or font rules in skills and prompts. **Default** is the system's default style.",
          "**Skill used for editing** - a saved editing workflow. With **Let the AI choose**, the AI reads the skill descriptions and picks the best fit.",
        ],
        tip: "The source description and the edit request matter most: the clearer they are, the less the AI has to guess.",
      },
      {
        heading: "Brief switches: trimming, captions, keys",
        paragraphs: [
          "Every switch is a real instruction in both directions: on means the AI must do it, off means it must not, even if a skill suggests otherwise.",
        ],
        bullets: [
          "**Auto-trim the video** - ON: the AI removes silences and filler (ums, stumbles, repeated takes) before building, using **How aggressive the trim is**: **Natural** (only silences from 0.9s), **Default** (from 0.45s, recommended) or **Tight** (from 0.3s, TikTok/Shorts pacing). OFF: the pacing is left alone and nothing is cut. It has no effect on sources without footage.",
          "**Generate subtitles** - ON: karaoke captions synced to the speech. OFF: no captions at all.",
          "**Highlight main keys** - ON: the AI picks the important keywords and makes them stand out in captions and text; click **Specify extra keywords (optional)** to force your own words in too. OFF: nothing is highlighted.",
          "**Main key / related keys layout** - ON: the main key sits in the top area of the video and related keys in the bottom area, following what is being said. Choose **AI proposes & uses keys**, or **Specify keys manually** to enter a **Main key** (used verbatim) and **Related keys** (all of them must be used). OFF: no key bands.",
        ],
      },
      {
        heading: "Brief switches: images, style, sound",
        bullets: [
          "**AI illustrations (Gemini)** - ON: Claude picks the key moments, and the AI draws illustrations in your Style Design and composites them in (about $0.05/image); you can also set the **Drawing model**, **Image density (per minute of video)** (empty = AI decides), **Subject position in the image** and **Text in images (Gemini draws the text itself)**. OFF: AI-generated images are banned outright, and the server refuses any illustration request for this video.",
          "**Edit style** - ON with a style picked: the video takes that style's materials and motion (folded paper, ink wash…), which wins over the skill for visuals while the Style Design still owns colors and fonts. OFF (default): the video follows the skill and Style Design exactly. Switching it on without picking a style behaves like off.",
          "**Sound effect** - **Use the recommended set** (only sounds marked as recommended in the library), **AI searches the library** (anything in the Sound Effects library), or **None**.",
          "**Background music** - **AI picks by mood**: the AI chooses a track from the music library and ducks it under speech automatically. **None**: no background music.",
        ],
        warning:
          "Illustrations need at least one image provider (a Gemini API key, a ChatGPT account or a Gemini cookie on the **Connections** page). Without any, the AI skips the illustrations.",
      },
      {
        heading: "How far the AI goes",
        paragraphs: [
          "The **Start & actions** block is where you hand the work to the AI. Before you start, choose its stopping point under **How far the AI goes**:",
        ],
        bullets: [
          "**AI drafts, I review** - the AI stops at a QC-checked draft. A **Draft ready** box appears with **Open editor** to review and adjust by hand, and **Export final** for when you are happy.",
          "**AI goes all the way to final** - the AI builds, checks and renders the final video itself, without waiting for you.",
        ],
      },
      {
        heading: "Start editing with AI",
        steps: [
          "Click **Start editing with AI** (once a session exists, the button reads **Start AI edit in a new session**).",
          "Check the summary: source, edit request, switches, Style Design, Skill and sound effects.",
          "Choose the model and the **Mode** (**Fast**, **Standard** or **Deep**), and add **Extra notes for this run** if needed.",
          "Click **Start editing**, then follow the AI in the **Project AI** panel on the right.",
        ],
        tip: "Every click starts a new session and costs tokens. To fix just a few spots in an existing cut, use **Review draft** - it is much faster and cheaper.",
      },
      {
        heading: "The Project AI panel",
        paragraphs: [
          "The right panel shows the conversation with the AI: each step it takes (reading files, running commands, using skills), its status and how long it has been running. Type in the chat box to add instructions mid-run, or click **Stop** to end the session.",
          "The selector at the top lets you look back at older sessions. The **Auto-resume** switch restarts a session that failed or was interrupted; sessions you stop yourself are never resumed.",
        ],
      },
      {
        heading: "Renders and manual actions",
        bullets: [
          "**Render final** - exports the full-quality video into the outputs folder. It is blocked until a draft assembly has succeeded, and while QC has not run, is out of date or still has failing checks.",
          "**More** › **Render scene draft** - renders draft versions of the scenes.",
          "**More** › **Assemble draft** - assembles the full draft.",
          "**More** › **Clean junk files** - removes scene renders, check frames and old drafts to free disk space; source files and the final video are kept.",
        ],
        warning:
          "A final render ties up the machine for tens of minutes. Only click it once you have watched the draft carefully and QC has passed.",
      },
      {
        heading: "Review draft",
        steps: [
          "Play the draft in the **Review draft** card and pause where something needs fixing.",
          "Click **Pin at** (with the current timestamp), describe the fix and click **Add**.",
          "Repeat for every spot; fill in **Extra notes (optional)** for anything general.",
          "Click **Send to AI** - the AI gets every note with its timestamp and fixes only those spots.",
        ],
        paragraphs: [
          "Click a note's timestamp to jump the video to that spot. Notes are **Open**, **Sent** or **Done**, and the buttons next to each note let you edit it, mark it done or delete it.",
        ],
        warning: "You cannot send notes while the project's AI session is running - wait for it to finish first.",
      },
      {
        heading: "Shorts and repurposing",
        paragraphs: [
          "**Cut shorts from a long video**: set **Clips**, **Min length (sec)** and **Max length (sec)**, then click **Suggest clips**. The AI reads the transcript and scores each segment out of 10; tick the ones you want and click **Create projects** - each becomes its own project.",
          "**Repurpose aspect ratio**: pick 9:16, 16:9, 1:1 or 4:5 and click **Create repurposed copy**. The new project carries every scene and asset into the new frame so the AI can rebuild the layout; the project's current ratio is disabled.",
        ],
        tip: "Tick **Start AI edit right away** to have the AI start building as soon as the projects are created (at most 3 start immediately). Clip suggestions need a transcript, so run an AI edit first; the original project is never touched.",
      },
      {
        heading: "The output column",
        bullets: [
          "**Video output** - the latest finished video. While the AI is building, this block shows a progress bar; when it is done the video appears on its own, with zoom and open-file buttons.",
          "**Scenes** - every scene with its source, length (frames) and whether it has been rendered. Click a scene name to watch its render, or **Draft this scene** to draft just that scene.",
          "**Renders** - the render files produced while building.",
          "**Auto-trim** (only once the project has been trimmed) - length before and after, what was removed, remaining dead air and a **Passed** or **Not there yet** verdict.",
        ],
      },
      {
        heading: "Automatic QC",
        paragraphs: [
          "Click **Run QC** to measure the draft with ffmpeg (1-2 minutes): loudness, clipping, black frames, frozen sections, silent tails and audio/video drift. Each check comes back as **Pass**, **Warning** or **Fail**.",
          "Whether text falls under the platform's UI is something the machine cannot judge: click **Open covered-zone frame** and check the red zones yourself.",
        ],
        warning:
          "While any check shows **Fail**, or the results are stale because the video was re-rendered, **Render final** stays blocked. Fix the issue, then click **Re-run**.",
      },
      {
        heading: "Thumbnail and Publish pack",
        paragraphs: [
          "**Create thumbnail**: enter a **Thumbnail title** (4-8 words), **Grab frame at second** and, if you like, a **Background prompt (optional)**. The system grabs a frame from the video, Gemini paints a background in your Style Design and the title is composed on top, in about a minute.",
          "Without a Gemini API key you still get a thumbnail, just with a simple gradient background in your style. Creating it again overwrites the old one.",
          "**Publish pack**: click **Create publish pack** and the AI writes a title, description and hashtags for TikTok, YouTube and Facebook, plus **Download .srt** and **Download .vtt** subtitles. Each part has a copy button for pasting straight into the platform.",
        ],
        tip: "The publish pack needs a transcript, so run an AI edit first. **Rewrite** replaces everything, so copy anything you want to keep before clicking it.",
      },
    ],
  },

  editor: {
    title: "Video editor",
    summary:
      "Preview the video right in the browser and edit the timeline by hand or with the AI: scenes, layers, highlights, karaoke, subtitles, sound effects, voice and music.",
    blocks: [
      {
        heading: "What the editor is for",
        paragraphs: [
          "Click **Open editor** on the project page. The player runs the actual assembly of your video in the browser, so you see changes instantly without waiting for a render.",
          "Every change, by hand or by the AI, is written straight into the project's timeline - the same place the AI reads when it builds. The browser only previews; to get an MP4 you still render through the Render Queue.",
        ],
      },
      {
        heading: "Layout",
        bullets: [
          "Top bar: **Project** to go back, the project name, save status, **Undo** and **Redo**, render progress, **Hand off to AI**, **Render draft**, **Export video** and the **More** menu.",
          "**Library** (left, collapsible) with four tabs: **Project**, **SFX**, **Music**, **AI**.",
          "The player in the middle, with playback buttons and a minutes:seconds.frames clock - the number after the dot is the frame within the second, not hundredths.",
          "**Properties** (right) - edit whatever is selected.",
          "**Timeline** (bottom) - drag its top edge to resize it, and zoom with the corner buttons or Ctrl + mouse wheel.",
          "The **AI editor** chat lives in the app's right-hand panel.",
        ],
        tip: "The left navigation collapses automatically when you open the editor and goes back to how it was when you leave.",
      },
      {
        heading: "Timeline tracks",
        bullets: [
          "**Video** - scenes played one after another: footage, still images, HyperFrames scenes or rendered files. The overlap between two scenes is a crossfade.",
          "**Layers** - text, shapes, images and videos stacked on top; layers that overlap in time get their own lanes.",
          "**Highlight** - key cards (main key or sub key).",
          "**Karaoke** - word-by-word karaoke captions that follow the voice.",
          "**Subtitles** - regular line-by-line subtitles.",
          "**Sound effects** - sound effects placed at specific moments.",
          "**Voice** - runs the full length and is the video's sync backbone; ask the AI in the chat to change the voice.",
          "**Music** - one background track that ducks under the voice automatically.",
        ],
        paragraphs: [
          "The + button in the name column of **Layers**, **Highlight**, **Karaoke** and **Subtitles** adds a new item at the playhead. Click or drag on the ruler to seek.",
        ],
      },
      {
        heading: "Editing on the timeline and the preview",
        bullets: [
          "Click a block to select it, drag to move it, drag an edge to trim it. Drag scenes within the **Video** track to reorder them.",
          "While dragging, blocks snap to the playhead and to other items' edges; hold Alt to turn snapping off.",
          "**Split at playhead (S)** cuts the selected footage/image scene or cue in two. **Duplicate (Ctrl+D)** and **Delete (Delete)** are also in the **Properties** panel.",
          "Click text or an image directly in the player to select it: drag to move (Shift locks the axis), drag a corner to resize, drag the rotate handle to rotate (Shift snaps to 15°). Double-click text to edit its words.",
        ],
        warning:
          "The video must keep at least one scene. Footage cannot be trimmed past the length of its file, and a HyperFrames scene cannot run longer than its render.",
      },
      {
        heading: "The Properties panel",
        bullets: [
          "**Scene** - source, **In point** and **Out point**, **Length**, **Mute original audio**, volume, speed, the transition into the next scene, **Zoom (punch-in)**, framing (crop, flip, fit) and color (presets, brightness, contrast…).",
          "**Layer** - text and text style or shape style, position, size, rotation, opacity, in/out animation, and keyframes so the layer moves smoothly between points in time.",
          "**Karaoke caption** - edit the **Whole line** or single words, word timings, and mark an **Emphasized word**.",
          "**Subtitle** - the text (Enter for a new line) and a subtitle style that applies to the whole track.",
          "**Highlight card** - a small label above, text pieces with optional accent marking, a **Main key** or **Sub key** tier, and a **Hot** or **Cool** accent.",
          "**Sound effect** - file, **Plays at**, volume and **Skip start of file**. **Background music** - the volume without speech and the volume under speech.",
        ],
        tip: "Karaoke, subtitles and highlights have a button that copies position and size to every cue of the same kind (e.g. **Apply to every karaoke line**) - no need to adjust them one by one.",
      },
      {
        heading: "The library",
        paragraphs: [
          "The **Project** tab holds the project's own files; **SFX** and **Music** are the shared libraries, searchable by name and filterable by tag. Click an item to preview or listen to it.",
          "Drag an item onto the timeline, or click **Add at playhead**. Images and videos also offer **Add as a layer at the playhead**, and music offers **Use as background music**. Click **Upload** or drag files from your computer into the editor to add new files to the project.",
          "The **AI** tab generates a new image from a description in your project's Style Design, then lets you **Add as layer** or **Insert as filler scene** (a 3-second image scene at the playhead).",
        ],
      },
      {
        heading: "Create with AI at a point in time",
        steps: [
          "Right-click the timeline where you want something, or press G (at the point under the pointer; when the pointer is not over the timeline, at the playhead).",
          "Choose **What to create**: **Image** (an AI image over the video for 3 seconds), **Filler** (a 3-second image scene inserted, pushing the rest later), **Text** (the AI writes one line from the speech around that point as a text layer), or **Ask AI** (hands the job to the chat with the timestamp).",
          "Type your **Request** and press Enter, or click **Create** / **Send to AI**.",
        ],
        tip: "While it works, a marker sits on the timeline at that point. Click it to stop waiting - the image still lands in the project library when it is ready.",
      },
      {
        heading: "Keyboard shortcuts",
        bullets: [
          "Space - play / pause.",
          "← / → - back / forward 1 frame; Shift + ← / → - back / forward 1 second; Home / End - go to start / end.",
          "Alt + ← / → - move the selected scene earlier / later.",
          "S - split at the playhead; Delete or Backspace - delete the selected item; Esc - deselect.",
          "Ctrl + D - duplicate; Ctrl + C / Ctrl + V - copy / paste at the playhead; Ctrl + ] / Ctrl + [ - bring a layer forward / send it backward.",
          "Ctrl + Z - undo; Ctrl + Shift + Z or Ctrl + Y - redo.",
          "Ctrl + mouse wheel - zoom the timeline; hold Alt while dragging - no snapping; right-click or G - create with AI at that point.",
          "? - open the **Keyboard shortcuts** list (also in the **More** menu).",
        ],
        tip: "On a Mac, use ⌘ instead of Ctrl. Shortcuts do not fire while you are typing in a field.",
      },
      {
        heading: "Locking tracks",
        paragraphs: [
          "Click the padlock in a track's name column to lock it: a locked track cannot be moved, edited, deleted or added to, but you can still select items to inspect them. Click again to unlock.",
          "Locks are a personal convenience in this browser, remembered per project, and they do not restrict the AI.",
        ],
      },
      {
        heading: "Autosave, conflicts and history",
        paragraphs: [
          "The editor saves about 0.7 seconds after your last change. The badge in the top bar reads **Saved**, **Saving…**, **Unsaved** or **Save failed** (with a **Save again** button).",
          "If the AI or another tab changes the timeline while you have unsaved edits, a conflict banner appears: choose **Keep mine** to overwrite, or **Load latest (discard mine)**.",
          "**More** › **Version history** keeps the timeline from before every save and restore, and from before and after every AI edit (the latest 100). Click **Restore** to go back; the current version is saved too, so you can always change your mind.",
        ],
        warning:
          "Leaving while the last save failed or a conflict is open loses your unsaved changes - you are asked to confirm before you can leave.",
      },
      {
        heading: "AI chat and handing off",
        paragraphs: [
          "The **AI editor** panel on the right takes edits in plain words, such as “move the second subtitle 0.5s earlier”. Changes appear live in the player, and the AI does not render unless you ask; **New conversation** starts fresh.",
          "**Hand off to AI** is for bigger jobs: the AI re-reads the timeline you edited, keeps your manual changes and carries on with your **Instruction**, stopping at **Draft, I review** or going **All the way to final**.",
          "When it is done, a banner reading **The AI has finished editing** offers **Keep**, **Undo** (back to exactly the version before the handoff) or **View history**.",
        ],
        warning:
          "While the AI is editing the project, the editor is view-only: nothing can be dragged, edited or added, and the AI's changes show up live in the player. Wait for it to finish before editing again.",
      },
      {
        heading: "Rendering and exporting",
        paragraphs: [
          "**Render draft** saves your changes and queues a quick draft; only HyperFrames scenes that are missing a render get rendered again. Progress shows in the top bar, followed by a **Watch draft** button when it is done.",
          "**Export video** renders the final, which needs a successful draft beforehand and a passing QC. If QC has not run or is failing, you can click **Render final anyway** when you are sure.",
          "**More** › **Export XML (Premiere/DaVinci)** downloads a timeline file that opens in Premiere Pro or DaVinci Resolve. Media paths point to this computer, so on another machine you will need to relink them.",
        ],
        tip: "A render that is already running does not include edits you made after it started - wait for it to finish, then render again.",
      },
    ],
  },
};
