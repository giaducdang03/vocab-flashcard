# Release Notes — VocabFlash

Những gì đã thay đổi qua từng phiên bản, mới nhất ở trên cùng.

---

## [1.0.0] — 2026-09-14 · Giao diện mới & Ôn nhanh

Bản 1.0 là lần thay áo lớn nhất của VocabFlash. Toàn bộ giao diện được vẽ lại cho gọn và dễ nhìn hơn, và có thêm **Ôn nhanh** — muốn ôn vài phút thì bấm một cái là chạy, không phải ngồi tạo hẳn một bài quiz.

### Ôn nhanh (Quick Practice)

Trước đây muốn kiểm tra xem mình nhớ được bao nhiêu thì phải tạo quiz: đặt tên, chọn số câu, chọn loại câu hỏi. Giờ mở bộ thẻ bất kỳ và bấm **Practice** là vào luyện ngay.

- **Chọn phần muốn ôn**: tất cả các từ, chỉ những từ **chưa thuộc**, hoặc chỉ những từ **đã thuộc**. Sắp thi thì ôn phần chưa thuộc, muốn giữ trí nhớ thì quét lại phần đã thuộc.
- Vẫn đủ ba kiểu câu hỏi quen thuộc: Anh → Việt, Việt → Anh, và chọn từ đồng nghĩa.
- **Biết đúng sai ngay** sau mỗi câu, không phải chờ tới cuối.
- Cuối buổi có **bảng tổng kết** tách theo từng kiểu câu hỏi, để thấy mình yếu ở dạng nào.
- **Không ghi vào lịch sử.** Ôn nhanh là để luyện, nên kết quả không được lưu và không ảnh hưởng gì tới điểm số hay thống kê của bạn. Cứ sai thoải mái.
- Bộ thẻ cần có ít nhất 4 từ mới ôn được.

### Giao diện mới toàn bộ

Tám màn hình chính đều được vẽ lại theo cùng một phong cách, nên đi giữa các trang không còn cảm giác chắp vá:

- **Chữ dễ đọc hơn** — đổi sang bộ font mới, riêng số liệu và phiên âm dùng font đều nét cho dễ dò.
- **Màu dịu mắt hơn**, đặc biệt khi nhìn lâu.
- **Thanh điều hướng luôn nằm trên cùng**, kèm chip hiển thị chuỗi ngày học liên tiếp.

### Kho bộ thẻ riêng

Danh sách bộ thẻ giờ có trang riêng thay vì nằm chung với dashboard, nên tìm bộ thẻ cũ nhanh hơn. Mỗi bộ hiển thị ngày tạo và tiến độ học.

### Quản lý thẻ dễ hơn hẳn

Trang chi tiết bộ thẻ được làm lại, chủ yếu để đỡ cực khi bộ thẻ đã nhiều từ:

- **Tìm kiếm** thẻ theo từ khóa.
- **Lọc nhanh** theo: tất cả, từ vựng, cụm từ, chưa thuộc, đã thuộc — mỗi nhóm hiện sẵn số lượng.
- **Sắp xếp** theo thứ tự gốc, theo bảng chữ cái, hoặc theo thẻ mới thêm gần đây.
- **Chọn nhiều thẻ cùng lúc** để đánh dấu đã thuộc / chưa thuộc hoặc xóa hàng loạt, thay vì bấm từng cái.
- **Danh sách dài tự tải thêm khi cuộn**, không còn phải chờ tải hết mới xem được.
- Thêm thẻ mới qua cửa sổ riêng, gọn hơn form cũ chen giữa trang.

### Xem lại kết quả quiz rõ hơn

- **Bốn ô số liệu** ngay đầu trang: tổng số câu, số lần làm, điểm cao nhất, điểm trung bình.
- **Lịch sử làm bài** trình bày lại cho dễ đọc, thay cho bảng cũ.
- **Thẻ Tiến bộ** — đối chiếu lần làm đầu tiên với lần gần nhất: điểm tăng hay giảm bao nhiêu, và làm nhanh hơn được bao nhiêu giây. Hiện ra khi bạn đã làm từ hai lần trở lên.

### Sửa lỗi

- Vào thẳng đường dẫn trang ôn nhanh không còn bị trắng trang.
- Không thể bấm trả lời hai lần cho cùng một câu nữa.
- Đổi bộ lọc trong danh sách thẻ giờ luôn hiển thị đúng kết quả mới.
- Nút quay lại ở trang chi tiết bộ thẻ giờ về đúng kho bộ thẻ thay vì nhảy về dashboard.
- Sửa thanh tiến độ bị lệch màu và vỡ layout trên màn hình nhỏ.
- Sửa thanh điều hướng bị lệch ở trang xem lại bài làm.
- Thẻ đã thuộc đổi từ tô nền sang viền nhạt, chữ không còn bị chìm.
- Biểu đồ tiến độ từng bộ thẻ không còn bị cắt mất tên.

---

## [0.4.0] — 2026-09-10 · Quiz trắc nghiệm

Bản lớn nhất từ trước tới nay: VocabFlash không chỉ để lật thẻ nữa. Giờ bạn có thể **tự kiểm tra** — app tự ra đề trắc nghiệm từ chính bộ thẻ của bạn, chấm điểm và lưu lại lịch sử để theo dõi mình tiến bộ tới đâu.

### Tạo bài quiz từ bộ thẻ của bạn

- **Ba kiểu câu hỏi**, mỗi câu 4 đáp án: Anh → Việt, Việt → Anh, và chọn từ đồng nghĩa.
- **Gộp nhiều bộ thẻ vào một bài quiz** — ôn tổng hợp cả tháng trong một lần làm.
- **Các bước tạo rõ ràng**: chọn bộ thẻ → chọn kiểu câu hỏi → chọn số câu → đặt tên.
- **Biết trước ra được tối đa bao nhiêu câu.** App tính sẵn theo số thẻ bạn có, nên không xảy ra cảnh chọn 50 câu rồi mới báo không đủ thẻ.
- **Đáp án sai được chọn cẩn thận** — không trùng đáp án đúng, không lẫn từ đồng nghĩa của chính từ đang hỏi, nên không có câu nào hai đáp án cùng đúng.
- Cần ít nhất 4 thẻ để tạo được quiz.

### Làm bài và xem lại

- **Biết đúng sai ngay sau mỗi câu**, kèm đáp án đúng, không phải chờ tới cuối bài.
- **Trang xem lại** phân tích từng câu: đề bài, bạn đã chọn gì, đáp án đúng là gì.
- **Lịch sử đầy đủ mọi lần làm**: điểm số, thời gian làm bài, ngày nộp — để so xem lần này có khá hơn lần trước không.
- **Màu riêng cho từng kiểu câu hỏi**, nhìn là biết ngay câu đó thuộc dạng nào.

### Đáng chú ý

- **Sửa hay xóa thẻ không làm hỏng quiz cũ.** Câu hỏi được chụp lại nguyên văn lúc tạo quiz, nên bài làm cũ và điểm số của bạn vẫn còn nguyên kể cả khi bạn dọn dẹp lại bộ thẻ sau đó.
- **Không lộ đáp án.** Đáp án đúng chỉ được gửi về sau khi bạn đã chọn, nên không có cách nào xem trộm trước.
- **Không sửa được câu đã trả lời.** Mỗi câu chỉ chấm một lần, và nộp bài rồi thì không sửa thêm được nữa — để điểm số phản ánh đúng thực lực.

### Sửa lỗi

- Nút **Review** trong lịch sử làm bài giờ bấm vào là mở đúng bài cần xem.
- Nhãn **NEW** trên dashboard không còn đè lên chữ.
- Tinh chỉnh cỡ chữ tiêu đề quiz ở các trang cho dễ đọc hơn.
- Tên bộ thẻ trong trang quiz giờ bấm được để mở thẳng bộ thẻ đó.

---

## [0.3.0] — 2026-09-09 · Dashboard thống kê & theo dõi tiến độ

Trả lời câu hỏi "mình học được bao nhiêu rồi?" bằng số liệu thật, thay vì đoán theo cảm giác.

### Bảng thống kê mới

- **Bốn ô số liệu chính**: tổng số từ, số từ đã thuộc, mức độ thành thạo (%), và chuỗi ngày học liên tiếp.
- **Biểu đồ số từ học mỗi ngày**, xem theo **7 ngày** hoặc **30 ngày**.
- **Biểu đồ tiến độ từng bộ thẻ** — thấy ngay bộ nào đang bỏ dở.
- Dashboard tách làm hai khu rõ ràng: phần thống kê và phần bộ thẻ của bạn.
- Lời chào theo tên và menu tài khoản ở góc trên.

### Đáng chú ý

- **Chuỗi ngày học tính theo giờ của bạn**, không theo giờ quốc tế — nên "hôm nay" đúng là hôm nay, không bị lệch ngày.
- **Chuỗi ngày không gãy oan giữa ngày.** Hôm nay chưa kịp học thì chuỗi vẫn giữ nguyên chứ không tụt về 0 ngay từ sáng — bạn vẫn còn cả ngày để học.
- **Học đi học lại một từ trong ngày không làm phồng số liệu.** Mỗi từ chỉ được đếm một lần mỗi ngày, nên biểu đồ phản ánh đúng khối lượng thật.

### Sửa lỗi

- Tên bộ thẻ quá dài không còn làm vỡ biểu đồ tiến độ — giờ được rút gọn, đưa chuột vào để xem đầy đủ.
- Sửa lỗi hiển thị tiến độ học trên dashboard.
- Sửa căn chỉnh các nút biểu tượng và nút đóng cửa sổ.
- Chuyển tạo bộ thẻ từ form giữa trang sang cửa sổ riêng.
- Tự cuộn lên đầu trang khi mở bộ thẻ hoặc vào chế độ học.

---

## [0.2.0] — 2026-09-08 · Phát âm & tùy biến chế độ học

### Nghe phát âm

- **Bấm biểu tượng loa để nghe từ** ngay trong chế độ học.
- Chọn **giọng nam hoặc nữ**, và **giọng Anh-Mỹ hoặc Anh-Anh**. Lựa chọn được nhớ cho những lần sau.
- Nếu máy bạn không có sẵn đúng giọng đó, app sẽ dùng giọng gần nhất và **báo cho bạn biết** thay vì lặng lẽ đọc bằng giọng khác.

### Tùy biến thẻ học

- **Chọn hiện gì trên thẻ** — bật/tắt riêng phiên âm, từ đồng nghĩa và câu ví dụ, tùy bạn muốn thử thách tới mức nào.
- **Trộn thẻ** để thứ tự không lặp lại, bấm lại để trộn tiếp.

### Nhập từ dễ hơn

- **Nút Copy Prompt** — tạo sẵn một đoạn yêu cầu để bạn nhờ AI soạn nội dung đúng định dạng, khỏi phải gõ tay từng từ. Đoạn yêu cầu tự đổi theo việc bạn muốn tạo từ vựng, cụm từ hay cả hai.
- **Tải file mẫu** có sẵn ví dụ cho cả hai loại thẻ, để biết cần điền những cột gì.

### Sửa lỗi

- Chọn giọng nam giờ ra đúng giọng nam — trước đó vẫn có thể ra giọng nữ mà không báo gì.
- Sửa lỗi xem trước và sao chép trong cửa sổ nhập từ.
- Sửa cửa sổ nhập từ bị vỡ layout trên máy đặt cỡ hiển thị lớn.
- Sửa hiển thị tiến độ học trên dashboard.
- Nút sao chép giờ vẫn hoạt động trên các trình duyệt không cho phép truy cập clipboard trực tiếp.

---

## [0.1.0] — 2026-08-17 · Bản đầu tiên

MVP hoàn chỉnh theo [vocab-flashcard-spec.md](vocab-flashcard-spec.md).

### Tài khoản

- Đăng ký và đăng nhập bằng email, dữ liệu học của bạn được giữ riêng.

### Bộ thẻ và từ vựng

- **Tạo bộ thẻ** theo chủ đề, bài học hay bất cứ cách nào bạn muốn sắp xếp.
- **Hai loại thẻ**: từ vựng (kèm phiên âm và từ đồng nghĩa) và cụm từ.
- **Đánh dấu đã thuộc** cho từng từ, đánh dấu tới đâu hiện ngay tới đó.

### Chế độ học

- **Thẻ lật hai mặt** — mặt trước là từ và phiên âm, mặt sau là nghĩa, từ đồng nghĩa và câu ví dụ.
- **Lọc theo tình trạng**: tất cả, chưa thuộc, hoặc đã thuộc.
- **Thanh tiến độ** hiện số từ đã thuộc trên tổng số.
- **Phím tắt**: `Space` để lật thẻ, `←` `→` để chuyển thẻ — học liền tay không cần chuột.

### Nhập từ hàng loạt

- **Nhập từ file Excel hoặc CSV**, kéo thả file vào là được.
- **Xem trước 5 dòng đầu** trước khi nhập, tránh nhập nhầm cả file.
- Tự nhận biết loại thẻ khi file không ghi rõ, và đọc được file Excel xuất ra mà không lỗi font.

---

## Đang ấp ủ

Những thứ chưa có nhưng nằm trong kế hoạch:

- **Tự điền phiên âm** — thay vì phải gõ tay từng từ như hiện tại.
- **Ôn theo lịch thông minh** — app nhắc bạn ôn lại đúng lúc sắp quên, dựa trên lịch sử học đã ghi sẵn.
- **Câu hỏi tự gõ đáp án**, không chỉ chọn A/B/C/D.
- **Xuất bộ thẻ ra file** để sao lưu hoặc chia sẻ.
