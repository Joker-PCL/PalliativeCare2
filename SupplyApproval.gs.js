// Constants
const VALID_ACTIONS = ['approve', 'reject', 'complete'];
const VALID_STATUSES = ['รอดำเนินการ', 'อนุมัติแล้ว', 'ปฏิเสธ', 'เสร็จสิ้น'];

function getSupplyRequests() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName('SupplyRequests');

    if (!requestsSheet) {
      throw new Error('ไม่พบชีทข้อมูลการเบิก');
    }

    const data = requestsSheet.getDataRange().getValues();
    const headers = data[0];

    const columnIndexes = {
      requestCode: headers.indexOf('รหัสเบิก'),
      requestDate: headers.indexOf('วันที่เขียนเบิก'),
      requester: headers.indexOf('ผู้เบิก'),
      email: headers.indexOf('อีเมล'),
      useDate: headers.indexOf('วันที่ต้องการใช้'),
      grade: headers.indexOf('ระดับชั้น'),
      curriculum: headers.indexOf('หลักสูตร'),
      purpose: headers.indexOf('วัตถุประสงค์'),
      item: headers.indexOf('รายการ'),
      amount: headers.indexOf('จำนวน'),
      unit: headers.indexOf('หน่วย'),
      status: headers.indexOf('สถานะ'),
      note: headers.indexOf('หมายเหตุ'),
      operator: headers.indexOf('ผู้ดำเนินการ'),
      updatedDate: headers.indexOf('วันที่ดำเนินการ'),
    };

    const requests = data.slice(1).map((row) => ({
      requestCode: row[columnIndexes.requestCode],
      requestDate: formatDate(row[columnIndexes.requestDate]),
      requester: row[columnIndexes.requester],
      email: row[columnIndexes.email],
      useDate: formatDate(row[columnIndexes.useDate]),
      grade: row[columnIndexes.grade],
      curriculum: row[columnIndexes.curriculum],
      purpose: row[columnIndexes.purpose],
      item: row[columnIndexes.item],
      amount: row[columnIndexes.amount],
      unit: row[columnIndexes.unit],
      status: row[columnIndexes.status] || 'รอดำเนินการ',
      note: row[columnIndexes.note] || '',
      operator: row[columnIndexes.operator] || '',
      updatedDate: formatDate(row[columnIndexes.updatedDate]),
    }));

    return {
      success: true,
      data: requests,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล',
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function handleSupplyApproval(requestCode, itemIndex, action, note, operator) {
  const lock = LockService.getScriptLock();
  try {
    if (!requestCode || itemIndex === undefined || !action || !operator) {
      throw new Error('ข้อมูลไม่ครบถ้วน');
    }

    if (!VALID_ACTIONS.includes(action)) {
      throw new Error('การดำเนินการไม่ถูกต้อง');
    }

    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName('SupplyRequests');
    const data = requestsSheet.getDataRange().getValues();
    const headers = data[0];

    const cols = {
      requestCode: headers.indexOf('รหัสเบิก'),
      item: headers.indexOf('รายการ'),
      status: headers.indexOf('สถานะ'),
      note: headers.indexOf('หมายเหตุ'),
      operator: headers.indexOf('ผู้ดำเนินการ'),
      updatedDate: headers.indexOf('วันที่ดำเนินการ'),
    };

    let matchingRows = [];
    data.forEach((row, idx) => {
      if (idx > 0 && row[cols.requestCode] === requestCode) {
        matchingRows.push(idx);
      }
    });

    if (itemIndex >= matchingRows.length) {
      throw new Error('ไม่พบรายการที่ต้องการอัปเดต');
    }

    const rowToUpdate = matchingRows[itemIndex] + 1;
    const oldStatus = data[rowToUpdate - 1][cols.status];
    const newStatus = getNewStatus(action);

    // Update the row
    requestsSheet.getRange(rowToUpdate, cols.status + 1).setValue(newStatus);
    requestsSheet.getRange(rowToUpdate, cols.note + 1).setValue(note || '');
    requestsSheet.getRange(rowToUpdate, cols.operator + 1).setValue(operator);
    requestsSheet.getRange(rowToUpdate, cols.updatedDate + 1).setValue(new Date());

    // Log action
    logSupplyAction('UPDATE_REQUEST_STATUS', {
      requestCode,
      itemIndex,
      item: data[rowToUpdate - 1][cols.item],
      oldStatus,
      newStatus,
      operator,
      note,
    });

    return {
      success: true,
      message: `อัปเดตสถานะสำเร็จ: ${data[rowToUpdate - 1][cols.item]}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดำเนินการ',
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function getSupplyRequestSummary() {
  try {
    const response = getSupplyRequests();
    if (!response.success) {
      throw new Error(response.message);
    }

    const requests = response.data;
    const summary = {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'รอดำเนินการ').length,
      approved: requests.filter((r) => r.status === 'อนุมัติแล้ว').length,
      rejected: requests.filter((r) => r.status === 'ปฏิเสธ').length,
      completed: requests.filter((r) => r.status === 'เสร็จสิ้น').length,
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุป',
    };
  }
}

function getNewStatus(action) {
  switch (action) {
    case 'approve':
      return 'อนุมัติแล้ว';
    case 'reject':
      return 'ปฏิเสธ';
    case 'complete':
      return 'เสร็จสิ้น';
    default:
      return 'รอดำเนินการ';
  }
}

function formatDate(date) {
  if (!date) return 'ไม่ระบุ';
  try {
    // ถ้าเป็น string ที่มาจาก Excel/Sheets ให้แปลงเป็น Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // ตรวจสอบว่าวันที่ถูกต้อง
    if (isNaN(dateObj.getTime())) {
      return 'ไม่ระบุ';
    }

    // ใช้ Utilities.formatDate ของ Apps Script ในการจัดรูปแบบ
    return Utilities.formatDate(dateObj, 'Asia/Bangkok', 'dd MMMM yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'ไม่ระบุ';
  }
}

function validateApprovalPermission(userEmail) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const usersSheet = ss.getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();
    const headers = data[0];

    const emailCol = headers.indexOf('email');
    const roleCol = headers.indexOf('role');

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol] === userEmail) {
        return data[i][roleCol] === 'admin';
      }
    }
    return false;
  } catch (error) {
    console.error('Error validating permission:', error);
    return false;
  }
}
