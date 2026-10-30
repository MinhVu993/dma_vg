/**
 * scripts/sync-from-mysql.js
 *
 * Script tự động đồng bộ toàn bộ dữ liệu từ MySQL `dorm_db` sang PostgreSQL `vg_dma`:
 * - Danh mục (Master tables): document_type_tbl, location_tbl, nation_tbl_sub, province_tbl, ward_tbl, res_reason_tbl, residence_type_tbl
 * - Đơn đăng ký ký túc xá: dorm-data_tbl -> dorm_request_tbl & dorm_personnel_tbl
 *
 * Cách dùng:
 *   npm run sync:mysql             (Đồng bộ Upsert an toàn)
 *   npm run sync:mysql -- --full   (Làm sạch dorm_request_tbl / dorm_personnel_tbl và nạp lại 100%)
 */

const { PrismaClient } = require("@prisma/client");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let mysql;
try {
  mysql = require("mysql2/promise");
} catch (err) {
  console.error("❌ Thư viện 'mysql2' chưa được cài đặt. Vui lòng chạy: npm install mysql2");
  process.exit(1);
}

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "10.1.16.89",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "read_only_acc",
  password: process.env.MYSQL_PASSWORD || "abcd@1234",
  database: process.env.MYSQL_DATABASE || "dorm_db",
  dateStrings: true,
  connectionLimit: 5,
};

function parseValidDate(val) {
  if (!val || typeof val !== "string") return null;
  const str = val.trim();
  if (
    !str ||
    str.startsWith("0000") ||
    str.toLowerCase() === "null" ||
    str.toLowerCase() === "no"
  ) {
    return null;
  }
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mStr = String(month).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      return new Date(`${year}-${mStr}-${dStr}T00:00:00.000Z`);
    }
  }
  return null;
}

function parseValidTimestamp(val) {
  if (!val || typeof val !== "string") return new Date();
  const str = val.trim();
  if (!str || str.startsWith("0000")) return new Date();
  const parsed = new Date(str.replace(" ", "T") + "Z");
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function safeJsonParse(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Chuyển đổi mảng status & approval 4 cấp từ MySQL sang cấu trúc chuẩn của dorm_request_tbl
 */
function transformStatusAndApproval(rawStatus, rawApproval) {
  const statusArr = safeJsonParse(rawStatus, []);
  const approvalArr = safeJsonParse(rawApproval, []);

  const lvlCodes = ["dept_manager", "ga_manager", "smp_manager", "vice_general_manager"];

  let pgStatus = "PENDING";
  let currentLvlCode = "dept_manager";

  if (Array.isArray(statusArr) && statusArr.length > 0) {
    // Hỗ trợ cả định dạng mảng boolean [true, true, true, true] và mảng object [{dept: "true", stt: "accept"}, ...]
    const isBooleanFormat = statusArr.some((s) => typeof s === "boolean" || s === null);

    if (isBooleanFormat) {
      const hasFalse = statusArr.some((s) => s === false);
      const allTrue = statusArr.length >= 4 && statusArr.slice(0, 4).every((s) => s === true);
      if (hasFalse) {
        pgStatus = "DENIED";
        const denyIdx = statusArr.findIndex((s) => s === false);
        currentLvlCode = denyIdx >= 0 ? lvlCodes[denyIdx] : "dept_manager";
      } else if (allTrue) {
        pgStatus = "COMPLETED";
        currentLvlCode = null;
      } else {
        pgStatus = "PENDING";
        const nullIdx = statusArr.findIndex((s) => s === null || s === undefined);
        currentLvlCode = nullIdx >= 0 && nullIdx < 4 ? lvlCodes[nullIdx] : "dept_manager";
      }
    } else {
      const isDenied = statusArr.some(
        (s) => s && (String(s.stt).toLowerCase() === "deny" || String(s.stt).toLowerCase() === "cancel")
      );
      const isCompleted =
        statusArr[3]?.gm === "true" && String(statusArr[3]?.stt).toLowerCase() === "accept";

      if (isDenied) {
        pgStatus = "DENIED";
        const denyIdx = statusArr.findIndex((s) => s && String(s.stt).toLowerCase() === "deny");
        currentLvlCode = denyIdx >= 0 ? lvlCodes[denyIdx] : null;
      } else if (isCompleted) {
        pgStatus = "COMPLETED";
        currentLvlCode = null;
      } else if (statusArr[2]?.smp === "true" && String(statusArr[2]?.stt).toLowerCase() === "accept") {
        pgStatus = "PENDING";
        currentLvlCode = "vice_general_manager";
      } else if (statusArr[1]?.ga === "true" && String(statusArr[1]?.stt).toLowerCase() === "accept") {
        pgStatus = "PENDING";
        currentLvlCode = "smp_manager";
      } else if (statusArr[0]?.dept === "true" && String(statusArr[0]?.stt).toLowerCase() === "accept") {
        pgStatus = "PENDING";
        currentLvlCode = "ga_manager";
      } else {
        pgStatus = "PENDING";
        currentLvlCode = "dept_manager";
      }
    }
  }

  // Giữ đầy đủ lịch sử duyệt 4 cấp + chuẩn hóa cho cả UI mới và tương thích ngược
  const approvalLogs = [];
  if (Array.isArray(approvalArr)) {
    approvalArr.forEach((item, idx) => {
      if (!item) return;
      const stt = String(item.stt || "").toLowerCase();
      const codeOrEmp = item.empno || item.code || item.empid || "";
      const nameVal = item.name || item.username || "";
      if (codeOrEmp || nameVal || item.date || stt || item.reason) {
        const isDeniedStep =
          stt === "deny" ||
          statusArr[idx] === false ||
          (pgStatus === "DENIED" && Boolean(item.reason));
        approvalLogs.push({
          levelIndex: idx,
          lvl_code: lvlCodes[idx] || `level_${idx + 1}`,
          lvlCode: lvlCodes[idx] || `level_${idx + 1}`,
          code: codeOrEmp,
          empid: codeOrEmp,
          empno: codeOrEmp,
          approverEmpno: codeOrEmp,
          name: nameVal,
          username: nameVal,
          approverName: nameVal,
          dept: item.dept || "",
          email: item.email || "",
          ext: item.ext || "",
          date: item.date || "",
          actedAt: item.date || "",
          stt: stt || (isDeniedStep ? "deny" : "accept"),
          action: isDeniedStep ? "DENIED" : "APPROVED",
          reason: item.reason || "",
          note: item.reason || (isDeniedStep ? "Từ chối" : "Đã phê duyệt"),
        });
      }
    });
  }

  return { pgStatus, currentLvlCode, approvalLogs, rawStatusArr: statusArr, rawApprovalArr: approvalArr };
}

async function main() {
  const args = process.argv.slice(2);
  const isFullSync = args.includes("--full") || args.includes("-f");

  console.log("============================================================");
  console.log("🔄 ĐỒNG BỘ DỮ LIỆU TỪ MYSQL (dorm_db) SANG POSTGRESQL (vg_dma)");
  console.log(`  • MySQL Source: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
  console.log(`  • Chế độ:       ${isFullSync ? "FULL (Làm sạch & Nạp mới)" : "UPSERT (Thêm mới & Cập nhật)"}`);
  console.log("============================================================");

  let mysqlConn = null;
  const startTime = Date.now();

  try {
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    await prisma.$connect();
    console.log("✓ Đã kết nối MySQL và PostgreSQL thành công!");

    // 1. Nạp bảng danh mục từ PostgreSQL để tra cứu nhanh
    const docTypes = await prisma.documentType.findMany();
    const docTypeMap = new Map(docTypes.map((d) => [String(d.id), d.name]));

    const resReasons = await prisma.resReason.findMany();
    const resReasonMap = new Map(resReasons.map((r) => [String(r.id), r.resReason.trim()]));

    const resTypes = await prisma.residenceType.findMany();
    const resTypeMap = new Map(resTypes.map((t) => [String(t.id), t.name]));

    const provinces = await prisma.province.findMany();
    const provMap = new Map(provinces.map((p) => [String(p.code), p.name || p.code]));

    const wards = await prisma.ward.findMany();
    const wardMap = new Map(wards.map((w) => [String(w.code), w.name || w.code]));

    // 2. Lấy toàn bộ bản ghi từ dorm-data_tbl trên MySQL
    const [mysqlRows] = await mysqlConn.query("SELECT * FROM `dorm-data_tbl` ORDER BY id ASC");
    console.log(`📦 Tìm thấy ${mysqlRows.length} đơn đăng ký trong MySQL [dorm-data_tbl].`);

    // Cho phép insert explicit ID (GENERATED BY DEFAULT AS IDENTITY) để đồng bộ từ MySQL và Prisma
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TABLE "dorm_request_tbl" ALTER COLUMN "id" SET GENERATED BY DEFAULT;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TABLE "dorm_personnel_tbl" ALTER COLUMN "id" SET GENERATED BY DEFAULT;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    if (isFullSync) {
      console.log("🧹 Đang làm sạch bảng dorm_personnel_tbl và dorm_request_tbl...");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "dorm_personnel_tbl", "dorm_request_tbl" RESTART IDENTITY CASCADE;`);
    }

    let requestCount = 0;
    let personnelCount = 0;

    for (const row of mysqlRows) {
      const reqId = BigInt(row.id);
      const keyInDate = parseValidDate(row.key_in_date || row.key_in) || parseValidTimestamp(row.created_at);
      const createdAt = parseValidTimestamp(row.created_at);
      const updatedAt = row.updated_at ? parseValidTimestamp(row.updated_at) : createdAt;

      const submitter = safeJsonParse(row.submitter, {});
      const creatorEmpno = String(submitter.empno || "UNKNOWN").trim();
      const creatorName = String(submitter.name || "Unknown").trim();
      const creatorDept = String(submitter.dept || submitter.hight_dept || "").trim();
      const creatorPhone = String(submitter.ext || submitter.phone || "").trim();

      const { pgStatus, currentLvlCode, approvalLogs } = transformStatusAndApproval(row.status, row.approval);

      const parsedAppFlow = safeJsonParse(row.app_flow, null);
      const defaultFlowMeta = Array.isArray(parsedAppFlow) && parsedAppFlow.length > 0
        ? parsedAppFlow
        : [
            {
              lvl_code: "dept_manager",
              lvl_name: { en: "Dept.", vi: "Chủ quản bộ phận", cn: "部級", zh: "部級" },
              lvl_type: "normal",
              managers: [],
              submitter_meta: {
                empno: creatorEmpno,
                name: creatorName,
                dept: creatorDept,
                hight_dept: submitter.hight_dept || "",
                email: submitter.email || "",
                ext: creatorPhone,
                submit_date: submitter.submit_date || row.key_in_date || row.key_in,
              },
            },
            {
              lvl_code: "ga_manager",
              lvl_name: { en: "GA Dept.", vi: "Chủ Quản GA", cn: "總務部", zh: "總務部" },
              lvl_type: "defined",
              managers: [],
            },
            {
              lvl_code: "smp_manager",
              lvl_name: { en: "AD Div.", vi: "Khu quản lý", cn: "管理處", zh: "管理處" },
              lvl_type: "defined",
              managers: [],
            },
            {
              lvl_code: "vice_general_manager",
              lvl_name: { en: "GMO", vi: "VP.TGĐ", cn: "總經理室", zh: "總經理室" },
              lvl_type: "defined",
              managers: [],
            },
          ];

      await prisma.dormRequest.upsert({
        where: { id: reqId },
        create: {
          id: reqId,
          keyInDate,
          creatorEmpno,
          creatorName,
          creatorDept,
          creatorPhone,
          reason: row.reason || "",
          approvalFlow: defaultFlowMeta,
          status: pgStatus,
          createdAt,
          updatedAt,
          currentLvlCode,
          approvalLogs,
        },
        update: {
          keyInDate,
          creatorEmpno,
          creatorName,
          creatorDept,
          creatorPhone,
          reason: row.reason || "",
          approvalFlow: defaultFlowMeta,
          status: pgStatus,
          updatedAt,
          currentLvlCode,
          approvalLogs,
        },
      });
      requestCount++;

      // Xử lý danh sách người lưu trú (name JSON array)
      const occupants = safeJsonParse(row.name, []);
      const qrList = safeJsonParse(row.qr_code, []);

      // Xóa personnel cũ của request này rồi insert lại để tránh trùng lặp khi chạy upsert nhiều lần
      await prisma.dormPersonnel.deleteMany({ where: { requestId: reqId } });

      if (Array.isArray(occupants) && occupants.length > 0) {
        const personnelData = occupants.map((person) => {
          const fullName = String(person.name || person.fullName || "Unknown").trim();
          let accomStatus = "";
          if (person.status) {
            accomStatus = String(person.status);
          } else if (person.location) {
            if (typeof person.location === "object" && person.location.loc) {
              accomStatus = String(person.location.loc);
            } else {
              accomStatus = String(person.location);
            }
          }

          const rawGender = String(person.gender || person.sex || "M").toUpperCase().trim();
          const gender =
            rawGender === "F" || rawGender === "FEMALE" || rawGender === "NỮ"
              ? "Female"
              : "Male";

          const birthDay = parseValidDate(person.birthDay || person.dateBirth || person.birth_date);
          const nationality = String(person.nation || person.nationality || "VNM").trim();
          const startDate = parseValidDate(person.startDate || person.start_date);
          const endDate = parseValidDate(person.endDate || person.end_date);

          // Giấy tờ
          const rawDocType = person.typeDoc || person.doc_type || person.docType;
          const documentType = rawDocType
            ? docTypeMap.get(String(rawDocType)) || String(rawDocType)
            : person.passport_number
            ? "Hộ chiếu"
            : person.citizen_id
            ? "Thẻ CCCD"
            : null;

          const documentNumber =
            person.numDoc || person.doc_number || person.citizen_id || person.passport_number || person.document_number || null;

          // Cư trú & địa chỉ
          const rawResReason = person.res_reason || person.resReason;
          const residenceReason = rawResReason
            ? resReasonMap.get(String(rawResReason)) || String(rawResReason)
            : null;

          const rawResType = person.typeRes || person.res_type || person.resType;
          const residenceType = rawResType
            ? resTypeMap.get(String(rawResType)) || String(rawResType)
            : null;

          const rawProv = person.prov_city || person.province_id || person.province;
          const provinceCity = rawProv ? provMap.get(String(rawProv)) || String(rawProv) : null;

          const rawWard = person.ward_com || person.ward_id || person.ward;
          const wardCommune = rawWard ? wardMap.get(String(rawWard)) || String(rawWard) : null;

          const detailedAddress = person.detailAddr || person.detailed_address || person.detailedAddress || null;
          const roomNo = person.room || person.room_no || row.room_no || null;

          // Tìm QR code tương ứng nếu có
          let qrCode = person.qrCode || person.qr_code || person.qr_path || null;
          if (!qrCode && Array.isArray(qrList)) {
            const matchedQr = qrList.find((q) => q && q.name === fullName) || qrList[0];
            if (matchedQr && matchedQr.qr) {
              qrCode = matchedQr.qr;
            }
          }

          return {
            requestId: reqId,
            fullName,
            accomStatus: accomStatus || "VG",
            gender,
            birthDay,
            nationality,
            startDate,
            endDate,
            documentType: documentType ? String(documentType) : null,
            documentNumber: documentNumber ? String(documentNumber) : null,
            notes: person.note || person.notes || null,
            roomNo: roomNo ? String(roomNo) : null,
            qrCode: qrCode ? String(qrCode) : null,
            createdAt,
            residenceReason: residenceReason ? String(residenceReason) : null,
            residenceType: residenceType ? String(residenceType) : null,
            provinceCity: provinceCity ? String(provinceCity) : null,
            wardCommune: wardCommune ? String(wardCommune) : null,
            detailedAddress: detailedAddress ? String(detailedAddress) : null,
          };
        });

        await prisma.dormPersonnel.createMany({ data: personnelData });
        personnelCount += personnelData.length;
      }

      if (requestCount % 25 === 0 || requestCount === mysqlRows.length) {
        process.stdout.write(
          `  ⏳ Đã đồng bộ: ${requestCount}/${mysqlRows.length} đơn (${personnelCount} lượt người ở)   \r`
        );
      }
    }

    // 3. Cập nhật lại sequence PostgreSQL cho dorm_request_tbl và dorm_personnel_tbl
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"dorm_request_tbl"', 'id'), COALESCE((SELECT MAX(id) FROM "dorm_request_tbl"), 1));`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"dorm_personnel_tbl"', 'id'), COALESCE((SELECT MAX(id) FROM "dorm_personnel_tbl"), 1));`
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n============================================================`);
    console.log(`🎉 ĐỒNG BỘ HOÀN TẤT RỰC RỠ TRONG ${duration}s!`);
    console.log(`  • Số đơn đăng ký (dorm_request_tbl):   ${requestCount.toLocaleString()} đơn`);
    console.log(`  • Số người lưu trú (dorm_personnel_tbl): ${personnelCount.toLocaleString()} người`);
    console.log(`============================================================\n`);
  } catch (err) {
    console.error("\n❌ Lỗi trong quá trình đồng bộ:", err);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
