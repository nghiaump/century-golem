# Architecture Decision Records (ADR)

Mỗi quyết định kiến trúc quan trọng một file: **bối cảnh → quyết định → hệ quả → phương án đã loại**. Không sửa nội dung
ADR đã chấp nhận; nếu đổi ý, viết ADR mới và đánh dấu ADR cũ là *Superseded*.

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-luat-chinh-thuc.md) | Engine theo luật chính thức (hoà, đặt crystal, golem 6/5) | Accepted |
| [0002](0002-trang-thai-tim-kiem-gon.md) | Simulator gọn riêng cho search, kiểm bằng differential test | Accepted |
| [0003](0003-mcts-tat-dinh-hoa-ensemble.md) | MCTS open-loop determinized, ensemble theo worker | Accepted |
| [0004](0004-ham-loi-ich-theo-cap-va-lien-minh.md) | Hàm lợi ích theo cấp; Very Hard = liên minh AI | Accepted |
| [0005](0005-gioi-han-luong-ai-toan-server.md) | Giới hạn luồng AI toàn server + search ngoài lock | Accepted |
| [0006](0006-bo-cuc-patch-va-cong-cu.md) | Bố cục patch, không đổi go.mod/package.json, aibench trong internal/ | Accepted |
| [0007](0007-random-ghe-va-an-deck-api.md) | Random ghế người chơi; ẩn thứ tự deck trong API công khai | Accepted |
