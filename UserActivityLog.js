/**
 * ดึงประวัติการดำเนินการของผู้ใช้
 * @param {string} email - อีเมลของผู้ใช้
 * @returns {Array} ประวัติการดำเนินการ
 */
function getUserActivityLog(email) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('UserLogs');

    // สร้างชีตใหม่ถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet('UserLogs');
      // สร้างหัวตาราง
      sheet.getRange('A1:E1').setValues([['Timestamp', 'Email', 'Action', 'PerformedBy', 'Details']]);
      // จัดรูปแบบหัวตาราง
      sheet.getRange('A1:E1').setBackground('#f3f3f3').setFontWeight('bold').setHorizontalAlignment('center');
      // ปรับความกว้างคอลัมน์
      sheet.setColumnWidth(1, 180); // Timestamp
      sheet.setColumnWidth(2, 200); // Email
      sheet.setColumnWidth(3, 150); // Action
      sheet.setColumnWidth(4, 200); // PerformedBy
      sheet.setColumnWidth(5, 300); // Details
    }

    const data = sheet.getDataRange().getValues();

    // ถ้ามีแค่หัวตาราง (ไม่มีข้อมูล)
    if (data.length === 1) {
      return [];
    }

    // ดึงข้อมูลที่เกี่ยวข้องกับผู้ใช้
    const logs = data
      .slice(1)
      .filter((row) => row[1] === email)
      .map((row) => ({
        timestamp: formatDate(row[0]), // วันที่-เวลา
        action: row[2], // การดำเนินการ
        performedBy: row[3], // ผู้ดำเนินการ
        details: formatDetails(row[4]), // รายละเอียด
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // เรียงจากใหม่ไปเก่า

    return logs;
  } catch (error) {
    console.error('Error in getUserActivityLog:', error);
    throw new Error('ไม่สามารถดึงประวัติการดำเนินการได้: ' + error.message);
  }
}

/**
 * จัดรูปแบบวันที่ให้เป็นภาษาไทย
 */
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * จัดรูปแบบรายละเอียดให้อ่านง่าย
 */
function formatDetails(details) {
  try {
    if (typeof details === 'string') {
      const parsed = JSON.parse(details);
      // จัดรูปแบบตามโครงสร้างข้อมูลของคุณ
      if (parsed.timestamp) {
        parsed.timestamp = formatDate(parsed.timestamp);
      }
      return JSON.stringify(parsed, null, 2);
    }
    return details;
  } catch (e) {
    return details;
  }
}

/**
 * บันทึกประวัติการดำเนินการ
 */
function logUserActivity(email, action, details) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('UserLogs');

    // สร้างชีตใหม่ถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet('UserLogs');
      sheet.getRange('A1:E1').setValues([['Timestamp', 'Email', 'Action', 'PerformedBy', 'Details']]);
      // จัดรูปแบบหัวตาราง
      sheet.getRange('A1:E1').setBackground('#f3f3f3').setFontWeight('bold').setHorizontalAlignment('center');
      // ปรับความกว้างคอลัมน์
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 200);
      sheet.setColumnWidth(3, 150);
      sheet.setColumnWidth(4, 200);
      sheet.setColumnWidth(5, 300);
    }

    const timestamp = new Date();
    const performedBy = Session.getActiveUser().getEmail() || 'System';

    // เพิ่มข้อมูลใหม่ที่บรรทัดแรกหลังหัวตาราง
    sheet.insertRowAfter(1);
    sheet.getRange('A2:E2').setValues([[timestamp, email, action, performedBy, JSON.stringify(details)]]);

    return { success: true };
  } catch (error) {
    console.error('Error in logUserActivity:', error);
    throw new Error('ไม่สามารถบันทึกประวัติการดำเนินการได้: ' + error.message);
  }
}
