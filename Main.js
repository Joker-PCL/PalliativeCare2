// Main.gs
function doGet(e) {
  console.log('กำลังจัดการคำขอ GET:', e);

  if (e && e.parameter && e.parameter.format === 'json') {
    return doGetJSON(e);
  }

  const template = HtmlService.createTemplateFromFile('page-login');

  return template
    .evaluate()
    .setTitle('เข้าสู่ระบบ')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setFaviconUrl('https://www.freeiconspng.com/uploads/medical-doctor-male-icon-png-26.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doGetJSON(e) {
  const sheetName = e.parameter.sheet || USERS_SHEET_NAME;
  const jsonData = getSheetDataAsJSON(sheetName);

  return ContentService.createTextOutput(jsonData).setMimeType(ContentService.MimeType.JSON);
}

/**********************************/
/******** สำหรับตั้งตัวแปรต่างๆ ********/
/**********************************/

// ตั้งค่าสถานะ SERVER
const SERVER_STATUS = () => {
  return JSON.stringify({
    PASSWORD_INCORRECT: 'PASSWORD_INCORRECT', // รหัสผ่านไม่ถูกต้อง
    USER_NOT_FOUND: 'USER_NOT_FOUND', // ไม่พบผู้ใช้
    LOGIN_SUCCESS: 'LOGIN_SUCCESS', // เข้าสู่ระบบสำเร็จ
    LOGIN_FAILED: 'LOGIN_FAILED', // เข้าสู่ระบบล้มเหลว
    REGISTER_SUCCESS: 'REGISTER_SUCCESS', // ลงทะเบียนสำเร็จ
    REGISTER_FAILED: 'REGISTER_FAILED', // ลงทะเบียนล้มเหลว
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS', // ผู้ใช้มีอยู่แล้ว
    INVALID_EMAIL: 'INVALID_EMAIL', // อีเมลไม่ถูกต้อง
    INVALID_TOKEN: 'INVALID_TOKEN', // โทเค็นไม่ถูกต้อง
    TOKEN_EXPIRED: 'TOKEN_EXPIRED', // โทเค็นหมดอายุ
    ACCESS_DENIED: 'ACCESS_DENIED', // การเข้าถึงถูกปฏิเสธ
    SERVER_ERROR: 'SERVER_ERROR', // ข้อผิดพลาดของเซิร์ฟเวอร์
    REQUEST_SUCCESS: 'REQUEST_SUCCESS', // การร้องขอสำเร็จ
    REQUEST_FAILED: 'REQUEST_FAILED', // การร้องขอล้มเหลว
    DATA_NOT_FOUND: 'DATA_NOT_FOUND', // ไม่พบข้อมูล
    DATA_UPDATED: 'DATA_UPDATED', // อัปเดตข้อมูลสำเร็จ
    DATA_DELETED: 'DATA_DELETED', // ลบข้อมูลสำเร็จ
    INVALID_REQUEST: 'INVALID_REQUEST', // การร้องขอไม่ถูกต้อง
    UNAUTHORIZED: 'UNAUTHORIZED', // ไม่ได้รับอนุญาต
    FORBIDDEN: 'FORBIDDEN', // ห้ามเข้าถึง
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED', // เกินขีดจำกัดการร้องขอ
    MAINTENANCE_MODE: 'MAINTENANCE_MODE', // เซิร์ฟเวอร์อยู่ในโหมดบำรุงรักษา
  });
};

// ตั้งค่าสิทธ์การใช้งาน
const ROLE_DEFINITION = () => {
  return JSON.stringify({
    ADMIN: 'ADMIN', // ผู้ดูแลระบบ
    USER: 'USER', // ผู้ใช้งาน
  });
};

// ตั้งค่า STORAGE KEY
const STORAGE_KEY = () => {
  return JSON.stringify({
    JWT_TOKEN: 'JWT_TOKEN',
    USER_DATA: 'USER_DATA',
  });
};

/**********************************/
/*********** ฟังชั่นทั่วไป ************/
/**********************************/
function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function logoutUser(email) {
  const sheet = getSheet(LOGIN_LOGS_SHEET_NAME);
  if (sheet) {
    const timestamp = new Date().toISOString();
    sheet.appendRow([email, timestamp, 'Logout']);
  }
  return { success: true, message: 'ล็อกเอาต์สำเร็จ' };
}

function testDoGet() {
  const e = { parameter: { page: 'index' } };
  const result = doGet(e);
  console.log(result.getContent());
}

function createCleanupTrigger() {
  // ลบ trigger เก่า (ถ้ามี)
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'cleanupOldLogs') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // สร้าง trigger ใหม่ ให้ทำงานทุกวัน
  ScriptApp.newTrigger('cleanupOldLogs').timeBased().everyDays(1).create();
}
