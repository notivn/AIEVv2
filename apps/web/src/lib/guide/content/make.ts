import type { GuideContent } from "@/lib/guide/types";

/**
 * Nhóm "Tạo nội dung" của bảng Hướng dẫn: Images Project, Auto cut videos,
 * Text to video, Dịch video, Giọng đọc. Tên nút/ô trong `**...**` phải khớp
 * NGUYÊN VĂN với locales/vi.ts (bản vi) và locales/en.ts (bản en).
 */

type Ids = "images" | "auto-cut" | "text-to-video" | "translate-video" | "voices";

export const vi: Pick<GuideContent, Ids> = {
  // ===================================================================
  images: {
    title: "Images Project",
    summary:
      "Tạo ảnh tĩnh bằng AI cho thumbnail, ảnh nền hay ảnh minh họa. AI chỉ vẽ phần nền, còn chữ và logo do hệ thống đặt lên theo Style Design nên luôn đúng font, đúng màu và đúng dấu tiếng Việt.",
    blocks: [
      {
        heading: "Ảnh được tạo ra thế nào",
        paragraphs: [
          "Mỗi dự án ảnh đi qua hai bước. Bước một, AI vẽ một ảnh nền không có chữ. Bước hai, Remotion đặt tiêu đề, phụ đề, số liệu, CTA và logo lên ảnh nền đó theo màu và font của Style Design đã chọn.",
          "Tách hai bước như vậy để chữ không bao giờ bị AI vẽ sai chính tả hay mất dấu, và để bạn sửa chữ mà không phải vẽ lại nền.",
        ],
      },
      {
        heading: "Tạo dự án ảnh mới",
        steps: [
          "Bấm **Tạo ảnh** ở góc trên trang **Images Project**.",
          "Đặt **Tên** cho dự án và chọn **Style Design** - ảnh tạo ra bắt buộc theo màu, font, logo và tone của style này.",
          "Viết **Yêu cầu tạo ảnh**: tả nội dung, bố cục, chất liệu bạn muốn cho phần nền. Không cần viết chữ sẽ hiện trên ảnh vào đây.",
          "Chọn **Loại ảnh**, **Model tạo nền (Gemini)** và **Tỉ lệ**, điền phần **Chữ trên ảnh (Remotion đặt)** nếu cần.",
          "Bấm **Tạo ảnh**. Trang chi tiết của dự án mở ra - ảnh chưa được vẽ cho tới khi bạn bấm **Tạo tất cả** ở đó.",
        ],
      },
      {
        heading: "Các lựa chọn khi tạo",
        bullets: [
          "**Loại ảnh**: **Background**, **Minh họa 3D**, **Nhân vật**, **Texture Liquid Glass**, **Ảnh sản phẩm** hoặc **Concept quảng cáo** - định hướng cho AI vẽ nền theo kiểu nào.",
          "**Tỉ lệ**: 9:16 **Dọc** (1080x1920), 16:9 **Ngang** (1920x1080), 1:1 **Vuông** (1080x1080) hoặc 4:5 **Feed** (1080x1350).",
          "Ô model: **Mặc định (nhà cung cấp chọn ở trang Kết nối)**, hoặc chọn hẳn một nhà cung cấp (**Tự động**, **Gemini API**, **ChatGPT (web)**, **Gemini (web)**), hoặc chọn đích danh một model Gemini. Danh sách model Gemini lấy trực tiếp từ Google: bản Lite rẻ và nhanh hơn, bản Pro chất lượng cao nhất.",
          "Nhà cung cấp nào chưa cấu hình sẽ bị khóa kèm chữ **chưa cấu hình** - thêm tài khoản hoặc API key ở trang **Kết nối**.",
          "Chọn **ChatGPT (web)** thì hiện thêm ô **Model ChatGPT**: **GPT Image 2** (mặc định) cho kết quả ổn định, **GPT Image 2.5** để ChatGPT tự chọn model ảnh mới nhất mà tài khoản có. Ô này chỉ có tác dụng khi nhà cung cấp là ChatGPT (web).",
        ],
      },
      {
        heading: "Chữ trên ảnh",
        bullets: [
          "**Tiêu đề** và **Phụ đề**: dòng chữ chính và dòng phụ.",
          "**Số liệu**: bấm **Thêm số liệu** để thêm từng cặp nhãn và giá trị, ví dụ Khách hàng - 10K+.",
          "**CTA**: lời kêu gọi hành động, ví dụ Dùng thử miễn phí.",
          "**Hiện logo brand**: đóng logo của Style Design lên ảnh. Logo luôn lấy từ file của style, không bao giờ do AI vẽ.",
          "**Vị trí khối chữ**: chọn một ô trong lưới 3x3 (trên, giữa, dưới x trái, giữa, phải) hoặc **Tự động**. Tự động thì ảnh ngang đặt giữa-trái, ảnh vuông đặt đáy-giữa, ảnh dọc đặt đáy-trái.",
          "Vùng tối và ánh sáng của nền tự dời theo khối chữ để chữ luôn đọc được, còn logo lùi về góc đối diện.",
        ],
      },
      {
        heading: "Trang chi tiết dự án ảnh",
        paragraphs: [
          "Trang chia ba cột. Cột **Nguồn** chứa khối **Thiết lập** để sửa yêu cầu và chữ. Cột **Yêu cầu & thiết lập** chứa các nút tạo ảnh. Cột **Tiến trình & kết quả** hiện **Ảnh final** và ảnh nền ở khối **Các bước**. Bảng **Nhật ký AI** bên phải hiện từng dòng log khi ảnh đang được tạo.",
        ],
        bullets: [
          "**Tạo tất cả**: vẽ nền rồi đặt chữ, một lần ra ảnh hoàn chỉnh.",
          "**Tạo nền (Gemini)**: chỉ vẽ lại ảnh nền theo model đang chọn.",
          "**Hoàn thiện (Remotion)**: chỉ đặt lại chữ và logo lên ảnh nền đang có - cần có ảnh nền trước.",
          "**Tải nền lên…**: dùng ảnh PNG hoặc JPG của bạn làm nền, không cần AI.",
          "**Model tạo nền**: đổi model ngay tại đây, lựa chọn được lưu luôn.",
          "Có ảnh final thì bấm **Phóng to** để soi kỹ hoặc **Tải xuống** để lấy file.",
        ],
        tip: "Chỉ muốn sửa chữ, đổi vị trí khối chữ hay bật tắt logo? Sửa trong khối **Thiết lập** rồi bấm **Hoàn thiện (Remotion)** - nền giữ nguyên nên nhanh và không tốn thêm lượt vẽ.",
      },
      {
        heading: "Lưu và đổi tên",
        bullets: [
          "Các nút tạo ảnh tự lưu nội dung đang sửa trước khi chạy. Muốn lưu mà chưa chạy thì bấm **Lưu thay đổi**.",
          "Sửa tên dự án ngay trên tiêu đề trang. Ở danh sách thì dùng biểu tượng bút chì ở cuối hàng.",
          "Trạng thái của dự án: **Nháp**, **Đang tạo**, **Hoàn thành** hoặc **Lỗi**. Lần tạo bị lỗi thì trang chi tiết hiện banner đỏ kèm lý do.",
        ],
      },
      {
        heading: "Chi phí và nhà cung cấp",
        paragraphs: [
          "Mỗi lần vẽ nền qua Gemini API tính tiền theo lượt trên API key của bạn. ChatGPT (web) và Gemini (web) dùng lượt tạo ảnh của tài khoản web đã nạp ở trang **Kết nối**, vẽ lần lượt từng ảnh và nghỉ một chút giữa hai ảnh để tài khoản không bị giới hạn.",
          "Chưa có nhà cung cấp nào vẫn dùng được trang này: bấm **Tải nền lên…** rồi **Hoàn thiện (Remotion)**.",
        ],
      },
      {
        heading: "Hủy, nhân bản và dọn dẹp",
        bullets: [
          "Trang ảnh không có nút dừng riêng. Muốn hủy một lượt đang tạo, mở **Render Queue**, tìm job loại **Tạo ảnh** rồi bấm **Hủy**.",
          "**Nhân bản** tạo dự án mới giữ ảnh nền, bỏ ảnh hoàn thiện - tiện để thử nhiều bộ chữ trên cùng một nền.",
          "Ở danh sách, tích chọn nhiều dự án để **Xóa file rác** (ảnh nền, ảnh final và thông tin dự án được giữ nguyên) hoặc **Xóa đã chọn**.",
        ],
        warning:
          "Xóa dự án ảnh là xóa vĩnh viễn toàn bộ ảnh của dự án, không khôi phục được. Tải ảnh final về trước nếu còn cần.",
      },
    ],
  },

  // ===================================================================
  "auto-cut": {
    title: "Auto cut videos",
    summary:
      "Cắt một video dài như livestream, podcast hay buổi nói chuyện thành nhiều video ngắn. Mỗi đoạn tự thành một Videos Project riêng để dựng chữ, phụ đề, sound effect tiếp.",
    blocks: [
      {
        heading: "Quy trình một phiên cắt",
        steps: [
          "Ở trang **Auto cut videos**, bấm **Tạo phiên cắt**.",
          "Chọn **Video nguồn**: lấy file có sẵn ở ô **Chọn video trong imports/** hoặc bấm **Tải video lên** để đưa file từ máy vào.",
          "Chọn **Cách cắt**, **Tỉ lệ khung hình** và các tùy chọn bên dưới, rồi bấm **Tạo phiên cắt & phân tích**.",
          "Hệ thống phân tích video và đề xuất kế hoạch cắt. Mở phiên và duyệt danh sách **Các đoạn**.",
          "Bấm **Cắt & tạo project** để cắt thật. Mỗi đoạn được chọn thành một Videos Project, mở bằng nút **Mở project**.",
        ],
      },
      {
        heading: "Ba cách cắt",
        bullets: [
          "**Theo thời lượng**: chia đều video theo **Số phút mỗi đoạn** (mặc định 5), có thể đặt **Chồng lấn (giây)**. Nhanh nhất vì máy không cần hiểu nội dung.",
          "**Cắt bằng AI**: AI đọc lời thoại, chấm điểm rồi chọn các đoạn hay nhất. Bạn đặt **Số đoạn** (mặc định 5), **Ngắn nhất (giây)** và **Dài nhất (giây)** (mặc định 20 và 60).",
          "**Cắt theo yêu cầu**: giống cắt bằng AI nhưng bạn tả muốn lấy gì trong ô **Yêu cầu cắt**, ví dụ lấy các đoạn nói về giá và khuyến mãi. Phải nhập yêu cầu mới tạo được phiên.",
        ],
        tip: "Hai cách cắt bằng AI lâu hơn vì phải bóc lời thoại trước, nhưng đoạn lấy ra thường trọn ý. Video một tiếng có thể mất vài phút cho bước này.",
      },
      {
        heading: "Khung hình và cách đưa hình vào khung",
        bullets: [
          "**Tỉ lệ khung hình**: **Giữ nguyên** (đúng khung gốc, cắt nhanh nhất), 9:16 cho TikTok, Reels, Shorts, 16:9 cho YouTube, 1:1 và 4:5 cho feed Facebook, Instagram.",
          "Chọn khung khác gốc thì từng đoạn được dựng lại khung hình, mỗi đoạn phải encode lại nên video dài sẽ tốn thêm thời gian. Khi đó bạn chọn thêm **Đưa hình vào khung**.",
          "**Tự động**: hệ thống nhìn từng đoạn - có người thì cắt cúp bám nhân vật, là màn hình hay chữ thì thu nhỏ để giữ trọn khung.",
          "**Cắt cúp bám nhân vật**: chủ thể to, đầy khung, nhưng mất phần rìa - chữ hay đồ vật sát viền có thể bị cắt mất.",
          "**Giữ trọn khung nguồn**: không mất gì, chủ thể nhỏ lại và phần trống được lấp bằng nền.",
        ],
      },
      {
        heading: "Nền lấp phần trống",
        paragraphs: [
          "Mục này chỉ hiện khi bạn đổi khung và không chọn cắt cúp, vì lúc đó hình gốc không phủ hết khung mới.",
        ],
        bullets: [
          "**Nền AI vẽ**: Gemini vẽ nền theo style chọn ở ô **Style Design** - đẹp nhất nhưng lâu hơn và tốn tiền theo API key.",
          "**Nền mờ**: lấy chính khung hình video phóng to rồi làm mờ - miễn phí, nhanh, hợp mọi nội dung.",
          "**Màu của style**: nền phẳng lấy màu nền từ Style Design - gọn và đúng nhận diện.",
        ],
      },
      {
        heading: "Tùy chọn và cấu hình edit dùng chung",
        bullets: [
          "**Tạo lời thoại (transcript)**: bóc lời nói thành văn bản có mốc thời gian để project con có sẵn phụ đề. Với hai cách cắt bằng AI, ô này luôn bật.",
          "**Chạy AI edit luôn sau khi cắt**: cắt xong AI dựng luôn từng project con. Tối đa 3 project được chạy ngay, số còn lại tạo xong để đó chờ bạn bấm edit.",
          "**Cấu hình edit cho các video cắt ra**: mở khối này để đặt một lần cho cả phiên - phụ đề, bố cục key, sound effect, nhạc nền, skill, ảnh minh họa AI. Mọi video cắt ra dùng chung, khỏi chỉnh từng project.",
        ],
        warning:
          "**Chạy AI edit luôn sau khi cắt** mở một phiên AI riêng cho mỗi project, tốn token thật và máy chạy khá lâu. Để tắt nếu bạn muốn duyệt từng đoạn rồi mới quyết định dựng cái nào.",
      },
      {
        heading: "Trang chi tiết phiên cắt",
        paragraphs: [
          "Cột **Nguồn** cho xem lại video gốc cùng độ phân giải, thời lượng và fps. Cột **Yêu cầu & thiết lập** có **Cấu hình phiên** (chỉ xem), **Cấu hình edit** và danh sách **Các đoạn**. Cột **Tiến trình & kết quả** hiện tiến trình đang chạy và danh sách **Project con đã tạo**.",
          "Cách cắt và khung hình chốt lúc tạo phiên - muốn đổi thì tạo phiên mới. **Cấu hình edit** thì sửa được bất cứ lúc nào phiên không chạy, thay đổi tự lưu.",
        ],
      },
      {
        heading: "Duyệt các đoạn trước khi cắt",
        bullets: [
          "Mỗi đoạn hiện mốc bắt đầu - kết thúc, độ dài và một dòng mô tả. Hai cách cắt bằng AI còn ghi điểm, ví dụ **Điểm 8/10**.",
          "Bỏ tích đoạn không cần hoặc dùng **Chọn tất cả**. Sửa tiêu đề ngay trong ô - tiêu đề này thành tên của project con.",
          "**Phân tích lại** chạy lại bước phân tích để lấy một kế hoạch cắt mới.",
          "Nút **Cắt & tạo project** kèm số đoạn sẽ cắt: chỉ những đoạn đang được chọn và chưa có project.",
        ],
        tip: "Kế hoạch cắt chưa động vào file nào - chỉ bước cắt mới thật sự encode và tốn thời gian. Duyệt kỹ ở đây rẻ hơn nhiều so với cắt xong rồi làm lại.",
      },
      {
        heading: "Khi có lỗi và khi xóa phiên",
        bullets: [
          "Phiên lỗi hiện banner đỏ kèm chi tiết. Nút ở khối **Project con đã tạo** cho chạy lại đúng bước bị hỏng (**Phân tích lại** hoặc **Cắt & tạo project**).",
          "Sửa **Cấu hình edit** chỉ áp cho các đoạn cắt sau đó. Project đã tạo rồi thì sửa kịch bản edit trong chính project đó.",
          "Xóa phiên chỉ xóa kế hoạch cắt và file tạm. Các Videos Project đã tạo từ phiên vẫn còn nguyên trong **Videos Project**.",
        ],
      },
    ],
  },

  // ===================================================================
  "text-to-video": {
    title: "Text to video",
    summary:
      "Biến một bài viết thành video có giọng đọc: dán link hoặc văn bản, AI viết kịch bản đọc, bạn chọn giọng, rồi hệ thống tạo một Videos Project và để AI dựng tiếp theo cấu hình bạn đặt.",
    blocks: [
      {
        heading: "Tạo phiên",
        paragraphs: [
          "Mỗi phiên đi qua năm bước **Nguồn**, **Kịch bản**, **Giọng đọc**, **Cấu hình** và **Dựng video**. Trước khi dựng, bước nào cũng quay lại sửa được.",
        ],
        steps: [
          "Bấm **Tạo phiên**, chọn **Link bài viết** hoặc **Dán văn bản**.",
          "Dán link hoặc nội dung bài. **Tên phiên (tùy chọn)** để trống thì lấy theo tiêu đề bài.",
          "Bấm **Tạo phiên**. Với link, hệ thống tự mở trang và bóc lấy nội dung chính ngay sau khi tạo.",
        ],
      },
      {
        heading: "Bước 1 - Bài viết nguồn",
        bullets: [
          "Nội dung lấy được hiện trong ô **Nội dung dùng để viết kịch bản**. Sửa thoải mái - AI chỉ đọc đúng phần chữ trong ô này.",
          "Bấm **Trích xuất nội dung** hoặc **Trích xuất lại** để lấy bài từ link lần nữa.",
          "Trang nào chặn đọc tự động thì dán thẳng văn bản vào ô. AI không tự đi tìm thêm nội dung ngoài phần bạn đưa.",
        ],
      },
      {
        heading: "Bước 2 - Kịch bản đọc",
        bullets: [
          "Bấm **AI viết kịch bản** để Claude viết lời đọc, chia thành từng đoạn ngắn. Đã có kịch bản thì nút đổi thành **Viết lại**.",
          "**Độ dài (giây)**: từ 15 đến 600 giây. Để trống (**Tự động**) thì AI tự quyết theo nội dung.",
          "**Model viết kịch bản**: để **Mặc định của Claude Code** là đủ cho phần lớn bài. Chạy bằng tài khoản Claude Code đã đăng nhập trên máy nên không cần API key, và model chọn ở đây được nhớ cho lần sau.",
          "Sửa chữ trực tiếp trong từng đoạn, bấm **Thêm đoạn** để thêm, hoặc xóa đoạn bằng dấu X ở góc đoạn đó.",
        ],
        warning:
          "Thời lượng cạnh mỗi đoạn chỉ là ước tính theo số ký tự - cùng một câu, giọng đọc có thể lệch tới 28%. Con số thật (ghi chữ thật) chỉ có sau khi đã tổng hợp giọng.",
      },
      {
        heading: "Bước 3 - Chọn engine đọc",
        paragraphs: [
          "Ở **Engine đọc** có hai thẻ, mỗi thẻ ghi rõ **Dùng được** hay **Chưa dùng được** trên máy bạn, kèm lý do và cách khắc phục.",
        ],
        bullets: [
          "**Gemini (đám mây)**: 30 giọng dựng sẵn, chất lượng cao, đọc nhanh. Cần GEMINI_API_KEY và mạng; mỗi lần đọc và mỗi lần nghe thử đều tốn tiền.",
          "**VieNeu (trên máy)**: 14 giọng tiếng Việt có sẵn chia theo vùng miền, cộng với giọng bạn tự nhân bản. Miễn phí, không cần mạng, nhưng đọc chậm - gần bằng thời gian thật.",
          "Chọn VieNeu thì danh sách chia hai nhóm **Đã nhân bản** và **Có sẵn**, thêm bộ lọc **Vùng miền** (**Bắc**, **Trung**, **Nam**). Chưa có giọng nhân bản thì bấm **Quản lý giọng** để sang trang **Giọng đọc**.",
        ],
      },
      {
        heading: "Bước 3 - Chọn giọng và nghe thử",
        bullets: [
          "Lọc nhanh bằng **Nam**, **Nữ**, **Trung tính** hoặc gõ tên, chất giọng vào ô tìm. Chữ trầm hay cao đi kèm là cao độ đo từ audio thật.",
          "Bấm **Nghe thử** trên từng giọng trước khi chốt. Với Gemini, mỗi lần nghe thử là một lần tổng hợp thật, mất vài giây và tốn phí.",
          "**Tốc độ đọc**: **Bình thường**, x0.9, x1.1, x1.2, x1.3 hoặc x1.5. Tốc độ áp sau khi tổng hợp nên giọng không bị the; x1.1-x1.2 nghe tỉnh hơn hẳn mà vẫn tự nhiên. Nghe thử đã áp đúng tốc độ này.",
          "Riêng Gemini còn có **Model đọc** (để **Mặc định của server** là an toàn nhất), **Ngôn ngữ** (chỉ ghi rõ ý định, không đổi chất giọng) và **Cách đọc** - một câu tả kiểu đọc như chậm rãi, ấm áp, như đang kể chuyện.",
        ],
        warning:
          "**Cách đọc** ảnh hưởng thẳng tới tốc độ: cùng một kịch bản, cách đọc khác nhau làm thời lượng chênh tới 2,6 lần. Đổi cách đọc sau khi đã có giọng thì mọi mốc thời gian phải tính lại.",
      },
      {
        heading: "Bước 4 - Cấu hình video",
        bullets: [
          "**Tỉ lệ khung hình** (9:16, 16:9, 1:1, 4:5), **FPS** (24, 25, 30, 60) và **Style Design** quyết định video xuất ra trông thế nào.",
          "Phần kịch bản edit bên dưới giống hệt của Videos Project: phụ đề, bố cục key, sound effect, nhạc nền, skill. Thay đổi tự lưu và áp sẵn cho project sinh ra.",
          "**Ảnh minh họa AI (Gemini)** là công tắc thật: bật thì AI chọn ý chính và vẽ minh họa đồng bộ Style Design (khoảng $0.05 mỗi ảnh), tắt thì video không có ảnh AI nào.",
        ],
      },
      {
        heading: "Bước 5 - Dựng video",
        paragraphs: [
          "Bấm **Dựng video** - nút chỉ bấm được khi đã có kịch bản và đã chọn giọng. Hệ thống đọc kịch bản thành giọng, tạo transcript khớp thời gian, tạo một Videos Project rồi giao cho AI dựng theo cấu hình ở bước 4.",
          "Khối **Tiến trình dựng video** hiện tiến trình thật của project đó, bảng **Nhật ký AI** bên phải hiện log và toàn bộ cuộc hội thoại AI edit. Xong thì video hiện ngay trong khối **Video thành phẩm**, kèm nút **Tải video**.",
        ],
        tip: "Bước dựng là bước lâu nhất, thường vài chục phút. Bạn có thể đóng trang - tiến trình vẫn chạy tiếp. Với VieNeu, lần đọc đầu sau khi mở server mất thêm 15-30 giây để nạp model.",
      },
      {
        heading: "Sau khi dựng",
        bullets: [
          "Mỗi phiên chỉ dựng một lần. Muốn render lại, chạy QC hay cắt short thì bấm **Mở project (render lại, QC, cắt short…)** và làm tiếp trong chính project đó.",
          "Xóa phiên chỉ xóa bài viết, kịch bản và file giọng đọc của phiên. Videos Project đã tạo ra từ phiên vẫn giữ nguyên.",
        ],
      },
    ],
  },

  // ===================================================================
  "translate-video": {
    title: "Dịch video",
    summary:
      "Đưa một video vào, hệ thống bóc lời thoại kèm mốc thời gian, AI dịch sang ngôn ngữ bạn chọn, rồi đóng phụ đề đã dịch lên video hoặc đọc bản dịch thành giọng thay tiếng gốc.",
    blocks: [
      {
        heading: "Bắt đầu một phiên",
        steps: [
          "Ở trang **Dịch video**, bấm **Tạo phiên**, đặt **Tên phiên (tùy chọn)** rồi bấm **Tạo phiên**.",
          "Trong trang phiên, kéo thả file video vào khối **Video nguồn** hoặc bấm **Tải video lên**. MP4, MOV, MKV đều được; hệ thống tự đo độ dài, kích thước và fps.",
          "Đi lần lượt năm bước **Nguồn**, **Lời thoại**, **Bản dịch**, **Phụ đề** và **Kết quả**.",
        ],
        tip: "Phiên được tạo trước rồi mới tải video để file lớn có chỗ đi và bạn thấy được tiến trình. Cứ để yên trang cho tới khi tải xong.",
      },
      {
        heading: "Bước 2 - Bóc lời thoại",
        bullets: [
          "**Ngôn ngữ trong video** là thứ tiếng ĐANG NÓI trong video, không phải ngôn ngữ đích. Để **Tự nhận** là đúng trong phần lớn trường hợp; chỉ đặt tay khi video pha nhiều thứ tiếng hoặc tiếng nền lớn.",
          "**AI bóc lời**: **Trên máy - faster-whisper (miễn phí)** không cần mạng nhưng không phân biệt người nói; **Gemini (dùng key sẵn có)** gắn nhãn người nói theo kiểu suy đoán; **Soniox ($0.10/giờ)** phân vai người nói chuẩn nhất.",
          "Bấm **Bóc lời thoại**. Bước này chạy qua render queue nên đóng trang vẫn chạy tiếp, log hiện ở bảng **Nhật ký AI**.",
        ],
        tip: "Định lồng tiếng video có nhiều người nói? Chọn AI bóc lời có phân vai người nói - có nhãn người nói thì bước lồng tiếng mới gán được mỗi người một giọng.",
      },
      {
        heading: "Bước 3 - Dịch",
        bullets: [
          "**Cách trả kết quả**: **Phụ đề** ghi chữ dịch lên hình và giữ tiếng gốc; **Lồng tiếng** đọc bản dịch thay tiếng gốc, không đốt chữ lên hình; **Cả hai** làm cả hai việc.",
          "Chọn chế độ nào thì cửa sổ cấu hình của chế độ đó mở ra (Cả hai thì mở phụ đề trước rồi tới lồng tiếng). Muốn mở lại thì bấm **Cấu hình** ngay trong khối **Bản dịch**.",
          "Ngôn ngữ đích của chữ chọn ở **Ngôn ngữ phụ đề**. Tiếng đọc chọn ở **Ngôn ngữ lồng tiếng**, mặc định giống phụ đề; chọn khác đi thì AI phải dịch hai bản, tốn gấp đôi.",
          "**Model dịch**: **Flash (khuyên dùng, nhanh + rẻ)**, **Pro (câu khó, thành ngữ)** hoặc **Flash Lite (rẻ nhất)**. Lựa chọn chỉ áp cho lần dịch kế tiếp, tải lại trang là về mặc định.",
          "Bấm **AI dịch**. Mỗi câu hiện lời gốc ở trên, lời dịch ở dưới; sửa câu nào là tự lưu câu đó, mốc thời gian giữ nguyên nên phụ đề không bị lệch.",
        ],
        warning:
          "**Dịch lại** ghi đè mọi chỗ bạn đã sửa tay, còn **Bóc lại** ghi đè cả lời thoại lẫn bản dịch. Đổi giữa Phụ đề và Lồng tiếng thì nên dịch lại, vì lồng tiếng cần câu ngắn hơn để đọc vừa chỗ.",
      },
      {
        heading: "Bước 4 - Kiểu phụ đề",
        bullets: [
          "Chỉnh **Font chữ**, **Cỡ chữ (px)**, **Màu chữ**, **Nền sau chữ** (**Làm mờ**, **Màu đặc** hoặc **Không nền**) và **Cách đáy (px)**. Thay đổi tự lưu.",
          "Ô **Xem trước** dùng một khung hình thật của video bạn tải lên, khỏi phải render mới biết đẹp hay xấu.",
          "Font chỉ có vài lựa chọn đã kiểm chứng hiển thị đúng dấu tiếng Việt - nên dùng **Việt hóa (khuyên dùng)**. Muốn font khác thì thêm vào Style Design.",
          "Số đo tính trên khung hình thật, nên video 4K cần cỡ chữ lớn hơn video 1080p.",
        ],
      },
      {
        heading: "Cấu hình lồng tiếng",
        bullets: [
          "**Engine đọc**: Gemini (đám mây, tốn phí theo lượt) hoặc VieNeu (trên máy, miễn phí, đọc được cả giọng bạn đã nhân bản).",
          "**Giọng cho từng người nói**: để **Tự chọn theo cao độ giọng gốc** thì hệ thống chọn giọng cùng giới tính, gần cao độ nhất và không cho hai người chung một giọng. Giọng bạn chọn tay được giữ qua mọi lần dựng lại.",
          "**Nghe thử** đọc đúng một câu của người nói đó, đã co giãn y như khi dựng thật. Nghe thấy bị đọc vội nghĩa là bản dịch đang dài quá - sửa chữ trước khi lồng cả bài.",
          "**Giữ tiếng gốc chạy nhỏ bên dưới**: giữ tiếng gốc ở mức thấp để giọng lồng luôn nghe rõ.",
          "Mỗi câu được đặt đúng mốc của câu gốc. Câu dài hơn chỗ trống được đọc nhanh lên tối đa x1,25; vẫn không vừa thì lấn nhẹ sang câu sau chứ không bị cắt chữ. Hệ thống không khớp khẩu hình.",
        ],
      },
      {
        heading: "Bước 5 - Kết quả",
        paragraphs: [
          "Bấm **Đóng phụ đề** ở chế độ Phụ đề, hoặc **Lồng tiếng** ở chế độ Lồng tiếng và Cả hai. Job chạy qua render queue, tiến trình hiện ở khối **Video thành phẩm**, log ở bảng **Nhật ký AI**.",
          "Xong thì xem và **Tải video** ngay trong khối. **Đóng lại** hoặc **Lồng lại** bao nhiêu lần cũng được - mỗi lần ghi đè video kết quả trước đó.",
          "Sau khi lồng tiếng, khối **Kết quả lồng tiếng lần gần nhất** cho biết bao nhiêu câu phải co và bao nhiêu câu tràn. Có câu tràn thì rút gọn chữ ở đúng câu đó rồi lồng lại.",
        ],
      },
      {
        heading: "Trạng thái và chạy lại",
        paragraphs: [
          "Phiên lần lượt qua **Nháp**, **Đang bóc lời**, **Đã có lời thoại**, **Đang dịch**, **Đã dịch xong**, **Đang đóng phụ đề** rồi **Xong**; hỏng ở đâu thì báo **Lỗi** kèm chi tiết.",
          "Bước nào cũng chạy lại được: **Bóc lại**, **Dịch lại**, **Đóng lại** hoặc **Lồng lại**. Đổi sang video khác bằng **Đổi video khác** thì lời thoại cũ không còn khớp, phải bóc lại từ đầu.",
        ],
        warning:
          "Xóa phiên dịch video là xóa luôn video nguồn đã tải lên, lời thoại, bản dịch và video kết quả - không khôi phục được. Tải video kết quả về trước khi xóa.",
      },
    ],
  },

  // ===================================================================
  voices: {
    title: "Giọng đọc",
    summary:
      "Quản lý giọng đọc tiếng Việt chạy ngay trên máy (VieNeu-TTS) và nhân bản giọng thật của bạn từ một đoạn ghi âm ngắn, để Text to video và lồng tiếng đọc bằng chính giọng đó.",
    blocks: [
      {
        heading: "Hai engine đọc",
        bullets: [
          "**Gemini (đám mây)**: 30 giọng dựng sẵn, đọc được mọi ngôn ngữ, nhanh. Cần GEMINI_API_KEY và mạng, mỗi lần đọc hay nghe thử đều tính tiền theo lượt. Không nhân bản được giọng.",
          "**VieNeu (trên máy)**: 14 giọng tiếng Việt có sẵn, chia theo vùng miền Bắc, Trung, Nam và theo phong cách đọc (tin tức, tự nhiên, kể chuyện). Miễn phí, không cần mạng, nhưng đọc chậm - gần bằng thời gian thật. Là engine duy nhất nhân bản được giọng.",
        ],
        paragraphs: [
          "Hai engine chạy song song, bạn chọn cho từng phiên ở bước Giọng đọc của Text to video hoặc ở phần lồng tiếng của Dịch video. Trang **Giọng đọc** chỉ lo phần VieNeu và các giọng nhân bản.",
        ],
      },
      {
        heading: "Khối Engine giọng offline",
        paragraphs: [
          "Khối trên cùng cho biết máy bạn đang ở mức nào: sẵn sàng cả đọc lẫn nhân bản, đọc được nhưng còn thiếu PyTorch để nhân bản, hoặc chưa cài gì. Chưa đủ thì ngay bên dưới có hướng dẫn **Cách bật giọng offline**.",
          "Cài xong bấm **Kiểm tra lại**. Đã cài mà vẫn báo lỗi nạp model thì mở **Chi tiết kỹ thuật** để xem nguyên nhân.",
        ],
      },
      {
        heading: "Cài giọng offline",
        steps: [
          "Cài Python bản 3.11 đến 3.14 nếu máy chưa có. Bản 3.15 trở lên hiện chưa chạy được vì thư viện của model chưa hỗ trợ.",
          "Mức một - chỉ đọc: chạy lệnh pip install vieneu (khoảng 30 MB). Như vậy đã đủ dùng cả 14 giọng có sẵn.",
          "Mức hai - nhân bản giọng: chạy thêm pip install torch torchaudio (tải khoảng 2-3 GB).",
          "Bấm **Kiểm tra lại**. Lần đọc đầu tiên tải model khoảng 1 GB nên hơi lâu.",
        ],
        tip: "Mỗi lệnh có nút **Chép lệnh** để dán thẳng vào PowerShell. Chỉ cần đọc offline thì dừng ở mức một, không phải tải PyTorch nặng vài GB. Bước kiểm tra hệ thống khi chạy file khởi động cũng báo nếu thiếu VieNeu-TTS và có thể cài giúp.",
      },
      {
        heading: "Nhân bản một giọng",
        steps: [
          "Bấm **Nhân bản giọng** ở góc trên trang.",
          "Đặt **Tên giọng** - tên này hiện trong danh sách giọng khi bạn chọn ở Text to video. Chọn **Giới tính** và ghi **Ghi chú** nếu muốn.",
          "Ở **File mẫu**, bấm **Chọn file ghi âm** hoặc **Ghi âm trực tiếp** bằng micro của máy. File âm thanh hay video quay bằng điện thoại có tiếng nói đều dùng được.",
          "Nghe lại mẫu cho chắc rồi bấm **Nhân bản giọng**.",
        ],
      },
      {
        heading: "Mẫu thế nào thì giọng giống",
        bullets: [
          "Dài 3-8 giây là tốt nhất. Dưới 3 giây không đủ đặc trưng giọng, hệ thống sẽ báo mẫu quá ngắn.",
          "Dài hơn không tốt hơn: model chỉ dùng phần đầu, phần sau bị bỏ. Ghi âm trực tiếp tự dừng ở 30 giây.",
          "Nói rõ ràng, không nhạc nền, không tiếng ồn - mẫu càng sạch, giọng nhân bản càng giống.",
        ],
      },
      {
        heading: "Quản lý giọng đã nhân bản",
        bullets: [
          "Mỗi thẻ giọng có nút **Nghe mẫu gốc** để nghe lại đoạn mẫu và **Đọc thử** để nghe giọng nhân bản đọc một câu mẫu.",
          "Bấm **Đổi tên** để sửa tên, **Xóa giọng** để xóa.",
          "Giọng nhân bản dùng được ngay: ở Text to video chọn **VieNeu (trên máy)**, giọng nằm trong nhóm **Đã nhân bản**. Phần lồng tiếng của Dịch video cũng chọn được giọng này.",
          "Toàn bộ chạy trên máy bạn: mẫu ghi âm và giọng nhân bản không gửi đi đâu, không tốn tiền theo lượt.",
        ],
        tip: "Lần đọc đầu sau khi mở server mất thêm khoảng 15-30 giây để nạp model, những lần sau nhanh hơn nhiều.",
        warning:
          "Xóa giọng là xóa luôn file mẫu. Phiên Text to video đã dùng giọng này vẫn giữ file tiếng đã đọc, nhưng muốn đọc lại thì phải chọn giọng khác.",
      },
    ],
  },
};

export const en: Pick<GuideContent, Ids> = {
  // ===================================================================
  images: {
    title: "Images Project",
    summary:
      "Make still images with AI for thumbnails, backgrounds or illustrations. The AI only paints the background - the text and logo are laid on top by the system following your Style Design, so fonts, colours and spelling are always right.",
    blocks: [
      {
        heading: "How an image is made",
        paragraphs: [
          "Every image project goes through two steps. First the AI paints a background with no text in it. Then Remotion places the title, subtitle, stats, CTA and logo on top, using the colours and fonts of the selected Style Design.",
          "Keeping the steps apart means the AI never misspells your text, and you can change the wording without repainting the background.",
        ],
      },
      {
        heading: "Create an image project",
        steps: [
          "Press **Create image** at the top of the **Images Project** page.",
          "Give it a **Name** and pick a **Style Design** - the image must follow that style's colours, fonts, logo and tone.",
          "Write the **Image prompt**: describe the content, layout and look of the background. Leave out the words that should appear on the image.",
          "Choose the **Image type**, **Background model (Gemini)** and **Aspect ratio**, and fill in **Text on image (set by Remotion)** if you need text.",
          "Press **Create image**. The project page opens - nothing is painted until you press **Generate all** there.",
        ],
      },
      {
        heading: "Options when creating",
        bullets: [
          "**Image type**: **Background**, **3D illustration**, **Character**, **Liquid Glass texture**, **Product shot** or **Ad concept** - steers what kind of background the AI paints.",
          "**Aspect ratio**: 9:16 **Portrait** (1080x1920), 16:9 **Landscape** (1920x1080), 1:1 **Square** (1080x1080) or 4:5 **Feed** (1080x1350).",
          "Model: **Default (provider set on the Connections page)**, a specific provider (**Auto**, **Gemini API**, **ChatGPT (web)**, **Gemini (web)**), or a named Gemini model. The Gemini list comes straight from Google: Lite models are cheaper and faster, Pro gives the best quality.",
          "Pick **ChatGPT (web)** and a **ChatGPT model** field appears: **GPT Image 2** (default) gives predictable results, **GPT Image 2.5** lets ChatGPT pick the newest image model your account has. It only applies when the provider is ChatGPT (web).",
          "Providers you haven't set up are locked and marked **not configured** - add the account or API key on the **Connections** page.",
        ],
      },
      {
        heading: "Text on the image",
        bullets: [
          "**Title** and **Subtitle**: the main line and the supporting line.",
          "**Stats**: press **Add stat** to add label and value pairs, e.g. Customers - 10K+.",
          "**CTA**: the call to action, e.g. Start a free trial.",
          "**Show brand logo**: stamps the Style Design's logo on the image. The logo always comes from the style's file - the AI never draws it.",
          "**Text position**: pick a cell in the 3x3 grid (top, middle, bottom by left, center, right) or **Automatic**. Automatic puts landscape text middle-left, square bottom-center and portrait bottom-left.",
          "The background's dark scrim and glow follow the text block so it stays readable, and the logo moves to the opposite corner.",
        ],
      },
      {
        heading: "The project page",
        paragraphs: [
          "The page has three columns. **Source** holds the **Settings** card where you edit the prompt and text. **Request & setup** holds the generate buttons. **Progress & output** shows the **Final image** and, under **Steps**, the background. The **AI log** panel on the right streams log lines while an image is being made.",
        ],
        bullets: [
          "**Generate all**: paints the background, then lays out the text - a finished image in one go.",
          "**Background (Gemini)**: repaints only the background with the selected model.",
          "**Compose (Remotion)**: re-applies only the text and logo on the existing background - you need a background first.",
          "**Upload background…**: use your own PNG or JPG as the background, no AI needed.",
          "**Background model**: switch models right here; the choice saves immediately.",
          "Once the final image is ready, press **Zoom** to inspect it or **Download** to save the file.",
        ],
        tip: "Only changing the wording, the text position or the logo? Edit the **Settings** card and press **Compose (Remotion)** - the background stays, so it is quick and costs no extra paint.",
      },
      {
        heading: "Saving and renaming",
        bullets: [
          "The generate buttons save your edits before they run. To save without generating, press **Save changes**.",
          "Rename the project by editing the title at the top of the page. In the list, use the pencil icon at the end of the row.",
          "A project is **Draft**, **Generating**, **Done** or **Error**. If the last run failed, the project page shows a red banner with the reason.",
        ],
      },
      {
        heading: "Cost and providers",
        paragraphs: [
          "Every background painted through the Gemini API is billed per call to your API key. ChatGPT (web) and Gemini (web) use the image allowance of the web account you added on the **Connections** page; they paint one image at a time with a short pause in between so the account isn't rate-limited.",
          "No provider at all? The page still works: press **Upload background…**, then **Compose (Remotion)**.",
        ],
      },
      {
        heading: "Cancel, clone and clean up",
        bullets: [
          "There is no stop button on the image page. To cancel a run, open **Render Queue**, find the **Image generation** job and press **Cancel**.",
          "**Clone** creates a new project that keeps the background and drops the finished image - handy for trying several text versions on one background.",
          "In the list, tick several projects to **Clean junk files** (backgrounds, final images and project info are kept) or **Delete selected**.",
        ],
        warning:
          "Deleting an image project permanently removes all of its images - there is no undo. Download the final image first if you still need it.",
      },
    ],
  },

  // ===================================================================
  "auto-cut": {
    title: "Auto cut videos",
    summary:
      "Slice one long video - a livestream, podcast or talk - into many short clips. Each segment becomes its own Videos Project, ready for captions, text and sound effects.",
    blocks: [
      {
        heading: "How a cutting session works",
        steps: [
          "On the **Auto cut videos** page, press **Create cutting session**.",
          "Choose the **Source video**: pick a file from **Pick a video from imports/** or press **Upload a video** to bring one in from your computer.",
          "Choose **How to cut**, the **Aspect ratio** and the options below, then press **Create cutting session & analyze**.",
          "The system analyzes the video and proposes a cutting plan. Open the session and review the **Segments** list.",
          "Press **Cut & create projects** to do the actual cut. Every selected segment becomes a Videos Project, reachable through **Open project**.",
        ],
      },
      {
        heading: "Three ways to cut",
        bullets: [
          "**By duration**: equal slices of **Minutes per segment** (5 by default), with an optional **Overlap (seconds)**. The fastest option, since nothing has to understand the content.",
          "**Let AI cut**: the AI reads the transcript, scores passages and picks the best ones. You set **Segments** (5 by default), **Shortest (seconds)** and **Longest (seconds)** (20 and 60 by default).",
          "**Cut on request**: like the AI mode, but you describe what to look for in **Your request**, e.g. take the parts about pricing and promotions. The session can't be created without a request.",
        ],
        tip: "The two AI modes take longer because the dialogue has to be transcribed first, but the clips they find usually hold a complete thought. An hour of video can take a few minutes at this step.",
      },
      {
        heading: "Frame size and fitting",
        bullets: [
          "**Aspect ratio**: **Keep source** (original frame, fastest), 9:16 for TikTok, Reels and Shorts, 16:9 for YouTube, 1:1 and 4:5 for Facebook and Instagram feeds.",
          "Any frame other than the source means every segment gets reframed and re-encoded, so long videos take noticeably longer. You then also choose **Fitting into the frame**.",
          "**Automatic**: the system looks at each segment - people get cropped in tight, screens and text are scaled down so the whole frame stays.",
          "**Crop to the subject**: a big subject that fills the frame, at the cost of the edges - text or objects near the border may be cut off.",
          "**Keep the whole frame**: nothing is lost, the subject gets smaller and the empty space is filled with a background.",
        ],
      },
      {
        heading: "Background filler",
        paragraphs: [
          "This only appears when you reframe without cropping, because then the original picture doesn't cover the new frame.",
        ],
        bullets: [
          "**AI background**: Gemini paints a background in the style picked under **Style Design** - the nicest result, but slower and billed to your API key.",
          "**Blurred background**: the video frame itself, enlarged and blurred - free, fast and suits anything.",
          "**Style color**: a flat fill using the Style Design's background colour - clean and on-brand.",
        ],
      },
      {
        heading: "Options and the shared edit setup",
        bullets: [
          "**Create a transcript**: turns the speech into timed text so each child project already has captions to work from. The two AI modes always keep this on.",
          "**Start AI edit right after cutting**: the AI starts building each child project as soon as it's cut. At most 3 start right away; the rest are created and wait for you.",
          "**Edit setup for the clips you cut**: expand this to set captions, key layout, sound effects, background music, skill and AI illustrations once for the whole session, instead of in every project.",
        ],
        warning:
          "**Start AI edit right after cutting** opens a separate AI session per project - it spends real tokens and keeps the machine busy for a while. Leave it off if you'd rather review the clips and decide which to build.",
      },
      {
        heading: "The session page",
        paragraphs: [
          "**Source** lets you replay the original video with its resolution, length and fps. **Request & setup** has the read-only **Session setup**, the **Edit setup** and the **Segments** list. **Progress & output** shows the running step and the **Child projects** that have been created.",
          "How to cut and the frame size are fixed when the session is created - make a new session to change them. The **Edit setup** can be changed any time the session isn't running, and saves automatically.",
        ],
      },
      {
        heading: "Review segments before cutting",
        bullets: [
          "Each segment shows its start and end time, length and a one-line description. The AI modes also show a score such as **Score 8/10**.",
          "Untick segments you don't want, or use **Select all**. Edit the title right in its box - it becomes the child project's name.",
          "**Analyze again** reruns the analysis to get a fresh plan.",
          "The **Cut & create projects** button shows how many segments it will cut: only the selected ones that don't have a project yet.",
        ],
        tip: "The plan hasn't touched any file yet - only the cut step actually encodes and takes time. Reviewing carefully here is far cheaper than cutting again.",
      },
      {
        heading: "Errors and deleting a session",
        bullets: [
          "A failed session shows a red banner with details. The button in **Child projects** reruns exactly the step that failed (**Analyze again** or **Cut & create projects**).",
          "Changes to the **Edit setup** only apply to segments cut afterwards. For projects that already exist, change the brief inside each project.",
          "Deleting a session only removes its plan and temporary files. The Videos Projects it created stay in **Videos Project**.",
        ],
      },
    ],
  },

  // ===================================================================
  "text-to-video": {
    title: "Text to video",
    summary:
      "Turn an article into a narrated video: paste a link or the text, the AI writes the narration, you pick a voice, and the system creates a Videos Project that the AI then edits using your settings.",
    blocks: [
      {
        heading: "Start a session",
        paragraphs: [
          "Each session moves through five steps - **Source**, **Script**, **Voice**, **Settings** and **Build**. Until you build, you can go back and change any of them.",
        ],
        steps: [
          "Press **Create session** and choose **Article link** or **Paste text**.",
          "Paste the link or the article. Leave **Session name (optional)** empty to use the article title.",
          "Press **Create session**. For a link, the system opens the page and extracts the main content straight away.",
        ],
      },
      {
        heading: "Step 1 - Source article",
        bullets: [
          "The extracted text lands in **Text the script will be written from**. Edit freely - the AI reads only what's in this box.",
          "Press **Extract content** or **Extract again** to fetch the article from the link once more.",
          "If a site blocks automatic reading, paste the text into the box yourself. The AI never goes looking for extra material.",
        ],
      },
      {
        heading: "Step 2 - Narration script",
        bullets: [
          "Press **Let AI write it** and Claude drafts the narration in short chunks. Once there's a script the button becomes **Rewrite**.",
          "**Length (sec)**: anywhere from 15 to 600 seconds. Leave it empty (**Auto**) and the AI decides from the content.",
          "**Script model**: **Claude Code default** is fine for most articles. It runs on the Claude Code account signed in on this machine, so no API key is needed, and your choice is remembered next time.",
          "Edit any chunk directly, press **Add chunk** to add one, or remove one with the X on that chunk.",
        ],
        warning:
          "The time next to each chunk is only an estimate from the character count - the same sentence can come out up to 28% longer or shorter. Actual times (marked actual) appear only after the voice is synthesised.",
      },
      {
        heading: "Step 3 - Pick a speech engine",
        paragraphs: [
          "Under **Speech engine** there are two cards, each marked **Ready** or **Not available** on your machine, with the reason and how to fix it.",
        ],
        bullets: [
          "**Gemini (cloud)**: 30 preset voices, high quality and fast. Needs GEMINI_API_KEY and an internet connection; every read and every preview costs money.",
          "**VieNeu (on-device)**: 14 built-in Vietnamese voices grouped by region, plus any voice you've cloned. Free and offline, but slower - roughly real time.",
          "With VieNeu the list splits into **Cloned** and **Built-in**, with a **Region** filter (**Northern**, **Central**, **Southern**). No cloned voice yet? Press **Manage voices** to go to the **Voices** page.",
        ],
      },
      {
        heading: "Step 3 - Choose and preview a voice",
        bullets: [
          "Filter with **Male**, **Female**, **Androgynous**, or type a name or quality into the search box. The low or high tag next to a voice is pitch measured from real audio.",
          "Press **Preview** on a voice before committing. With Gemini, each preview is a real synthesis that takes a few seconds and costs money.",
          "**Reading speed**: **Normal**, x0.9, x1.1, x1.2, x1.3 or x1.5. It's applied after synthesis so the voice doesn't go squeaky; x1.1-x1.2 sounds livelier while staying natural. Previews already play at this speed.",
          "Gemini also offers **TTS model** (**Server default** is the safe choice), **Language** (records intent only, doesn't change the voice) and **Reading style** - a short description such as slow, warm, like telling a story.",
        ],
        warning:
          "**Reading style** directly changes the pace: the same script can run up to 2.6x longer or shorter depending on the style. Changing it after the voice exists means every timing has to be redone.",
      },
      {
        heading: "Step 4 - Video settings",
        bullets: [
          "**Aspect ratio** (9:16, 16:9, 1:1, 4:5), **FPS** (24, 25, 30, 60) and **Style Design** decide how the finished video looks.",
          "The edit brief below is the same one Videos Project uses: captions, key layout, sound effects, background music, skill. Changes save automatically and carry over to the new project.",
          "**AI illustrations (Gemini)** is a real switch: on, the AI picks key moments and paints matching illustrations in your Style Design (about $0.05 per image); off, the video gets no AI images at all.",
        ],
      },
      {
        heading: "Step 5 - Build the video",
        paragraphs: [
          "Press **Build video** - it unlocks once there's a script and a chosen voice. The system reads the script aloud, makes a timed transcript, creates a Videos Project and hands it to the AI to edit with your step 4 settings.",
          "**Build progress** shows that project's real progress, and the **AI log** panel on the right streams the log and the whole AI edit conversation. When it's done the video plays right in **Output video**, with a **Download video** button.",
        ],
        tip: "Building is the longest step, usually tens of minutes. You can close the page - it keeps running. With VieNeu, the first read after the server starts needs an extra 15-30 seconds to load the model.",
      },
      {
        heading: "After the build",
        bullets: [
          "A session builds once. To re-render, run QC or cut clips, press **Open project (re-render, QC, clips…)** and carry on inside that project.",
          "Deleting a session removes only its article, script and voice files. The Videos Project it created stays untouched.",
        ],
      },
    ],
  },

  // ===================================================================
  "translate-video": {
    title: "Translate video",
    summary:
      "Drop in a video and the system pulls the dialogue with timecodes, the AI translates it into the language you choose, then either burns translated subtitles onto the video or reads the translation aloud in place of the original audio.",
    blocks: [
      {
        heading: "Start a session",
        steps: [
          "On the **Translate video** page, press **Create session**, optionally fill in **Session name (optional)**, then press **Create session**.",
          "On the session page, drag a video onto **Source video** or press **Upload video**. MP4, MOV and MKV all work; length, size and fps are detected automatically.",
          "Work through the five steps: **Source**, **Dialogue**, **Translation**, **Subtitles** and **Result**.",
        ],
        tip: "The session is created before the upload so big files have somewhere to go and you can watch the progress. Keep the page open until the upload finishes.",
      },
      {
        heading: "Step 2 - Pull the dialogue",
        bullets: [
          "**Language spoken in the video** is the language people speak in the video, not the one you're translating into. **Auto** gets it right most of the time; set it by hand only for mixed-language videos or loud background audio.",
          "**Speech-to-text AI**: **On this machine - faster-whisper (free)** works offline but can't tell speakers apart; **Gemini (uses the key you already have)** guesses speaker labels; **Soniox ($0.10/hour)** gives the most accurate speaker labels.",
          "Press **Pull dialogue**. It runs through the render queue, so it keeps going if you close the page, and the log appears in the **AI log** panel.",
        ],
        tip: "Planning to dub a video with several speakers? Pick a speech-to-text option that labels speakers - without labels, dubbing can only use one voice for everyone.",
      },
      {
        heading: "Step 3 - Translate",
        bullets: [
          "**Output**: **Subtitles** writes the translation on screen and keeps the original audio; **Dubbing** reads the translation aloud instead of the original audio, with no text burned in; **Both** does both.",
          "Picking a mode opens its settings window (Both opens subtitles first, then dubbing). Reopen them any time with **Configure** in the **Translation** card.",
          "The on-screen language is set under **Subtitle language**. The spoken language is set under **Dub language** and defaults to the subtitle language; choosing a different one means the AI translates twice, at double the cost.",
          "**Translation model**: **Flash (recommended, fast + cheap)**, **Pro (hard lines, idioms)** or **Flash Lite (cheapest)**. It applies to the next translation only and resets when you reload the page.",
          "Press **AI translate**. Each line shows the original above and the translation below; edit any line and it saves itself. Timecodes stay put, so subtitles never drift.",
        ],
        warning:
          "**Translate again** overwrites every hand edit, and **Pull again** overwrites both the dialogue and the translation. When you switch between Subtitles and Dubbing, translate again - dubbing needs shorter lines that fit the original timing.",
      },
      {
        heading: "Step 4 - Subtitle style",
        bullets: [
          "Adjust **Font**, **Font size (px)**, **Text colour**, **Backdrop** (**Blur**, **Solid** or **None**) and **Distance from bottom (px)**. Changes save themselves.",
          "The **Preview** box uses a real frame from your video, so you can judge the look without rendering.",
          "Only a few fonts are offered because they're verified to render Vietnamese diacritics correctly - **Vietnamese-ready (recommended)** is the safe pick. For other fonts, add them to a Style Design.",
          "Sizes are measured on the real frame, so a 4K video needs a larger font size than a 1080p one.",
        ],
      },
      {
        heading: "Dubbing settings",
        bullets: [
          "**Speech engine**: Gemini (cloud, billed per call) or VieNeu (on-device, free, and able to use your cloned voices).",
          "**Voice per speaker**: with **Pick automatically from the original pitch**, the system matches each speaker to a same-gender voice with the closest pitch and never gives two people the same voice. Voices you pick by hand are kept across rebuilds.",
          "**Preview** reads one real line from that speaker, stretched exactly as in the final render. If it already sounds rushed, the translation is too long - fix the wording before dubbing the whole video.",
          "**Keep the original audio low underneath**: leaves the original sound playing quietly below the dub.",
          "Each line is placed at its original timecode. A line longer than its slot is sped up by at most x1.25; if it still doesn't fit, it runs slightly into the next line rather than being cut off. Lip-sync is not adjusted.",
        ],
      },
      {
        heading: "Step 5 - Result",
        paragraphs: [
          "Press **Burn subtitles** in Subtitles mode, or **Dub the video** in Dubbing and Both modes. The job runs through the render queue; progress shows in **Output video** and the log in the **AI log** panel.",
          "When it's done, watch it and press **Download video** right there. **Burn again** or **Dub again** as often as you like - each run replaces the previous result.",
          "After dubbing, **Last dubbing run** tells you how many lines had to be stretched and how many overflowed. If some overflowed, shorten those exact lines and dub again.",
        ],
      },
      {
        heading: "Statuses and re-running",
        paragraphs: [
          "A session moves through **Draft**, **Pulling dialogue**, **Dialogue ready**, **Translating**, **Translated**, **Burning subtitles** and **Done**; if something breaks it shows **Failed** with the details.",
          "Every step can be rerun: **Pull again**, **Translate again**, **Burn again** or **Dub again**. If you swap in another file with **Replace video**, the old dialogue no longer matches and you'll need to pull it again.",
        ],
        warning:
          "Deleting a translate-video session also deletes the uploaded source video, the dialogue, the translation and the output video - this can't be undone. Download the result first.",
      },
    ],
  },

  // ===================================================================
  voices: {
    title: "Voices",
    summary:
      "Manage the Vietnamese voices that run on your own machine (VieNeu-TTS) and clone a real voice from a short recording, so Text to video and dubbing can speak in that voice.",
    blocks: [
      {
        heading: "Two speech engines",
        bullets: [
          "**Gemini (cloud)**: 30 preset voices that can read any language, fast. Needs GEMINI_API_KEY and an internet connection, and every read or preview is billed per call. It can't clone voices.",
          "**VieNeu (on-device)**: 14 built-in Vietnamese voices, grouped by region (Northern, Central, Southern) and reading style (newsreader, natural, storytelling). Free and offline, but slower - about real time. It's the only engine that can clone a voice.",
        ],
        paragraphs: [
          "Both engines live side by side; you choose one per session in the Voice step of Text to video or in the dubbing settings of Translate video. The **Voices** page only deals with VieNeu and your cloned voices.",
        ],
      },
      {
        heading: "The Offline voice engine card",
        paragraphs: [
          "The card at the top tells you where your machine stands: ready to speak and clone, able to speak but missing PyTorch for cloning, or not installed. If anything is missing, **How to enable offline voices** appears right below it.",
          "After installing, press **Check again**. If it's installed but the model fails to load, open **Technical detail** to see why.",
        ],
      },
      {
        heading: "Install offline voices",
        steps: [
          "Install Python 3.11 to 3.14 if you don't have it. Python 3.15 and newer won't work yet because the model's libraries don't support it.",
          "Level one - speech only: run pip install vieneu (about 30 MB). That's enough for all 14 built-in voices.",
          "Level two - voice cloning: also run pip install torch torchaudio (about 2-3 GB to download).",
          "Press **Check again**. The very first read downloads a model of about 1 GB, so it takes a while.",
        ],
        tip: "Each command has a **Copy command** button so you can paste it straight into PowerShell. If you only want offline narration, stop at level one - no need for the multi-gigabyte PyTorch download. The system check that runs when you launch the app also flags a missing VieNeu-TTS and can install it for you.",
      },
      {
        heading: "Clone a voice",
        steps: [
          "Press **Clone a voice** at the top of the page.",
          "Fill in **Voice name** - it's how you'll find the voice in Text to video. Set **Gender** and add a **Note** if you like.",
          "Under **Reference clip**, press **Choose a recording** or **Record now** to use your microphone. Audio files and phone videos with speech in them both work.",
          "Listen back to the sample, then press **Clone voice**.",
        ],
      },
      {
        heading: "What makes a good sample",
        bullets: [
          "3-8 seconds is ideal. Under 3 seconds there isn't enough of the voice to capture, and you'll be told the sample is too short.",
          "Longer isn't better: the model only uses the beginning and discards the rest. Recording in the browser stops automatically at 30 seconds.",
          "Speak clearly with no background music and no noise - the cleaner the sample, the closer the clone.",
        ],
      },
      {
        heading: "Managing cloned voices",
        bullets: [
          "Each voice card has **Play the reference clip** to hear the original sample and **Test read** to hear the clone read a sample sentence.",
          "Use **Rename** to change the name and **Delete voice** to remove it.",
          "Cloned voices are usable straight away: in Text to video choose **VieNeu (on-device)** and look in the **Cloned** group. Dubbing in Translate video can use them too.",
          "Everything runs on your machine: samples and cloned voices never leave it, and there's no per-call cost.",
        ],
        tip: "The first read after the server starts takes an extra 15-30 seconds to load the model; later reads are much faster.",
        warning:
          "Deleting a voice also deletes its reference clip. Text to video sessions that already used it keep their narration audio, but reading again will need a different voice.",
      },
    ],
  },
};
