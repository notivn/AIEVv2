import type { GuideContent } from "@/lib/guide/types";

/**
 * Nhóm "Thư viện" của bảng Hướng dẫn: Style Design, Phong cách dựng, Assets,
 * Sound Effects (kèm Nhạc nền), Prompts, Skills.
 *
 * Tên nút/ô trong `**...**` phải khớp NGUYÊN VĂN locales/vi.ts (cho `vi`) và
 * locales/en.ts (cho `en`) - đổi nhãn trên giao diện thì sửa luôn ở đây.
 */

type Ids = "styles" | "video-styles" | "assets" | "sfx" | "prompts" | "skills";

export const vi: Pick<GuideContent, Ids> = {
  styles: {
    title: "Style Design",
    summary:
      "Nơi khai báo bộ nhận diện thương hiệu: màu, font, hiệu ứng, logo và tone. Mọi ảnh và video bạn tạo đều bám 100% theo Style Design được chọn.",
    blocks: [
      {
        heading: "Style Design để làm gì",
        paragraphs: [
          "Mỗi Style Design là một bộ nhận diện gồm năm màu, hai font, hiệu ứng, logo, tone và guidelines. Project chọn style nào thì AI bắt buộc dùng đúng màu và font của style đó, ghi đè mọi quy định màu/font trong skill hay prompt.",
          "Nên tạo mỗi thương hiệu hoặc mỗi kênh một style, rồi chọn ở ô **Style Design** trong **Kịch bản edit (Brief)** của từng project. Ô chọn này cũng có ở Images Project, Text to video và Auto cut videos.",
        ],
      },
      {
        heading: "Trang danh sách",
        bullets: [
          "Mỗi thẻ hiện tên, dải năm ô màu, tag, logo (nếu có) và thời điểm sửa gần nhất. Style đang là mặc định mang nhãn **Mặc định**.",
          "Ô tìm kiếm lọc theo tên, id hoặc tag.",
          "Tick ô vuông trên thẻ để chọn nhiều style, rồi bấm **Xóa đã chọn**. Bạn phải gõ DELETE để xác nhận.",
          "Bấm vào thẻ để mở trang chi tiết và chỉnh sửa.",
        ],
      },
      {
        heading: "Tạo style mới",
        steps: [
          "Bấm **Tạo style** ở góc trên.",
          "Nhập **Tên style** và thêm tag nếu muốn.",
          "Ở ô **Sao chép từ**, chọn một style có sẵn để chép toàn bộ màu, font, logo, tone và guidelines, hoặc để **Trống** để làm từ đầu.",
          "Bấm **Tạo style** - trang chi tiết mở ra ngay để bạn chỉnh tiếp.",
        ],
        tip: "Làm style cho một kênh mới thì chép từ style gần giống nhất rồi đổi màu và logo - nhanh hơn nhiều so với điền lại từ đầu.",
      },
      {
        heading: "Màu và hiệu ứng",
        paragraphs: [
          "Cột **Bảng màu** có năm ô: **Màu chính**, **Màu phụ**, **Màu nền**, **Màu chữ** và **Màu nhấn**. Bạn chọn bằng bảng màu hoặc gõ mã hex dạng #rrggbb (thêm 2 số cuối nếu cần độ trong suốt).",
          "Khung xem trước ở cột **Nhận diện** hiện dải màu và chữ mẫu có dấu tiếng Việt, cập nhật ngay khi bạn sửa.",
        ],
        bullets: [
          "**Gradient**: chữ highlight và các bề mặt dùng chuyển màu từ màu chính sang màu phụ. Tắt đi thì chữ highlight chỉ dùng màu chính.",
          "**Liquid Glass**: chất liệu kính mờ cho chip số liệu và các phần tử 3D trong ảnh nền.",
        ],
      },
      {
        heading: "Font chữ",
        steps: [
          "Gõ tên font vào ô **Font tiêu đề (heading)** hoặc **Font nội dung (body)**, ví dụ Be Vietnam Pro. Ô nhập có sẵn gợi ý vài font hỗ trợ tốt tiếng Việt.",
          "Bấm **Tải font này**. Hệ thống tự tải file font từ Google Fonts với đầy đủ bộ dấu tiếng Việt: font tiêu đề lấy bản đậm, font nội dung lấy bản thường.",
          "Thấy dòng **Đã có file font:** kèm tên file là xong. Nếu vẫn báo chưa có file, video sẽ không render đúng font.",
        ],
        paragraphs: [
          "Font không có trên Google Fonts (font mua, font riêng của thương hiệu) thì dùng khung **File font trên máy**: bấm **Tải file** ở dòng Heading hoặc Body và chọn file .ttf, .otf, .woff hoặc .woff2. Nút X bên cạnh gỡ file đó đi.",
        ],
        warning:
          "Hệ thống không kèm sẵn font nào. Hãy chọn font có bộ dấu tiếng Việt đầy đủ, nếu không chữ có dấu sẽ bị vỡ hoặc rơi về font khác.",
      },
      {
        heading: "Logo - tự đóng ở góc trên trái",
        paragraphs: [
          "Bấm **Tải logo lên** trong khung Logo để chọn file PNG, JPG, SVG hoặc WebP. Bấm vào logo thu nhỏ để xem ở kích thước thật.",
          "Style có logo thì hệ thống tự đóng logo ở góc trên trái cho toàn bộ video ở bước lắp ráp cuối, bạn không cần dặn AI. Không muốn video có logo thì chọn một Style Design không có logo.",
        ],
        warning:
          "Đừng dặn AI chèn thêm logo góc trong prompt - video sẽ có hai logo chồng lên nhau. Logo luôn được chèn từ file, AI không bao giờ tự vẽ logo.",
      },
      {
        heading: "Tone và Guidelines",
        bullets: [
          "**Tone**: vài chữ tả giọng điệu thương hiệu, ví dụ “hiện đại, tin cậy”.",
          "**Guidelines**: quy tắc thêm cho AI khi tạo sản phẩm, ví dụ tránh nền trắng trơn, ưu tiên chiều sâu 3D.",
        ],
        tip: "Khi một video bật Phong cách dựng, phần Tone/Guidelines nào tả một ngôn ngữ hình ảnh khác (kiểu “luôn dùng 3D bóng bẩy”) sẽ bị bỏ qua - Style Design lúc đó chỉ giữ màu và font. Vì vậy nên dành Guidelines cho quy tắc thương hiệu hơn là cho kiểu hình.",
      },
      {
        heading: "Lưu, đặt mặc định và xóa",
        bullets: [
          "Tên, tag, màu, hiệu ứng, tone và guidelines chỉ được ghi khi bạn bấm **Lưu**. Tải font và tải logo thì được lưu ngay.",
          "**Đặt làm mặc định**: style này áp cho mọi project để ô Style Design ở lựa chọn **Mặc định**. Đổi style mặc định thì các project đó cũng đổi theo ở lần dựng sau.",
          "**Xóa style**: project đang trỏ vào style này quay về style mặc định. Không xóa được style cuối cùng - hệ thống luôn giữ ít nhất một style.",
        ],
        warning:
          "Sửa style không tự dựng lại video cũ. Muốn video đã làm đổi màu hay font, bạn phải render lại project đó.",
      },
    ],
  },

  "video-styles": {
    title: "Phong cách dựng",
    summary:
      "Ngôn ngữ thị giác riêng của một video: chất liệu hình ảnh (giấy gấp, mực tàu, pixel art…) và cách chuyển động. Hệ thống có sẵn 50 phong cách, bạn thêm, sửa, xóa tùy ý.",
    blocks: [
      {
        heading: "Khác gì Style Design?",
        paragraphs: [
          "Style Design là nhận diện thương hiệu: MÀU, FONT và logo, luôn được cưỡng chế. Phong cách dựng quyết định video được làm từ CHẤT LIỆU gì và CHUYỂN ĐỘNG ra sao.",
          "Hai lớp chồng lên nhau chứ không thay nhau: cùng một bộ màu thương hiệu vẫn dựng được video giấy gấp hay video pixel art.",
          "Khi được bật, phong cách dựng thắng skill ở phần hình ảnh. Skill chỉ còn giữ quy trình (thứ tự bước, cắt, phụ đề, kiểm tra), còn Style Design vẫn giữ màu và font.",
        ],
      },
      {
        heading: "Bật phong cách cho một video",
        paragraphs: [
          "Công tắc mặc định TẮT: video dựng theo đúng cấu hình đã chọn (skill + Style Design), phong cách dựng bị bỏ qua hoàn toàn kể cả khi trước đó bạn đã chọn một phong cách.",
        ],
        steps: [
          "Mở **Kịch bản edit (Brief)** của project và tìm công tắc **Phong cách dựng** ngay dưới ô Style Design.",
          "Bật công tắc. Danh sách phong cách hiện ra, mỗi phong cách kèm mô tả cách dựng cảnh và chuyển động.",
          "Bấm chọn một phong cách. Dòng **Đang chọn:** phía trên cho biết bạn đã chọn gì; danh sách dài thì dùng ô tìm kiếm.",
        ],
        warning:
          "Bật công tắc mà chưa chọn phong cách nào thì video vẫn dựng y như lúc tắt. Hãy chắc dòng **Đang chọn:** đã có tên phong cách.",
      },
      {
        heading: "Nhãn “màu riêng”",
        paragraphs: [
          "Vài phong cách như mực tàu, tranh Đông Hồ hay ảnh chụp thật có bảng màu đặc trưng, ép màu thương hiệu vào là mất chất. Chúng mang nhãn **màu riêng**.",
          "Với các phong cách này, ảnh minh họa theo bảng màu của phong cách và màu thương hiệu chỉ còn làm điểm nhấn. Chữ và đồ họa trong video thì vẫn theo đúng Style Design.",
        ],
      },
      {
        heading: "Trang danh sách",
        bullets: [
          "Mỗi thẻ hiện tên, mã phong cách, mô tả chuyển động, số project đang dùng (hoặc “chưa dùng”) và lần sửa gần nhất.",
          "Nhãn **mặc định** đánh dấu phong cách có sẵn của hệ thống, nhãn **màu riêng** như giải thích ở trên.",
          "Ô tìm kiếm lọc theo tên, mã hoặc mô tả chuyển động.",
          "Tick nhiều thẻ rồi bấm **Xóa đã chọn** để xóa hàng loạt. Nếu có phong cách đang được project dùng, hộp xác nhận sẽ báo trước.",
        ],
      },
      {
        heading: "Tạo phong cách mới",
        steps: [
          "Bấm **Tạo phong cách**.",
          "Nhập **Tên phong cách**, ví dụ “Tranh sơn mài”.",
          "Ở ô **Chép nội dung từ phong cách có sẵn**, chọn phong cách gần giống nhất để chép chỉ đạo mỹ thuật, thứ cần tránh, bảng màu và chuyển động. Chọn **Để trống - tự viết từ đầu** thì các ô được điền sẵn nội dung nháp để bạn thay.",
          "Bấm **Tạo phong cách**, sửa các ô ở trang chi tiết rồi bấm **Lưu**.",
        ],
        tip: "Nhân bản một phong cách có sẵn rồi sửa vài chỗ gần như luôn cho kết quả tốt hơn viết lại từ đầu, nhất là hai ô tiếng Anh.",
      },
      {
        heading: "Các ô trong trang chi tiết",
        bullets: [
          "**Mã phong cách (id)**: không đổi được, vì brief của các project cũ trỏ vào đúng mã này.",
          "**Tên phong cách**: hiện trên ô chọn và được đưa thẳng vào prompt cho AI.",
          "**Chỉ đạo mỹ thuật cho ảnh (tiếng Anh)**: tả chất liệu, kỹ thuật vẽ, ánh sáng, độ sâu. Câu này THAY THẾ chỉ đạo mặc định trong prompt tạo ảnh chứ không cộng thêm.",
          "**Thứ cần tránh trong ảnh (tiếng Anh)**: chặn những thứ hay lẫn vào phong cách này, ví dụ “no photographic realism, no 3D glossy render”.",
          "**Bảng màu của ảnh minh họa**: chọn **Theo màu thương hiệu** cho hầu hết phong cách, hoặc **Phong cách có màu riêng** khi phong cách có bảng màu đặc trưng.",
          "**Dựng cảnh & chuyển động (tiếng Việt)**: AI đọc phần này để dựng scene và chuyển cảnh, và đây cũng là mô tả bạn thấy khi chọn phong cách. Tả cách hình vào/ra, kiểu chuyển cảnh, nhịp và kiểu chữ.",
        ],
        paragraphs: [
          "Mọi ô có dấu * đều bắt buộc - còn ô trống thì nút **Lưu** bị khóa, vì prompt gửi AI sẽ bị cụt.",
        ],
        tip: "Hai ô về ảnh viết bằng tiếng Anh vì model tạo ảnh bám sát tiếng Anh hơn hẳn. Ô chuyển động viết tiếng Việt vì người đọc là AI dựng video và chính bạn khi chọn phong cách.",
      },
      {
        heading: "Project đang dùng",
        paragraphs: [
          "Khung **Project đang dùng phong cách này** liệt kê mọi project đang chọn phong cách, kèm loại: Videos Project, Text to video, Auto cut hoặc Dịch video.",
          "Sửa phong cách chỉ áp cho lần dựng KẾ TIẾP, video đã dựng không đổi.",
        ],
      },
      {
        heading: "Khôi phục và xóa",
        bullets: [
          "**Khôi phục bản gốc** chỉ có ở phong cách mặc định: đưa toàn bộ nội dung về bản ship kèm hệ thống, phần bạn đã sửa sẽ mất.",
          "**Xóa** mở hộp xác nhận liệt kê các project đang dùng, bạn gõ DELETE để xác nhận. Các project đó mất phong cách đã chọn và phải chọn lại nếu muốn dựng lại đúng chất liệu cũ.",
        ],
        warning:
          "Muốn bỏ phần đã sửa của một phong cách mặc định thì dùng **Khôi phục bản gốc**, đừng xóa. Phong cách đã xóa biến khỏi danh sách nên không còn trang chi tiết để bấm khôi phục nữa.",
      },
    ],
  },

  assets: {
    title: "Assets",
    summary:
      "Hai kho file dùng chung của cả hệ thống: Imports chứa file nguồn bạn đưa vào, Outputs chứa video thành phẩm đã render.",
    blocks: [
      {
        heading: "Hai bộ sưu tập",
        paragraphs: [
          "Chuyển giữa hai bộ bằng nút gạt **Imports** / **Outputs** trên thanh công cụ.",
        ],
        bullets: [
          "**Imports**: footage, ảnh, audio, phụ đề… bạn đưa vào để dùng cho nhiều project hoặc làm nguồn cho một phiên Auto cut.",
          "**Outputs**: video final đã render xong, đặt tên theo project và phiên bản. Bộ này chỉ để xem, không nhận file tải lên.",
        ],
      },
      {
        heading: "Tải file lên",
        steps: [
          "Chọn **Imports**.",
          "Bấm **Tải file lên** rồi chọn một hoặc nhiều file, hoặc kéo thả thẳng file vào khung danh sách.",
          "Chờ tải xong, danh sách tự làm mới. File nào lỗi được báo riêng, các file khác vẫn lên bình thường.",
        ],
        paragraphs: [
          "Mỗi file tối đa 2 GB. Tên file được tự đổi sang chữ không dấu nối bằng gạch; trùng tên thì tự thêm hậu tố -2, -3 chứ không ghi đè file cũ.",
        ],
      },
      {
        heading: "Loại file được nhận",
        bullets: [
          "Video: mp4, mov, webm, mkv, avi, m4v.",
          "Audio: mp3, wav, ogg, m4a, aac, flac.",
          "Ảnh: png, jpg, jpeg, gif, webp, bmp, avif.",
          "Font, phụ đề và ghi chú: ttf, otf, woff, woff2, srt, vtt, json, txt, md, csv.",
        ],
      },
      {
        heading: "Xem trước và mở file",
        paragraphs: [
          "Ảnh hiện ảnh thu nhỏ ngay trong bảng. Bấm vào một dòng bất kỳ để mở cửa sổ xem trước: video và audio phát ngay, ảnh hiện cỡ lớn.",
          "Trong cửa sổ đó, **Mở file** mở thư mục chứa file trong trình quản lý file của máy, **Mở tab mới** mở file trong tab trình duyệt. Đường dẫn của file hiện ở cuối cửa sổ.",
          "Ô tìm kiếm lọc theo tên file - tiện khi Imports đã có hàng trăm file.",
        ],
        warning:
          "Trang này không có nút xóa. Nếu bạn tự dọn thư mục imports trên máy, đừng xóa file mà project còn dùng - lần render sau sẽ lỗi thiếu file.",
      },
      {
        heading: "Logo thương hiệu trong video",
        paragraphs: [
          "Khi kịch bản nhắc tới một thương hiệu như Facebook, TikTok hay Claude, AI lấy đúng logo chính thức từ thư viện logo dùng chung của hệ thống, không vẽ lại. Thư viện này không hiện trên trang Assets.",
          "Thương hiệu chưa có trong thư viện thì hệ thống tự tìm và tải logo về, nên thư viện lớn dần sau mỗi video.",
        ],
        warning:
          "Không tìm được logo chính thức thì AI chỉ viết tên thương hiệu bằng chữ và ghi lại trong báo cáo - nó không bao giờ tự chế logo. Logo của chính bạn thì đặt ở Style Design.",
      },
    ],
  },

  sfx: {
    title: "Sound Effects",
    summary:
      "Thư viện âm thanh dùng chung cho mọi project, gồm sound effect (whoosh, pop, click…) và nhạc nền. AI đọc tag và mô tả để tự chọn âm thanh khớp nội dung.",
    blocks: [
      {
        heading: "Bố cục trang",
        bullets: [
          "**Đề xuất**: các sound effect gắn tag hay-dung - bộ AI ưu tiên lấy khi dựng video.",
          "**Thư viện**: mọi sound effect còn lại.",
          "**Nhạc nền**: thư viện nhạc riêng ở cuối trang, có ô tìm kiếm riêng.",
        ],
        paragraphs: [
          "Ô tìm kiếm ở khung **Đề xuất** lọc cả hai bảng sound effect theo tên file, tag và mô tả.",
        ],
      },
      {
        heading: "Nghe thử và chỉnh sửa",
        bullets: [
          "Bấm nút phát ở đầu dòng để **Nghe thử**, bấm lại để **Dừng**.",
          "Nút ngôi sao (**Đánh dấu đề xuất** / **Bỏ đề xuất**) bật tắt nhanh tag hay-dung, đưa sound lên hoặc xuống khu đề xuất.",
          "Nút bút chì mở hộp sửa **Mô tả** và tags.",
          "Nút thùng rác xóa file khỏi thư viện sau khi bạn xác nhận, không hoàn tác được.",
        ],
      },
      {
        heading: "Thêm sound effect",
        steps: [
          "Bấm **Thêm sound effect** ở góc trên.",
          "Chọn **File audio**.",
          "Điền **Tags (phân cách bằng dấu phẩy)**, ví dụ whoosh, transition, nhanh. Thêm tag hay-dung nếu muốn đưa thẳng vào bộ đề xuất.",
          "Viết **Mô tả**: dùng khi nào, cảm giác ra sao.",
          "Bấm **Tải lên**. Hệ thống tự đo thời lượng và thêm vào thư viện.",
        ],
        tip: "AI chọn âm thanh dựa vào tag và mô tả, nên tả càng cụ thể (ví dụ “whoosh ngắn cho chuyển cảnh nhanh”) thì AI chọn càng đúng.",
      },
      {
        heading: "Dùng sound effect trong video",
        paragraphs: [
          "Ở mục Sound effect trong **Kịch bản edit (Brief)**, bạn chọn **Dùng bộ đề xuất**, **AI tự tìm trong thư viện** hoặc **Không dùng**.",
          "AI tự đặt hiệu ứng theo nhịp và mốc thời gian của nội dung, bạn không cần chỉ định từng tiếng.",
        ],
      },
      {
        heading: "Nhạc nền",
        paragraphs: [
          "Hệ thống không kèm sẵn bài nhạc nào vì bản quyền nhạc rất phức tạp. Tính năng nhạc nền chỉ chạy khi thư viện có ít nhất một bài.",
        ],
        steps: [
          "Bấm **Thêm nhạc nền** ở góc trên.",
          "Chọn file ở ô **File audio (nhạc KHÔNG LỜI)**.",
          "Ở ô **Mood - tags (phân cách bằng dấu phẩy)**, ghi mood của bài, ví dụ nang-luong, chill, cam-hung, cang-thang, vui-ve, trang-nghiem.",
          "Thêm **Mô tả** (hợp video kiểu gì, nhịp nhanh hay chậm) rồi bấm **Tải lên**.",
        ],
      },
      {
        heading: "AI chọn nhạc và tự giảm âm lượng",
        paragraphs: [
          "Đặt mục **Nhạc nền** trong brief là **AI tự chọn theo mood**: AI chọn một bài có mood khớp nội dung video.",
          "Khi lắp ráp, nhạc tự hạ âm lượng lúc có tiếng nói và nâng lại ở quãng nghỉ (auto-ducking), nên giọng đọc luôn rõ.",
        ],
        tip: "Dùng nhạc không lời. Nhạc có lời vẫn tranh tiếng với giọng nói dù đã được hạ âm lượng.",
      },
      {
        heading: "Bản quyền",
        paragraphs: [
          "Bộ sound effect đi kèm được sưu tầm nhiều năm từ nhiều nguồn và không ghi lại giấy phép từng file. Nó có sẵn để tính năng chạy được ngay, nhưng không khuyến khích dùng cho video thương mại.",
          "Làm video thương mại thì thay bằng âm thanh của riêng bạn: nguồn CC0, Pixabay, Mixkit hoặc đã mua giấy phép.",
        ],
        warning:
          "Chỉ đưa vào thư viện nhạc mà bạn có quyền dùng cho video đăng công khai. Nhạc tải từ YouTube hay nguồn không rõ có thể khiến video bị gậy bản quyền.",
      },
    ],
  },

  prompts: {
    title: "Prompts",
    summary:
      "Thư viện prompt mẫu để dùng lại: lưu sẵn những yêu cầu edit bạn hay dùng, lần sau chọn một lần là đổ vào brief.",
    blocks: [
      {
        heading: "Prompt mẫu là gì",
        paragraphs: [
          "Mỗi prompt mẫu là một đoạn văn bản có tên, mô tả bạn muốn AI edit video thế nào: phong cách, nhịp cắt, chữ động, sound effect…",
          "Nó được đổ vào ô **Yêu cầu edit (prompt)** trong **Kịch bản edit (Brief)** của project, thay vì bạn gõ lại từ đầu mỗi lần.",
        ],
      },
      {
        heading: "Tạo prompt mẫu",
        steps: [
          "Bấm **Tạo prompt mẫu**.",
          "Đặt **Tên prompt mẫu** dễ nhận ra, ví dụ “Noti TikTok - chuyên nghiệp, sound nhẹ nhàng”.",
          "Viết **Nội dung prompt** chi tiết như khi bạn dặn một người dựng phim.",
          "Bấm **Lưu**. Muốn bỏ ngang thì bấm **Danh sách** để quay lại.",
        ],
      },
      {
        heading: "Sửa và xóa",
        bullets: [
          "Mỗi thẻ hiện tên, vài dòng đầu của nội dung và thời điểm sửa gần nhất.",
          "**Sửa** mở lại trình soạn với nội dung hiện có.",
          "**Xóa** cần gõ DELETE để xác nhận và không hoàn tác được.",
          "Ô tìm kiếm lọc theo tên hoặc nội dung prompt.",
        ],
      },
      {
        heading: "Dùng prompt trong project",
        steps: [
          "Mở **Kịch bản edit (Brief)** của project (Videos Project, Text to video hoặc Auto cut videos).",
          "Ngay trên ô **Yêu cầu edit (prompt)**, mở danh sách **Dùng prompt mẫu…** và chọn một prompt.",
          "Nội dung prompt được đổ vào ô. Nếu ô đang có chữ, hệ thống hỏi lại trước khi thay.",
          "Sửa thêm cho hợp riêng video này nếu cần.",
        ],
        paragraphs: [
          "Nút **Quản lý prompt** ngay bên cạnh đưa bạn thẳng tới trang Prompts.",
        ],
        warning:
          "Chọn prompt mẫu sẽ THAY toàn bộ nội dung đang có trong ô chứ không nối thêm. Nếu đã viết gì quan trọng, hãy chép ra trước.",
      },
      {
        heading: "Viết prompt mẫu tốt",
        bullets: [
          "Không cần ghi màu và font - Style Design đã lo phần đó.",
          "Tập trung vào thứ chỉ prompt mới nói được: nhịp cắt, chỗ cần nhấn chữ, khi nào chèn b-roll, giọng điệu.",
        ],
        tip: "Prompt mẫu chỉ là văn bản. Sửa hay xóa prompt không ảnh hưởng tới project đã dùng nó, vì nội dung đã được chép vào brief.",
      },
    ],
  },

  skills: {
    title: "Skills",
    summary:
      "Skill là bản hướng dẫn quy trình mà AI đọc trước khi dựng video. Đây là nơi tích lũy kinh nghiệm sản xuất để mọi video sau đều được hưởng.",
    blocks: [
      {
        heading: "Skill là gì",
        paragraphs: [
          "Mỗi skill là một file văn bản mô tả cách làm một việc: dựng TikTok tiếng Việt, làm phụ đề karaoke, chọn sound effect, chỉnh màu… AI đọc skill phù hợp trước khi bắt tay vào dựng.",
          "Sửa skill là sửa cách AI làm việc cho mọi video sau đó, thay vì phải nhắc lại trong từng lần chat.",
        ],
        warning:
          "Skill mới hoặc vừa sửa chỉ có hiệu lực ở phiên làm việc KẾ TIẾP của AI. Phiên đang chạy vẫn dùng bản cũ, nhưng bạn không cần khởi động lại hệ thống.",
      },
      {
        heading: "Trang danh sách",
        bullets: [
          "Mỗi thẻ hiện tên skill, mô tả ngắn, thời điểm sửa và dung lượng file.",
          "Ô tìm kiếm lọc theo tên hoặc mô tả.",
          "Bấm vào thẻ để xem và sửa nội dung.",
        ],
      },
      {
        heading: "Chọn skill cho một video",
        paragraphs: [
          "Trong **Kịch bản edit (Brief)**, ô **Skill dùng để edit** cho bạn chọn skill áp cho video đó. Chọn **Để AI tự chọn** thì AI tự lấy skill hợp với yêu cầu.",
          "Khi video bật Phong cách dựng, phần hình ảnh của skill nhường cho phong cách; skill vẫn giữ quy trình như thứ tự bước, cắt, phụ đề và kiểm tra.",
        ],
      },
      {
        heading: "Tạo skill bằng AI",
        steps: [
          "Bấm **Tạo skill bằng AI**.",
          "Điền **Mục đích & loại video**, ví dụ “Video TikTok review sản phẩm công nghệ, talking-head + b-roll, nhịp nhanh”. Đây là ô bắt buộc duy nhất.",
          "Chọn thêm **Nền tảng**, **Độ dài mục tiêu**, **Định dạng khung**, **FPS**, **Phong cách & nhịp điệu**, **Phụ đề**, **Keyword highlight** và **Sound effect đồng bộ timestamp** cho đúng loại video bạn làm.",
          "Ở **Skill mẫu tham khảo**, chọn một skill có sẵn để AI dựa vào, hoặc **Không dùng mẫu**. Có thể đặt **Tên skill (tùy chọn)** và **Ghi chú thêm**.",
          "Bấm **Tạo skill bằng AI** và chờ khoảng 1-3 phút.",
          "Ở bước **Duyệt draft skill**, đọc lại tên và **Nội dung SKILL.md**, sửa nếu cần rồi bấm **Lưu skill**.",
        ],
        tip: "Chưa ưng bản nháp thì bấm **Tạo lại** để AI soạn bản khác, hoặc **Sửa câu trả lời** để quay về biểu mẫu.",
      },
      {
        heading: "Tạo skill thủ công",
        steps: [
          "Bấm **Tạo skill**.",
          "Nhập **Tên skill (kebab-case)**: chữ thường không dấu, số và gạch nối, ví dụ tiktok-hook-mo-dau.",
          "Bấm **Tạo skill**. Skill mới có sẵn khung gồm tên, mô tả và hai mục “Khi nào dùng”, “Hướng dẫn” để bạn điền tiếp.",
        ],
        tip: "Không có nút nhân bản skill. Muốn làm skill dựa trên một skill có sẵn, hãy dùng **Tạo skill bằng AI** và chọn skill đó ở **Skill mẫu tham khảo**, hoặc tạo skill mới rồi chép nội dung sang.",
      },
      {
        heading: "Sửa và xóa skill",
        paragraphs: [
          "Trang chi tiết là một ô soạn thảo lớn chứa toàn bộ nội dung skill. Sửa xong bấm **Lưu**.",
          "Dòng description ở đầu file rất quan trọng: AI dựa vào đó để biết khi nào dùng skill. Viết rõ skill làm gì và dùng trong trường hợp nào.",
          "**Xóa** cần gõ DELETE để xác nhận và không hoàn tác được.",
        ],
        warning:
          "Giữ nguyên khối đầu file nằm giữa hai dòng --- (gồm name và description). Làm hỏng khối này thì AI có thể không nhận ra skill.",
      },
      {
        heading: "Tích lũy kinh nghiệm",
        tip: "Mỗi lần sửa được một lỗi sản xuất (chữ mất dấu, phụ đề lệch, âm thanh to nhỏ…), hãy ghi bài học vào skill liên quan. Lần sau AI sẽ không lặp lại lỗi đó.",
      },
    ],
  },
};

export const en: Pick<GuideContent, Ids> = {
  styles: {
    title: "Style Design",
    summary:
      "Where you define a brand identity: colors, fonts, effects, logo and tone. Every image and video you generate follows the selected Style Design 100%.",
    blocks: [
      {
        heading: "What a Style Design does",
        paragraphs: [
          "A Style Design bundles five colors, two fonts, effects, a logo, a tone and guidelines. Whichever style a project picks, the AI must use exactly those colors and fonts, overriding any color or font rules in skills or prompts.",
          "Create one style per brand or channel, then pick it in the **Style Design** field of each project's **Edit script (Brief)**. The same picker appears in Images Project, Text to video and Auto cut videos.",
        ],
      },
      {
        heading: "The style list",
        bullets: [
          "Each card shows the name, a strip of the five colors, tags, the logo (if any) and when it was last edited. The current default carries a **Default** badge.",
          "The search box filters by name, id or tag.",
          "Tick the checkbox on several cards, then click **Delete selected**. You have to type DELETE to confirm.",
          "Click a card to open and edit it.",
        ],
      },
      {
        heading: "Create a style",
        steps: [
          "Click **Create style** at the top.",
          "Enter a **Style name** and, optionally, some tags.",
          "In **Copy from**, pick an existing style to copy all of its colors, fonts, logo, tone and guidelines, or leave it on **Blank** to start fresh.",
          "Click **Create style** - the detail page opens so you can keep editing.",
        ],
        tip: "For a new channel, copy the closest existing style and just swap the colors and logo. It is much faster than filling everything in again.",
      },
      {
        heading: "Colors and effects",
        paragraphs: [
          "The **Color palette** column has five slots: **Primary color**, **Secondary color**, **Background color**, **Text color** and **Accent color**. Use the color picker or type a hex code such as #rrggbb (add two more digits for transparency).",
          "The preview in the **Identity** column shows the color strip and sample text with Vietnamese diacritics, and updates as you type.",
        ],
        bullets: [
          "**Gradient**: highlighted text and surfaces use a primary-to-secondary gradient. Turn it off and highlights use the primary color only.",
          "**Liquid Glass**: a frosted-glass material for stat chips and 3D elements in background images.",
        ],
      },
      {
        heading: "Fonts",
        steps: [
          "Type a font name into **Heading font** or **Body font**, for example Be Vietnam Pro. The field suggests a few fonts with good Vietnamese support.",
          "Click **Download this font**. The system fetches the font from Google Fonts with the full Vietnamese character set - bold for the heading font, regular for the body font.",
          "When **Font file present:** appears with a file name, you are done. If it still says there is no file, renders will not use the right font.",
        ],
        paragraphs: [
          "For fonts that are not on Google Fonts (purchased or custom brand fonts), use the **Font files on disk** box: click **Upload file** on the Heading or Body row and pick a .ttf, .otf, .woff or .woff2 file. The X button next to it removes the file.",
        ],
        warning:
          "No fonts ship with the system. Pick a font that covers Vietnamese diacritics, otherwise accented text breaks or falls back to another font.",
      },
      {
        heading: "Logo - stamped top-left automatically",
        paragraphs: [
          "Click **Upload logo** in the Logo box and choose a PNG, JPG, SVG or WebP file. Click the small logo to see it at full size.",
          "When a style has a logo, the system stamps it in the top-left corner of the whole video during final assembly - you do not need to ask the AI. If you want no logo, pick a Style Design without one.",
        ],
        warning:
          "Do not ask the AI to add a corner logo in your prompt - you would end up with two logos on top of each other. Logos are always inserted from files; the AI never draws one.",
      },
      {
        heading: "Tone and Guidelines",
        bullets: [
          "**Tone**: a few words describing the brand voice, e.g. \"modern, trustworthy\".",
          "**Guidelines**: extra rules for the AI when generating, e.g. avoid plain white backgrounds, prefer 3D depth.",
        ],
        tip: "When a video turns on an edit style, any Tone or Guidelines text that describes a different visual language (say, \"always glossy 3D\") is set aside and the Style Design only keeps colors and fonts. Keep Guidelines for brand rules rather than for a look.",
      },
      {
        heading: "Save, set default, delete",
        bullets: [
          "Name, tags, colors, effects, tone and guidelines are only stored when you click **Save**. Font downloads and logo uploads are saved immediately.",
          "**Set as default**: this style applies to every project whose Style Design field is left on **Default**. Changing the default changes those projects too, from their next build.",
          "**Delete style**: projects pointing at it fall back to the default style. The last remaining style cannot be deleted.",
        ],
        warning:
          "Editing a style does not re-render finished videos. To update the colors or fonts of a video you already made, render that project again.",
      },
    ],
  },

  "video-styles": {
    title: "Edit styles",
    summary:
      "The visual language of a single video: what it is made of (folded paper, ink wash, pixel art…) and how it moves. 50 styles ship with the system, and you can add, edit or delete them.",
    blocks: [
      {
        heading: "How is this different from Style Design?",
        paragraphs: [
          "Style Design is your brand identity - COLORS, FONTS and logo - and it is always enforced. An edit style decides the MATERIAL the video is made of and how it MOVES.",
          "The two layers stack rather than replace each other: the same brand palette can drive a folded-paper video or a pixel-art one.",
          "When it is on, the edit style beats the skill on everything visual. The skill keeps only the workflow (step order, cutting, subtitles, checks), and Style Design still owns colors and fonts.",
        ],
      },
      {
        heading: "Turn a style on for a video",
        paragraphs: [
          "The switch is OFF by default: the video is built from what you already picked (skill + Style Design), and any edit style is ignored completely, even one you selected earlier.",
        ],
        steps: [
          "Open the project's **Edit script (Brief)** and find the **Edit style** switch just below the Style Design field.",
          "Turn it on. The style list appears, each entry with a description of its staging and motion.",
          "Click a style. The **Selected:** line above confirms your choice; use the search box when the list is long.",
        ],
        warning:
          "Switching it on without picking a style builds the video exactly as if the switch were off. Make sure **Selected:** shows a style name.",
      },
      {
        heading: "The \"own palette\" badge",
        paragraphs: [
          "Some styles - ink wash, Dong Ho folk prints, real photography - have a signature palette that brand colors would ruin. They carry an **own palette** badge.",
          "For these, generated images follow the style's palette and brand colors only appear as accents. Text and graphics in the video still follow your Style Design exactly.",
        ],
      },
      {
        heading: "The style list",
        bullets: [
          "Each card shows the name, the style id, the motion description, how many projects use it (or \"unused\") and when it was last edited.",
          "The **built-in** badge marks styles that ship with the system; **own palette** is explained above.",
          "The search box filters by name, id or motion description.",
          "Tick several cards and click **Delete selected** to remove them in one go. The confirmation warns you if any of them are still used by projects.",
        ],
      },
      {
        heading: "Create a style",
        steps: [
          "Click **Create edit style**.",
          "Enter a **Style name**, e.g. \"Lacquer painting\".",
          "In **Copy the content of an existing style**, pick the closest style to copy its art direction, avoid list, palette mode and motion notes. With **Leave empty - write from scratch**, the fields start with placeholder text for you to replace.",
          "Click **Create edit style**, edit the fields on the detail page, then click **Save**.",
        ],
        tip: "Cloning a built-in style and tweaking a few lines almost always beats writing one from scratch, especially for the two English fields.",
      },
      {
        heading: "Fields on the detail page",
        bullets: [
          "**Style id**: cannot be changed, because existing project briefs point at this exact id.",
          "**Style name**: shown in the picker and passed straight into the AI's prompt.",
          "**Art direction for images (English)**: material, drawing technique, lighting, depth. It REPLACES the default art direction in the image prompt rather than adding to it.",
          "**What images must avoid (English)**: blocks what tends to creep into this style, e.g. \"no photographic realism, no 3D glossy render\".",
          "**Palette for generated images**: **Follow the brand colours** for most styles, or **The style has its own palette** when the style has a signature palette.",
          "**Scene & motion (Vietnamese)**: the AI reads this to build scenes and transitions, and it is also the description you see when picking a style. Describe how things enter and leave, transitions, pacing and typography.",
        ],
        paragraphs: [
          "Every field marked * is required - while one is empty, **Save** stays disabled, since the prompt sent to the AI would be truncated.",
        ],
        tip: "The two image fields are in English because the image model follows English far more closely. The motion field is in Vietnamese because its readers are the AI editor and you, when you pick a style.",
      },
      {
        heading: "Projects using the style",
        paragraphs: [
          "The **Projects using this style** box lists every project that picked it, labeled Videos Project, Text to video, Auto cut or Translate video.",
          "Edits apply to the NEXT build only; videos already rendered stay as they are.",
        ],
      },
      {
        heading: "Restore and delete",
        bullets: [
          "**Restore original** is only offered on built-in styles: it puts the whole style back to the shipped version, and your edits are lost.",
          "**Delete** opens a confirmation listing the projects that use the style; type DELETE to confirm. Those projects lose their style choice and need a new pick to rebuild with the same look.",
        ],
        warning:
          "To undo your edits to a built-in style, use **Restore original** instead of deleting it. A deleted style disappears from the list, so there is no detail page left to restore it from.",
      },
    ],
  },

  assets: {
    title: "Assets",
    summary:
      "The two shared file stores of the system: Imports holds the source files you bring in, Outputs holds the finished videos.",
    blocks: [
      {
        heading: "Two collections",
        paragraphs: [
          "Switch between them with the **Imports** / **Outputs** toggle in the toolbar.",
        ],
        bullets: [
          "**Imports**: footage, images, audio, subtitles and so on that you bring in for several projects or as the source of an Auto cut session.",
          "**Outputs**: final renders, named after the project and version. This collection is view-only and does not accept uploads.",
        ],
      },
      {
        heading: "Upload files",
        steps: [
          "Select **Imports**.",
          "Click **Upload files** and pick one or more files, or drag them straight onto the list.",
          "Wait for the upload to finish; the list refreshes on its own. Any file that fails is reported separately while the rest still go through.",
        ],
        paragraphs: [
          "Each file can be up to 2 GB. File names are converted to plain lowercase words joined by hyphens, and a name clash gets a -2, -3 suffix instead of overwriting the existing file.",
        ],
      },
      {
        heading: "Accepted file types",
        bullets: [
          "Video: mp4, mov, webm, mkv, avi, m4v.",
          "Audio: mp3, wav, ogg, m4a, aac, flac.",
          "Images: png, jpg, jpeg, gif, webp, bmp, avif.",
          "Fonts, subtitles and notes: ttf, otf, woff, woff2, srt, vtt, json, txt, md, csv.",
        ],
      },
      {
        heading: "Preview and open files",
        paragraphs: [
          "Images show a thumbnail right in the table. Click any row to open the preview: video and audio start playing, images are shown large.",
          "In that window, **Open file** reveals the file in your computer's file manager and **Open in new tab** opens it in a browser tab. The file's path is shown at the bottom.",
          "The search box filters by file name - handy once Imports holds hundreds of files.",
        ],
        warning:
          "There is no delete button on this page. If you clean up the imports folder on disk yourself, leave alone any file a project still uses, or its next render fails with a missing file.",
      },
      {
        heading: "Brand logos in your videos",
        paragraphs: [
          "When a script mentions a brand such as Facebook, TikTok or Claude, the AI takes the official logo from the system's shared brand-logo library instead of redrawing it. That library is not shown on the Assets page.",
          "If a brand is not in the library yet, the system looks it up and downloads the logo automatically, so the library grows with every video.",
        ],
        warning:
          "If no official logo can be found, the AI writes the brand name as text and mentions it in its report - it never invents a logo. Your own brand logo belongs in Style Design.",
      },
    ],
  },

  sfx: {
    title: "Sound Effects",
    summary:
      "The shared sound library for every project: sound effects (whoosh, pop, click…) plus background music. The AI reads the tags and descriptions to pick sounds that fit the content.",
    blocks: [
      {
        heading: "Page layout",
        bullets: [
          "**Recommended**: sound effects tagged hay-dung - the set the AI reaches for first.",
          "**Library**: every other sound effect.",
          "**Background music**: a separate music library at the bottom of the page, with its own search box.",
        ],
        paragraphs: [
          "The search box in the **Recommended** card filters both sound effect tables by file name, tag and description.",
        ],
      },
      {
        heading: "Preview and edit",
        bullets: [
          "Click the play button at the start of a row to **Preview**, and again to **Stop**.",
          "The star button (**Mark as recommended** / **Remove from recommended**) toggles the hay-dung tag, moving the sound into or out of the recommended set.",
          "The pencil button edits the **Description** and tags.",
          "The trash button deletes the file from the library after you confirm; it cannot be undone.",
        ],
      },
      {
        heading: "Add a sound effect",
        steps: [
          "Click **Add sound effect** at the top.",
          "Choose the **Audio file**.",
          "Fill in **Tags (comma-separated)**, e.g. whoosh, transition, fast. Add hay-dung to put it straight into the recommended set.",
          "Write a **Description**: when to use it and how it feels.",
          "Click **Upload**. The duration is measured automatically and the sound joins the library.",
        ],
        tip: "The AI picks sounds from their tags and descriptions, so be specific - \"short whoosh for quick scene changes\" gets much better picks than \"whoosh\".",
      },
      {
        heading: "Using sound effects in a video",
        paragraphs: [
          "In the Sound effect section of the **Edit script (Brief)**, choose **Use the recommended set**, **AI searches the library** or **None**.",
          "The AI places effects on the beats and timestamps of the content itself; you do not need to specify each sound.",
        ],
      },
      {
        heading: "Background music",
        paragraphs: [
          "No music ships with the system, because music licensing is messy. Background music only works once the library has at least one track.",
        ],
        steps: [
          "Click **Add background music** at the top.",
          "Pick a file in **Audio file (INSTRUMENTAL music)**.",
          "In **Mood - tags (comma-separated)**, enter the track's mood, e.g. nang-luong, chill, cam-hung, cang-thang, vui-ve, trang-nghiem.",
          "Add a **Description** (what kind of video it suits, fast or slow) and click **Upload**.",
        ],
      },
      {
        heading: "Automatic picks and ducking",
        paragraphs: [
          "Set **Background music** in the brief to **AI picks by mood** and the AI chooses a track whose mood fits the video.",
          "During assembly the music dips automatically whenever someone speaks and comes back up in the pauses (auto-ducking), so the voice stays clear.",
        ],
        tip: "Stick to instrumental tracks. Lyrics still compete with the narration even when the music is ducked.",
      },
      {
        heading: "Licensing",
        paragraphs: [
          "The bundled sound effects were collected over years from assorted sources with no licensing records. They ship so the feature works out of the box, but they are not recommended for commercial videos.",
          "For commercial work, replace them with your own audio: CC0 sources, Pixabay, Mixkit, or sounds you have a license for.",
        ],
        warning:
          "Only add music you have the right to use in publicly posted videos. Tracks ripped from YouTube or from unknown sources can get your video hit with copyright claims.",
      },
    ],
  },

  prompts: {
    title: "Prompts",
    summary:
      "A library of reusable prompt templates: save the edit requests you use often and drop one into a brief with a single pick.",
    blocks: [
      {
        heading: "What a prompt template is",
        paragraphs: [
          "A prompt template is a named piece of text describing how you want the AI to edit: style, cut pacing, kinetic text, sound effects and so on.",
          "It fills the **Edit request (prompt)** field in a project's **Edit script (Brief)**, so you do not have to type the same instructions every time.",
        ],
      },
      {
        heading: "Create a template",
        steps: [
          "Click **Create prompt template**.",
          "Give it a recognizable **Template name**, e.g. \"Noti TikTok - professional, gentle sound\".",
          "Write the **Prompt content** in as much detail as you would brief a human editor.",
          "Click **Save**. To leave without saving, click **List**.",
        ],
      },
      {
        heading: "Edit and delete",
        bullets: [
          "Each card shows the name, the first few lines of the content and when it was last edited.",
          "**Edit** reopens the editor with the current content.",
          "**Delete** asks you to type DELETE and cannot be undone.",
          "The search box filters by name or prompt content.",
        ],
      },
      {
        heading: "Use a template in a project",
        steps: [
          "Open the project's **Edit script (Brief)** (Videos Project, Text to video or Auto cut videos).",
          "Just above **Edit request (prompt)**, open **Use a prompt template…** and pick one.",
          "The template text lands in the field. If the field already has text, you are asked before it is replaced.",
          "Adjust it for this particular video if needed.",
        ],
        paragraphs: [
          "The **Manage prompts** button next to it takes you straight to the Prompts page.",
        ],
        warning:
          "Picking a template REPLACES everything in the field; it does not append. Copy out anything important you already wrote first.",
      },
      {
        heading: "Writing good templates",
        bullets: [
          "Leave colors and fonts out - Style Design already handles them.",
          "Focus on what only a prompt can say: cut pacing, which points get kinetic text, when to bring in b-roll, the tone of voice.",
        ],
        tip: "Templates are just text. Editing or deleting one does not affect projects that used it, because the content was copied into their brief.",
      },
    ],
  },

  skills: {
    title: "Skills",
    summary:
      "A skill is a written procedure the AI reads before building a video. This is where production know-how accumulates so every future video benefits.",
    blocks: [
      {
        heading: "What a skill is",
        paragraphs: [
          "Each skill is a text file describing how to do one job: build a Vietnamese TikTok, make karaoke subtitles, pick sound effects, grade color… The AI reads the relevant skill before it starts building.",
          "Editing a skill changes how the AI works on every video after that, instead of you repeating the same instructions in each chat.",
        ],
        warning:
          "New or edited skills only take effect in the AI's NEXT working session. A session already running keeps the old version, but no restart of the system is needed.",
      },
      {
        heading: "The skill list",
        bullets: [
          "Each card shows the skill name, a short description, when it was last edited and its file size.",
          "The search box filters by name or description.",
          "Click a card to view and edit its content.",
        ],
      },
      {
        heading: "Pick a skill for a video",
        paragraphs: [
          "In the **Edit script (Brief)**, the **Skill used for editing** field sets the skill for that video. With **Let the AI choose**, the AI picks a skill that fits the request.",
          "When the video has an edit style turned on, the visual parts of the skill give way to that style; the skill still drives the workflow - step order, cutting, subtitles and checks.",
        ],
      },
      {
        heading: "Create a skill with AI",
        steps: [
          "Click **Create skill with AI**.",
          "Fill in **Purpose & video type**, e.g. \"TikTok tech product review, talking-head + b-roll, fast pacing\". This is the only required field.",
          "Set **Platform**, **Target length**, **Frame format**, **FPS**, **Style & pacing**, **Subtitles**, **Keyword highlight** and **Timestamp-synced sound effects** to match the kind of video you make.",
          "Under **Reference skill template**, pick an existing skill for the AI to build on, or **No template**. You can also set a **Skill name (optional)** and **Extra notes**.",
          "Click **Create skill with AI** and wait about 1-3 minutes.",
          "In **Review skill draft**, check the name and the **SKILL.md content**, edit if needed, then click **Save skill**.",
        ],
        tip: "Not happy with the draft? Click **Regenerate** for a fresh version, or **Edit answers** to go back to the form.",
      },
      {
        heading: "Create a skill by hand",
        steps: [
          "Click **Create skill**.",
          "Enter a **Skill name (kebab-case)**: lowercase letters, numbers and hyphens, e.g. tiktok-hook-intro.",
          "Click **Create skill**. The new skill starts from a template with a name, a description and two sections to fill in: \"Khi nào dùng\" (when to use) and \"Hướng dẫn\" (instructions).",
        ],
        tip: "There is no clone button. To base a skill on an existing one, use **Create skill with AI** and pick it as the **Reference skill template**, or create a new skill and paste the old content in.",
      },
      {
        heading: "Edit and delete a skill",
        paragraphs: [
          "The detail page is one large editor holding the whole skill. Click **Save** when you are done.",
          "The description line at the top matters a lot: the AI uses it to decide when the skill applies. Say clearly what the skill does and when to use it.",
          "**Delete** asks you to type DELETE and cannot be undone.",
        ],
        warning:
          "Keep the header block between the two --- lines (name and description) intact. If it breaks, the AI may no longer recognize the skill.",
      },
      {
        heading: "Building up know-how",
        tip: "Every time you fix a production problem (lost diacritics, drifting subtitles, sound levels…), write the lesson into the relevant skill. The AI will not repeat that mistake next time.",
      },
    ],
  },
};
