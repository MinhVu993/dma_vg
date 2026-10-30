# VG Dormitory Management System (`dma-nextjs`)

Hệ thống **Quản Lý Ký Túc Xá (Dormitory Management Application - DMA)** được chuyển đổi toàn diện từ Nuxt 2 + Laravel + MySQL sang kiến trúc **Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS) + PostgreSQL (`vg_dma` - Prisma ORM)** theo chuẩn thiết kế của `recruiting-report-nextjs`.

## 1. Kiến trúc & Cơ sở dữ liệu (`vg_dma` PostgreSQL)

- **PostgreSQL Connection**: `postgresql://postgres-business:123456789@10.1.16.89:5432/vg_dma?schema=public`
- **Các bảng chính**:
  - `dorm_request_tbl`: Lưu đơn đăng ký lưu trú ký túc xá, thông tin người tạo (`creator_empno`, `creator_name`, `creator_dept`, `creator_phone`), lý do (`reason`), lưu đồ 4 cấp (`approval_flow` JSONB), trạng thái (`status`: `PENDING` / `COMPLETED` / `DENIED`), cấp hiện tại (`current_lvl_code`) và lịch sử ký duyệt (`approval_logs` JSONB).
  - `dorm_personnel_tbl`: Lưu danh sách người lưu trú thuộc từng đơn (`request_id`), họ tên, giới tính (`Male`/`Female`), ngày sinh, quốc tịch, ngày đến/đi, loại giấy tờ, số giấy tờ, tỉnh/thành, phường/xã, địa chỉ chi tiết, số phòng (`room_no`) và mã QR (`qr_code`).
  - **Các bảng danh mục (Master tables)**: `location_tbl`, `nation_tbl_sub`, `document_type_tbl`, `res_reason_tbl`, `residence_type_tbl`, `province_tbl`, `ward_tbl`, `room_tbl`.

## 2. Tính năng nổi bật

1. **Bento Executive Dashboard (`/`)**:
   - Thẻ KPI trực quan: Tổng số đơn, Đơn đang chờ duyệt, Tổng lượt người lưu trú, Số người đang ở thực tế, Tình trạng xếp phòng.
   - Phân tích tỷ trọng theo Quốc tịch (`VNM`, `TWN`, `CHN`, `USA`...), Khu vực (`VG`, `TW`, `Other`...), Top bộ phận đăng ký và xu hướng theo tháng.
2. **Danh Sách Đơn & Phê Duyệt 4 Cấp (`/requests`)**:
   - Các tab trạng thái kèm badge đếm tự động: **All**, **To Do (Cần duyệt)**, **Processing**, **Completed**, **Declined**.
   - Bộ lọc cột kiểu Excel (`ExcelColumnFilter`) + sắp xếp A→Z / Z→A trên từng cột.
   - Lưu đồ phê duyệt 4 cấp (`AppFlowStepper`): **1. Chủ quản Bộ phận (`dept_manager`) → 2. Chủ quản GA (`ga_manager`) → 3. Khu quản lý SMP (`smp_manager`) → 4. Ban Giám Đốc GM (`vice_general_manager`)** tích hợp API `http://gmo021.cansportsvg.com:10003/api/ifm-tracking/resolve`.
   - Hỗ trợ chuyển nhanh tài khoản test duyệt ngay trên góc phải Header.
3. **Quản Lý Phòng & Mã QR (`/rooms`)**:
   - Xem sơ đồ phân bổ người ở theo từng phòng, danh sách chờ xếp phòng, gán phòng hàng loạt (`Bulk Set Room`) và tự động sinh thẻ QR (`qrcode`) cho từng người lưu trú.
4. **Trung Tâm Khai Báo Tạm Trú & Xuất Báo Cáo Công An (`/exports`)**:
   - Trích xuất 1-click 4 biểu mẫu nghiệp vụ:
     1. **Sổ Tiếp Nhận Lưu Trú** (`So_Tiep_Nhan_Luu_Tru.xlsx`)
     2. **Mẫu Nhập Liệu Công Dân Việt Nam** (`tblt_vn_import.xlsx`)
     3. **Mẫu Nhập Liệu Khách Nước Ngoài** (`Danh_Sach_Mau_Excel.xlsx`)
     4. **File XML Khai Báo Tạm Trú Xuất Nhập Cảnh** (`visa_info.xml` - `<KHAI_BAO_TAM_TRU>`)
5. ** Đa Ngôn Ngữ (VI / 中文 / EN) & Giao Diện Sáng/Tối (Light/Dark Mode)**.

## 3. Hướng dẫn chạy dự án

```bash
cd d:\source\dma_vg_ifm\dma-nextjs

# 1. Cài đặt thư viện
npm.cmd install

# 2. Đồng bộ dữ liệu từ MySQL dorm_db sang PostgreSQL vg_dma
npm.cmd run sync:mysql

# 3. Chạy môi trường Development (cổng 3040)
npm.cmd run dev

# 4. Build Production
npm.cmd run build
```

