# Có gì mới ở VocabFlash

Tổng hợp những thay đổi qua từng bản cập nhật, mới nhất ở trên cùng.

---

## Phiên bản 2.1.0 — 20/09/2026
### Giao diện song ngữ Anh – Việt

VocabFlash giờ có thể dùng hoàn toàn bằng **tiếng Anh**, không chỉ tiếng Việt như trước. Đổi ngôn ngữ ngay trong app, không cần cài lại hay đổi trình duyệt.

**Có gì mới**

- **Chuyển ngôn ngữ tức thì:** Nút chuyển ngôn ngữ (cờ Anh/Việt) ở góc header và trang giới thiệu — bấm là đổi toàn bộ giao diện ngay lập tức, không cần tải lại trang.
- **Ghi nhớ lựa chọn:** Ngôn ngữ bạn chọn được lưu lại, lần sau mở app vẫn giữ nguyên. Máy mới hoặc chưa từng chọn thì mặc định là tiếng Anh.
- **Phủ toàn bộ hành trình chính:** Trang giới thiệu, đăng nhập/đăng ký, tổng quan, bộ thẻ, chế độ học, luyện nhanh, đề quiz (tạo/làm/xem lại), changelog và các thông báo lỗi từ hệ thống — tất cả đều đổi theo ngôn ngữ đã chọn.
- **Thông báo lỗi rõ ràng ở cả hai ngôn ngữ:** Lỗi từ máy chủ (sai mật khẩu, hết hạn mức AI, quiz chưa đủ thẻ...) hiện đúng ngôn ngữ giao diện thay vì luôn bằng một thứ tiếng.

**Lưu ý**

- Khu vực quản trị viên và nội dung do AI sinh ra (câu hỏi, giải thích) giữ nguyên như cũ, không đổi theo lựa chọn ngôn ngữ — đây là chủ đích, không phải thiếu sót.

---

## Phiên bản 2.0.1 — 19/09/2026
### Cải thiện tính năng Quiz (Bài kiểm tra)

Làm quiz giờ rõ ràng hơn ở mỗi bước: bạn biết mình đang được hỏi gì ngay khi nhìn vào câu hỏi, và phần phản hồi sau khi trả lời gọn gàng, đỡ khô khan hơn.

**Có gì mới**

- **Câu hỏi hướng dẫn thay cho nhãn dạng:** Mỗi câu hiện một dòng hỏi ngắn bằng tiếng Anh ngay trên đề, ví dụ *Which syllable carries the main stress?* hay *Which word fills the blank?*, thay cho tên dạng câu hỏi. Không cần đoán dạng nào nghĩa là gì nữa. Áp dụng cho cả bảy dạng câu hỏi.
- **Giải thích ngay lúc chọn dạng:** Ở bước chọn dạng câu hỏi khi tạo quiz, mỗi dạng có thêm một dòng hỏi mẫu bên dưới tên để bạn biết trước sẽ gặp gì.
- **Lời phản hồi đa dạng:** Sau mỗi câu, thay vì chỉ *Correct!* hay *Not quite*, app xoay vòng nhiều câu khác nhau như *Nice one!*, *Spot on!*, *Almost there*, *Good try*. Câu sai được nói nhẹ nhàng hơn để việc ôn không nặng nề.

**Đã tốt hơn**

- **Phản hồi gọn trong một khung:** Kết quả đúng/sai, phần giải thích và nút *Next question* giờ nằm chung một khung có màu xanh hoặc đỏ nhạt, giải thích ở bên trái còn nút tiếp theo bên phải, không còn chiếm thêm một hàng riêng bên dưới. Nút *Next* nhỏ lại và có mũi tên.
- **Màu dạng câu hỏi nhất quán:** Ở trang chi tiết quiz, các dạng câu hỏi dùng đúng màu như ở danh sách quiz, nên nhìn là nhận ra dạng nào.

---

## Phiên bản 2.0.0 — 19/09/2026
### Bộ mặt mới & Đăng nhập bằng Google

Từ trước đến nay, ai mở VocabFlash lần đầu cũng chỉ thấy đúng một thứ: ô đăng nhập. Bản 2.0.0 thay đổi điều đó — app giờ có **trang giới thiệu** để bạn xem app làm được gì trước khi tạo tài khoản, và **đăng nhập bằng Google** để vào học chỉ trong một cú bấm, không cần nghĩ mật khẩu mới.

**Có gì mới**

- **Trang giới thiệu:** Mở vocabflash lên là thấy ngay app làm được gì — thẻ từ vựng lật thử được tại chỗ, một câu quiz bấm chọn đáp án được luôn, cùng ba trụ cột của app và ba bước học. Bạn xem xong rồi mới quyết định đăng ký. Khi đã đăng nhập, trang chủ vẫn là trang tổng quan như cũ, không có gì thay đổi.
- **Đăng nhập bằng Google:** Bấm *Continue with Google* là vào được, không cần đặt và nhớ thêm một mật khẩu nữa.
- **Tài khoản cũ tự nhận diện:** Nếu bạn từng đăng ký bằng email và giờ đăng nhập bằng Google cùng email đó, app tự nhận ra đúng tài khoản của bạn — toàn bộ bộ thẻ, buổi học và lịch sử quiz còn nguyên, không bị tạo thành tài khoản thứ hai.
- **Vẫn giữ cả hai đường vào:** Sau khi liên kết Google, mật khẩu cũ của bạn vẫn dùng được. Mất quyền truy cập Gmail thì vẫn đăng nhập bằng mật khẩu như thường, và ngược lại.
- **Ảnh đại diện từ Google:** Tài khoản đăng nhập bằng Google sẽ lấy luôn ảnh đại diện Google, khỏi phải tải lên.
- **Nhận diện mới:** VocabFlash có logo và favicon mới, kèm thẻ xem trước khi bạn chia sẻ link app cho người khác.

**Đã tốt hơn**

- **Câu hỏi trọng âm chính xác hơn:** Dạng *Word stress* giờ hiện từ ở dạng nguyên vẹn thay vì tách âm tiết sẵn, nên không còn gợi ý lộ đáp án. Phần giải thích kèm phiên âm có đánh dấu trọng âm để bạn đối chiếu, và các phương án không còn tự để lộ đáp án qua cách viết hoa.
- **Báo lỗi đúng chuyện đang xảy ra:** Khi có sự cố, app hiện đúng lý do từ hệ thống thay vì một câu báo lỗi chung chung không giúp được gì.

**Lưu ý**

- Đăng nhập Google cần được cấu hình trên hệ thống mới hiện ra. Chưa cấu hình thì trang đăng nhập vẫn chỉ có email và mật khẩu như trước, mọi thứ khác không ảnh hưởng.
- Tài khoản đăng ký bằng mật khẩu vẫn chưa có bước xác thực email; chỉ tài khoản vào bằng Google được đánh dấu là đã xác thực.

---

## Phiên bản 1.1.1 — 18/09/2026
### Thêm hai dạng câu hỏi AI mới

- Thêm hai dạng câu hỏi AI: **Verb tense** (điền dạng chia đúng của động từ vào câu có mốc thời gian rõ ràng) và **Word stress** (chọn âm tiết mang trọng âm). Cả hai chỉ hiện với tài khoản đã được bật quyền AI. Dạng Word stress có số phương án bằng số âm tiết của từ (2–4), nên là dạng đầu tiên không cố định 4 phương án.

---

## Phiên bản 1.1.0 — 16/09/2026
### Soạn đề bằng AI

Quiz giờ không chỉ là chọn nghĩa nữa. Bạn có thể nhờ **AI soạn đề** từ chính bộ thẻ của mình, với hai dạng câu hỏi mà trước đây app không làm được, và có giải thích cho từng đáp án đúng.

**Có gì mới**

- **Hai dạng câu hỏi mới:** *Fill in the blank* (điền từ vào chỗ trống) và *Choose the word in context* (chọn từ đúng theo ngữ cảnh). Hai dạng này nằm cạnh các dạng cũ lúc tạo quiz, có gắn nhãn *AI* để bạn nhận ra. Vẫn là trắc nghiệm 4 đáp án nên cách làm bài và chấm điểm không đổi.
- **Giải thích sau mỗi câu:** Câu nào do AI soạn cũng kèm một đoạn giải thích vì sao đáp án đó đúng. Bạn đọc được ngay sau khi trả lời, và xem lại được ở trang xem lại bài.
- **AI soạn từ bộ thẻ của bạn:** Câu hỏi dựa trên chính những từ bạn đã lưu — AI không tự nghĩ ra từ mới hay chủ đề lạ.
- **Soạn đề chạy nền:** Đề AI mất khoảng 10–40 giây. Bạn cứ đóng cửa sổ và làm việc khác, quiz hiện trạng thái đang soạn rồi tự sẵn sàng trong danh sách khi xong.
- **Hỏng thì thử lại được:** Nếu AI soạn không xong, quiz hiện lý do kèm nút *Try again* (tối đa 3 lần cho mỗi đề). Còn nếu bạn trộn dạng cũ với dạng AI, phần câu hỏi thường vẫn dùng được kể cả khi phần AI hỏng — không mất trắng cả đề.
- **Nội dung AI được đánh dấu:** Quiz có câu do AI viết mang nhãn *AI-generated* để bạn cân nhắc khi đọc — AI vẫn có thể sai.
- **Hạn mức mỗi ngày:** Mỗi tài khoản soạn được 20 đề AI trong vòng 24 giờ. Hết hạn mức thì các dạng câu hỏi cũ vẫn dùng bình thường, không ảnh hưởng gì.

**Dành cho quản trị viên**

- **Trang quản lý người dùng:** Xem danh sách tài khoản kèm số buổi học, số thẻ, số quiz và mức dùng AI; tìm theo tên hoặc email, lọc theo vai trò và trạng thái AI.
- **Điều chỉnh AI cho từng người:** Bật hoặc tắt AI cho riêng một tài khoản, và đặt hạn mức ngày riêng thay cho mức chung của hệ thống.

---

## Phiên bản 1.0.0 — 14/09/2026
### Giao diện mới & Ôn nhanh

Đây là lần "thay áo" lớn nhất của VocabFlash. Toàn bộ giao diện được làm lại cho gọn gàng, dễ nhìn hơn, và có thêm **Ôn nhanh** để bạn luyện tập chỉ với một cú bấm.

**Có gì mới**

- **Ôn nhanh:** Mở bất kỳ bộ thẻ nào và bấm *Ôn nhanh* là vào luyện ngay, không cần tạo bài quiz như trước. Bạn có thể chọn ôn tất cả, chỉ những từ chưa thuộc, hoặc chỉ những từ đã thuộc. Biết đúng sai ngay sau mỗi câu, cuối buổi có bảng tổng kết để thấy mình yếu ở đâu. Ôn nhanh không tính vào điểm hay thống kê, nên bạn cứ luyện thoải mái. (Bộ thẻ cần có ít nhất 4 từ.)
- **Giao diện dễ nhìn hơn:** Chữ rõ ràng hơn, màu dịu mắt khi học lâu, thanh điều hướng luôn ở trên cùng kèm chuỗi ngày học liên tiếp.
- **Kho bộ thẻ riêng:** Danh sách bộ thẻ có trang riêng, mỗi bộ hiện ngày tạo và tiến độ học, tìm lại nhanh hơn.
- **Quản lý thẻ dễ hơn hẳn:** Tìm kiếm thẻ theo từ khóa, lọc nhanh theo nhóm (từ vựng, cụm từ, chưa thuộc, đã thuộc), sắp xếp theo nhiều kiểu, và chọn nhiều thẻ cùng lúc để đánh dấu hoặc xóa hàng loạt.
- **Xem lại kết quả rõ hơn:** Thêm phần thống kê nhanh ở đầu trang và thẻ *Tiến bộ* — đối chiếu lần làm đầu với lần gần nhất để thấy mình khá lên bao nhiêu.

**Đã sửa**

- Vào thẳng trang Ôn nhanh không còn bị trắng trang.
- Không thể trả lời hai lần cho cùng một câu.
- Đổi bộ lọc trong danh sách thẻ luôn hiện đúng kết quả.
- Nút quay lại ở trang bộ thẻ giờ về đúng kho bộ thẻ.
- Sửa các lỗi hiển thị lệch màu, vỡ bố cục trên màn hình nhỏ.
- Thẻ đã thuộc dễ đọc hơn, chữ không còn bị chìm.
- Tên bộ thẻ không còn bị cắt trên biểu đồ tiến độ.

---

## Phiên bản 0.4.0 — 10/09/2026
### Quiz trắc nghiệm

VocabFlash không chỉ để lật thẻ nữa — giờ bạn có thể **tự kiểm tra**. App tự ra đề trắc nghiệm từ bộ thẻ của bạn, chấm điểm và lưu lịch sử để theo dõi tiến bộ.

**Có gì mới**

- **Tạo quiz từ bộ thẻ của bạn:** Ba kiểu câu hỏi (Anh → Việt, Việt → Anh, chọn từ đồng nghĩa), mỗi câu 4 đáp án. Có thể gộp nhiều bộ thẻ vào một bài để ôn tổng hợp. (Cần ít nhất 4 thẻ.)
- **Làm bài và xem lại:** Biết đúng sai ngay sau mỗi câu, xem lại từng câu đã làm, và có lịch sử đầy đủ mọi lần làm để so sánh.
- **Bài cũ luôn được giữ nguyên:** Dù sau này bạn sửa hay xóa thẻ, các bài quiz đã làm và điểm số vẫn còn nguyên vẹn.
- **Chấm điểm công bằng:** Không xem trộm được đáp án trước, mỗi câu chỉ chấm một lần và nộp rồi thì không sửa được nữa.

**Đã sửa**

- Nút *Xem lại* trong lịch sử giờ mở đúng bài cần xem.
- Nhãn *NEW* trên trang chủ không còn đè lên chữ.
- Chỉnh lại cỡ chữ tiêu đề quiz cho dễ đọc.
- Bấm vào tên bộ thẻ trong trang quiz mở thẳng được bộ thẻ đó.

---

## Phiên bản 0.3.0 — 09/09/2026
### Trang tổng quan & theo dõi tiến độ

Trả lời câu hỏi "mình học được bao nhiêu rồi?" bằng số liệu thật, thay vì đoán theo cảm giác.

**Có gì mới**

- **Bảng thống kê:** Xem nhanh tổng số từ, số từ đã thuộc, mức độ thành thạo và chuỗi ngày học liên tiếp.
- **Biểu đồ tiến độ:** Xem số từ học mỗi ngày (7 ngày hoặc 30 ngày) và tiến độ của từng bộ thẻ để biết bộ nào đang bỏ dở.
- **Chuỗi ngày học chính xác hơn:** Tính theo giờ của bạn nên "hôm nay" đúng là hôm nay; chưa kịp học trong ngày thì chuỗi vẫn được giữ, không tụt về 0. Học đi học lại một từ trong ngày cũng không làm phồng số liệu.

**Đã sửa**

- Tên bộ thẻ quá dài không còn làm vỡ biểu đồ (giờ được rút gọn, đưa chuột vào để xem đầy đủ).
- Sửa lỗi hiển thị tiến độ học ở trang tổng quan.
- Chỉnh lại các nút cho cân đối hơn.
- Tự cuộn lên đầu trang khi mở bộ thẻ hoặc vào chế độ học.

---

## Phiên bản 0.2.0 — 08/09/2026
### Phát âm & tùy biến chế độ học

**Có gì mới**

- **Nghe phát âm:** Bấm biểu tượng loa để nghe từ ngay trong lúc học. Chọn được giọng nam/nữ và giọng Anh-Mỹ/Anh-Anh, lựa chọn được ghi nhớ cho lần sau.
- **Tùy biến thẻ học:** Tự chọn hiện gì trên thẻ (phiên âm, từ đồng nghĩa, câu ví dụ) và trộn thẻ để thứ tự không lặp lại.
- **Nhập từ dễ hơn:** Có nút tạo sẵn nội dung để nhờ AI soạn từ đúng định dạng, và file mẫu để biết cần điền những gì.

**Đã sửa**

- Chọn giọng nam giờ ra đúng giọng nam.
- Sửa lỗi xem trước và sao chép trong cửa sổ nhập từ.
- Nút sao chép hoạt động được trên cả những trình duyệt khó tính.

---

## Phiên bản 0.1.0 — 17/08/2026
### Bản đầu tiên

**Có gì mới**

- **Tài khoản:** Đăng ký, đăng nhập bằng email, dữ liệu học được giữ riêng cho bạn.
- **Bộ thẻ và từ vựng:** Tạo bộ thẻ theo chủ đề tùy ý, với hai loại thẻ là từ vựng và cụm từ. Đánh dấu được từng từ đã thuộc.
- **Chế độ học:** Thẻ lật hai mặt, lọc theo tình trạng, thanh tiến độ, và phím tắt để học liền tay (`Space` lật thẻ, `←` `→` chuyển thẻ).
- **Nhập từ hàng loạt:** Kéo thả file Excel hoặc CSV để nhập nhiều từ một lúc, xem trước trước khi nhập cho chắc.

---

## Sắp có

Những tính năng đang trong kế hoạch:

- **Tự điền phiên âm** thay vì phải gõ tay.
- **Ôn theo lịch thông minh** — nhắc bạn ôn lại đúng lúc sắp quên.
- **Câu hỏi tự gõ đáp án**, không chỉ chọn A/B/C/D.
- **Xuất bộ thẻ ra file** để sao lưu hoặc chia sẻ.