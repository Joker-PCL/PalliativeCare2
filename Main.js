// Main.gs
function doGet(e) {
  console.log('กำลังจัดการคำขอ GET:', e);

  if (e && e.parameter && e.parameter.format === 'json') {
    return doGetJSON(e);
  }

  const pageName = e && e.parameter ? e.parameter.page || 'index' : 'index';
  const template = HtmlService.createTemplateFromFile(PAGES[pageName] || PAGES.index);

  return template
    .evaluate()
    .setTitle('ระบบ เบิกพัสดุ')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setFaviconUrl('https://www.freeiconspng.com/uploads/medical-doctor-male-icon-png-26.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doGetJSON(e) {
  const sheetName = e.parameter.sheet || USERS_SHEET_NAME;
  const jsonData = getSheetDataAsJSON(sheetName);

  return ContentService.createTextOutput(jsonData).setMimeType(ContentService.MimeType.JSON);
}

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
