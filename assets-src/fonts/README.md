# Font đóng gói (OFL 1.1) — tự phục vụ, không gọi dịch vụ ngoài

Nguồn: npm `@fontsource/cinzel@5.3.0`, `@fontsource/be-vietnam-pro@5.3.0` (`npm pack` 2026-11-16, chỉ lấy woff2 cần dùng).
Bản quyền: OFL-Cinzel.txt, OFL-BeVietnamPro.txt. `deploy/sanitize-src.sh` chép các file này vào
`src/golem/web/react-frontend/src/assets/fonts/` (file nhị phân không đi qua patch). CSS: `src/styles/fonts.css`.

- **Cinzel** 600/700 (latin, latin-ext): chỉ chữ tiếng Anh tĩnh (tiêu đề, header, nút) — KHÔNG có dấu tiếng Việt.
- **Be Vietnam Pro** 400/600/700 (latin, latin-ext, vietnamese): mọi chữ còn lại, kể cả tên người chơi.

```
03d1b589cff172e1a670b3573e731d3380bc326f80cf83b0d3504e3188e2e074  be-vietnam-pro-latin-400-normal.woff2
9503dec2a7c532c8331e9600bcafea287a4fd208573b8668d85ab8d8de1863c7  be-vietnam-pro-latin-600-normal.woff2
a193dd87699bd2e18ddf72dc271493ea82a23dad9f5c334d9f2a257b1e05fc30  be-vietnam-pro-latin-700-normal.woff2
f7a2811e471c2973a1179ce39da3ad6bb8082381aa8d1535ccfcbc3d6d78a052  be-vietnam-pro-latin-ext-400-normal.woff2
20cc75daeaaaa0fa8af2b616b2de2b2900f0ce14ae8e9faa47d272cedd93827f  be-vietnam-pro-latin-ext-600-normal.woff2
33d57e5bd840b03921568e08d2be1082d453e55f1ba55f421e41a1aa54e12601  be-vietnam-pro-latin-ext-700-normal.woff2
dc085e2fba3414e5c5bf1e6172f921a9f81c5859946a4ed3d63c1e470d96a9e2  be-vietnam-pro-vietnamese-400-normal.woff2
97658c6f9a384f29a3005c3d96e2a0d1c810192cf68979071c290f5a377a9f99  be-vietnam-pro-vietnamese-600-normal.woff2
4f58af2d1c3e28a9ba14c51c82db2751d78344b75bdcb34de24a1031ebe59da6  be-vietnam-pro-vietnamese-700-normal.woff2
61efc27ceb7d08bb841652fa8979c0b6833b92548b7f9544c07968a6c02f28e4  cinzel-latin-600-normal.woff2
8efa224fe70fef188a39c095e218b81fd31061809f2752537e33a9ec7b9c2263  cinzel-latin-700-normal.woff2
a5779eb98b5046090f99169b529743e356b452909295ad7db4cb70011e0425e0  cinzel-latin-ext-600-normal.woff2
55b110958b9b614a410cf607c12b1ff2990fa3e5bd0bfacf17e5fd7dce681562  cinzel-latin-ext-700-normal.woff2
0bd4db1cda123af9d91794b0f98324b7d7d81aef0fcaf78c433160153f2c6f25  OFL-BeVietnamPro.txt
f5a242cf68ad6ebd0603b3359a74c593ca080318a681035be5296ba2c6b04ae6  OFL-Cinzel.txt
```
