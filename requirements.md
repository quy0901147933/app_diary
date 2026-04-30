# Yêu cầu Hệ thống & UI/UX - Dự án LuminaDiary (AI Nhật ký)

## 1. Tổng quan dự án (Project Overview)
- **Mục tiêu:** Xây dựng một ứng dụng nhật ký cá nhân tự động hóa bằng AI. Giảm thiểu ma sát (friction) cho người dùng bằng cách tự động phân tích ảnh, đưa ra phản hồi tức thời mang tính cảm xúc, và tự động tổng hợp thành blog cuối ngày.
- **Project Type:** Mobile App
- **Frontend Tech Stack:** React Native kết hợp Expo.
- **Backend Tech Stack:** Python (FastAPI/Flask) xử lý logic AI và supabase cho việc lưu trữ dữ liệu và hình ảnh
- **Phong cách UI (Design System):** - Hiện đại, tối giản, sang trọng (tham khảo UI của Diarly).
  - Sử dụng thẻ (Card-based UI) với góc bo tròn lớn (border-radius: 16px - 24px).
  - Màu sắc: Nền sáng/Sạch sẽ (Off-white/Pastel), Text tương phản tốt.
  - Animation: Mượt mà, ưu tiên sử dụng `react-native-reanimated`. Đặc trưng là hiệu ứng "Sao lấp lánh" (Sparkling) khi AI tương tác.

## 2. Kiến trúc Màn hình chính (Main Navigation)
Trang chủ sử dụng cấu trúc chia đôi (Segmented Control hoặc Top Tabs) để phân tách rõ ràng 2 trạng thái thời gian:

### 2.1. Tab 1: "Hành trình hôm nay" (The Living Stream)
- **Mục đích:** Hiển thị các bức ảnh vừa chụp/tải lên trong ngày hiện tại.
- **UI Component:** Danh sách cuộn dọc (Vertical Scroll). Mỗi mục là một bức ảnh lớn, bo góc.
- **Luồng AI Tương tác tức thời (Real-time AI Feedback):**
  - Ngay khi ảnh hiện lên, kích hoạt animation "Sao lấp lánh" ở góc bức ảnh.
  - Hiển thị một khung (Glassmorphism overlay) đè nhẹ lên góc dưới ảnh chứa **Lời bình luận của AI**.
  - **Logic AI (Objective Prompt):** Lời bình phải mang tính cảm xúc, an toàn, tuyệt đối không suy đoán hành động sai ngữ cảnh. (Ví dụ: "Một chút ánh sáng đẹp cho buổi sáng!").
  - Hiển thị **Hashtag địa điểm & thời gian** trích xuất từ EXIF/GPS Metadata (VD: `#Hue #08:30AM`).

### 2.2. Tab 2: "Ký ức đã đóng gói" (The Archive)
- **Mục đích:** Nơi lưu trữ các Blog Timeline của những ngày/tháng trước.
- **UI Component:** Các thẻ tổng hợp (Summary Cards) hiển thị theo dòng thời gian.
- **Chi tiết Thẻ (Card Details):**
  - Text tóm tắt ngắn gọn do AI tự động viết.
  - Lưới ảnh thumbnail nhỏ gọn (2-3 ảnh tiêu biểu).
  - Các badge Hashtag nổi bật (Ví dụ: `#Journey`, `#Family`) và Emoji tâm trạng.
  - Tuyệt đối không thiết kế giống bài đăng Mạng Xã Hội (Không có nút "Gửi tin nhắn", không có thanh thả tim kiểu Locket/Facebook để giữ tính riêng tư).

## 3. Các Luồng Chức năng Cốt lõi (Core Flows)

### 3.1. Luồng Tạo mới (Capture Flow)
- **Kích hoạt:** Thông qua một nút Floating Action Button (FAB) đa năng.
- **Trải nghiệm:** Mở ra giao diện Camera/Gallery tương tự tính năng tạo Story.
- **Sau khi chụp/chọn ảnh:**
  - Hiển thị ảnh Full-screen.
  - Cung cấp 2 nút chức năng tinh gọn: `[Thêm Ghi chú (Aa)]` và `[Gắn Tag/Emoji (#)]`.
  - Nút lưu đẩy ảnh thẳng vào Tab "Hành trình hôm nay".

### 3.2. Luồng Đóng gói Cuối ngày (The Magic Transition)
- Cung cấp một cơ chế (Nút bấm hoặc tự động lúc 00:00) mang tên "Gói ghém ngày hôm nay".
- Khi kích hoạt, tạo animation thu gom các thẻ lẻ tẻ ở Tab 1.
- AI sẽ gọi luồng Backend tổng hợp toàn bộ dữ liệu, viết thành 1 bài blog liền mạch.
- Kết quả được đẩy sang dạng Thẻ Tổng hợp ở Tab 2.

### 3.3. Luồng AI Chatbox (Deep Conversation)
- Một nút nổi (FAB) riêng biệt dùng để mở giao diện Chat 1-1 với AI.
- Giao diện chat phong cách iMessage/Messenger.
- AI sẽ sử dụng ngữ cảnh từ các bức ảnh trong ngày để làm câu chuyện tâm sự sâu hơn với người dùng.

## 4. Ràng buộc Kỹ thuật (Technical Constraints cho Agent)
- Code UI component phải chia nhỏ, tái sử dụng (VD: `TimelineCard`, `DailyPhotoItem`, `SparkleEffect`).
- Xử lý mượt mà trạng thái Loading khi gọi API (hiển thị Skeleton hoặc hiệu ứng shimmer).
- Đảm bảo Layout không bị vỡ trên các kích thước màn hình khác nhau.

