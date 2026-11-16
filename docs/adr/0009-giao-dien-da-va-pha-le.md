# ADR 0009 — Giao diện thống nhất "Đá & Pha lê" (thay theme XP và style upstream)

- Trạng thái: **Accepted** (2026-11-16)
- Liên quan: [`../ui/thiet-ke-giao-dien.md`](../ui/thiet-ke-giao-dien.md), plan [`../plans/2026-11-16-golem-ui.md`](../plans/2026-11-16-golem-ui.md)

## Bối cảnh
UI trộn 5 phong cách: màn khởi tạo/phòng chờ kiểu Windows XP (tuỳ biến trước đây), bàn chơi upstream (kính mờ tím), popup trắng
viền màu, popup gradient tối, skin ✨ dùng ảnh chụp. Crystal vẽ 4 cách, 14 cỡ chữ (43 chỗ 9–10px), z-index tới 99999, mobile thiếu
"lượt của bạn", tooltip chỉ có hover và bị cắt, avatar là sprite Super Mario (có bản quyền). Người dùng muốn một UI/UX thuần
"Golem Edition" cho cả desktop lẫn mobile, bỏ XP, avatar golem.

## Quyết định
1. **Một hệ thống thiết kế nguyên bản "Đá & Pha lê"**: nền núi đêm, panel đá chạm viền đồng, popup giấy da, nút đồng; token CSS
   (`styles/tokens.css`) + primitive (`components/ui`) là nguồn duy nhất; ảnh lá bài giữ nguyên, không chép logo/trade dress.
2. **Crystal mỗi màu một hình** (▲◆⬟⬢, số cạnh − 2 = cấp) — không phụ thuộc màu.
3. **Font OFL tự phục vụ**: Cinzel (chỉ chữ tiếng Anh tĩnh) + Be Vietnam Pro (mọi chữ khác, đủ dấu tiếng Việt).
4. **24 avatar golem tự vẽ bằng code** (SVG, tất định), phục vụ trực tiếp dạng SVG; AI mang tên golem.
5. Logic bảng chơi gom vào `useBoardActions` dùng chung mọi bố cục; điện thoại chạm lá ⇒ sheet (xem + hành động), desktop click
   hành động + hover xem; mất kết nối giữa ván giữ bàn chơi + banner.
6. Skin ✨ giữ làm bố cục phụ **chỉ desktop**, restyle; điện thoại cầm ngang (cao < 500px) dùng bố cục điện thoại.
7. Hạ tầng patch: file nhị phân (font, avatar) đi qua `assets-src/` + `sanitize-src.sh`; patch 0002 thêm `index.html` +
   `tailwind.config.js`.

## Hệ quả
- Mọi màn đồng bộ; kiểm tự động bằng `deploy/ui-shots.mjs` (request ngoài, lỗi console, tràn, chữ < 12px, nút < 44px).
- Bundle thêm ~120 KB font (chỉ tải subset cần); bỏ ảnh nền 500 KB (nền vẽ SVG).
- Popup đặt crystal/discard chọn sẵn crystal rẻ nhất; popup trade/đặt crystal cảnh báo trước khi vượt 10.
- Đổi tên/số avatar phải sửa cả frontend và server (test Go so khớp).

## Phương án đã loại
- Giữ XP cho màn khởi tạo + restyle bàn chơi riêng: vẫn hai phong cách.
- "Nắng đồng cỏ" (sáng) / "Hang pha lê" (kính phát sáng): người dùng chọn Đá & Pha lê.
- Avatar cắt từ lá golem trong game (dễ nhầm với lá trên market, tranh của nhà phát hành) hoặc gói pixel 34 golem (vẽ bằng AI, không
  có giấy phép chính thức).
- Font qua Google Fonts/CDN: vi phạm nguyên tắc không gọi dịch vụ ngoài.
