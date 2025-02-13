// Constants
const SUPPLY_REQUEST_SHEET = 'SupplyRequests';

/**
 * Get request status for a specific user
 */
function getRequestStatus(email) {
  try {
    if (!email) {
      return {
        success: false,
        message: 'กรุณาระบุอีเมล',
      };
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName(SUPPLY_REQUEST_SHEET);

    if (!requestsSheet) {
      return {
        success: false,
        message: 'ไม่พบชีทข้อมูลการเบิก',
      };
    }

    const data = requestsSheet.getDataRange().getValues();
    const headers = data[0];

    // Map column indexes
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
      createdDate: headers.indexOf('วันที่บันทึก'),
      operator: headers.indexOf('ผู้ดำเนินการ'),
    };

    // Validate required columns
    const requiredColumns = ['requestCode', 'requestDate', 'requester', 'email', 'item', 'amount', 'unit', 'status'];
    const missingColumns = requiredColumns.filter((col) => columnIndexes[col] === -1).map((col) => col);

    if (missingColumns.length > 0) {
      return {
        success: false,
        message: `ไม่พบคอลัมน์ที่จำเป็น: ${missingColumns.join(', ')}`,
      };
    }

    // Filter and map requests
    const requests = data
      .slice(1)
      .filter((row) => row[columnIndexes.email] === email)
      .map((row) => ({
        requestCode: row[columnIndexes.requestCode] || '',
        requestDate: formatDate(row[columnIndexes.requestDate]),
        requester: row[columnIndexes.requester] || '',
        useDate: formatDate(row[columnIndexes.useDate]),
        grade: row[columnIndexes.grade] || '',
        curriculum: row[columnIndexes.curriculum] || '',
        purpose: row[columnIndexes.purpose] || '',
        item: row[columnIndexes.item] || '',
        amount: Number(row[columnIndexes.amount]) || 0,
        unit: row[columnIndexes.unit] || '',
        status: row[columnIndexes.status] || 'รอดำเนินการ',
        note: row[columnIndexes.note] || '',
        createdDate: formatDate(row[columnIndexes.createdDate]),
        operator: row[columnIndexes.operator] || '',
      }));

    // Sort by request date descending
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

    return {
      success: true,
      data: requests,
    };
  } catch (error) {
    console.error('Error in getRequestStatus:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถดึงข้อมูลได้'),
    };
  }
}

/**
 * Update request status
 */
function updateRequestStatus(requestCode, newStatus, note, operator) {
  const lock = LockService.getScriptLock();

  try {
    if (!requestCode || !newStatus) {
      return {
        success: false,
        message: 'กรุณาระบุรหัสการเบิกและสถานะใหม่',
      };
    }

    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    const validStatuses = ['รอดำเนินการ', 'อนุมัติแล้ว', 'ปฏิเสธ', 'เสร็จสิ้น'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error('สถานะไม่ถูกต้อง');
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName(SUPPLY_REQUEST_SHEET);

    if (!requestsSheet) {
      throw new Error('ไม่พบชีทข้อมูลการเบิก');
    }

    const data = requestsSheet.getDataRange().getValues();
    const headers = data[0];

    const columnIndexes = {
      requestCode: headers.indexOf('รหัสเบิก'),
      status: headers.indexOf('สถานะ'),
      note: headers.indexOf('หมายเหตุ'),
      operator: headers.indexOf('ผู้ดำเนินการ'),
      updatedDate: headers.indexOf('วันที่ดำเนินการ'),
    };

    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][columnIndexes.requestCode] === requestCode) {
        // Update status
        requestsSheet.getRange(i + 1, columnIndexes.status + 1).setValue(newStatus);

        // Update note
        if (columnIndexes.note !== -1) {
          requestsSheet.getRange(i + 1, columnIndexes.note + 1).setValue(note || '');
        }

        // Update operator
        if (columnIndexes.operator !== -1) {
          requestsSheet.getRange(i + 1, columnIndexes.operator + 1).setValue(operator || '');
        }

        // Update operation date
        if (columnIndexes.updatedDate !== -1) {
          requestsSheet.getRange(i + 1, columnIndexes.updatedDate + 1).setValue(new Date());
        }

        // Log the update
        logSupplyAction('UPDATE_REQUEST_STATUS', {
          requestCode: requestCode,
          oldStatus: data[i][columnIndexes.status],
          newStatus: newStatus,
          operator: operator,
          note: note,
        });

        updated = true;
        break;
      }
    }

    if (!updated) {
      throw new Error('ไม่พบรายการที่ต้องการอัปเดต');
    }

    return {
      success: true,
      message: 'อัปเดตสถานะเรียบร้อย',
    };
  } catch (error) {
    console.error('Error in updateRequestStatus:', error);
    return {
      success: false,
      message: 'ไม่สามารถอัปเดตสถานะได้: ' + (error.message || 'เกิดข้อผิดพลาด'),
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Get request summary statistics
 */
function getRequestSummary(email) {
  try {
    const status = getRequestStatus(email);
    if (!status.success) {
      return status;
    }

    const requests = status.data;
    const summary = {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'รอดำเนินการ').length,
      approved: requests.filter((r) => r.status === 'อนุมัติแล้ว').length,
      rejected: requests.filter((r) => r.status === 'ปฏิเสธ').length,
      completed: requests.filter((r) => r.status === 'เสร็จสิ้น').length,
      recentRequests: requests.slice(0, 5), // 5 รายการล่าสุด
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    console.error('Error in getRequestSummary:', error);
    return {
      success: false,
      message: 'ไม่สามารถดึงข้อมูลสรุปได้: ' + (error.message || 'เกิดข้อผิดพลาด'),
    };
  }
}

/**
 * Get all requests (for admin)
 */
function getAllRequests(filters = {}) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName(SUPPLY_REQUEST_SHEET);

    if (!requestsSheet) {
      return {
        success: false,
        message: 'ไม่พบชีทข้อมูลการเบิก',
      };
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
      createdDate: headers.indexOf('วันที่บันทึก'),
      operator: headers.indexOf('ผู้ดำเนินการ'),
    };

    let requests = data.slice(1).map((row) => ({
      requestCode: row[columnIndexes.requestCode] || '',
      requestDate: formatDate(row[columnIndexes.requestDate]),
      requester: row[columnIndexes.requester] || '',
      email: row[columnIndexes.email] || '',
      useDate: formatDate(row[columnIndexes.useDate]),
      grade: row[columnIndexes.grade] || '',
      curriculum: row[columnIndexes.curriculum] || '',
      purpose: row[columnIndexes.purpose] || '',
      item: row[columnIndexes.item] || '',
      amount: Number(row[columnIndexes.amount]) || 0,
      unit: row[columnIndexes.unit] || '',
      status: row[columnIndexes.status] || 'รอดำเนินการ',
      note: row[columnIndexes.note] || '',
      createdDate: formatDate(row[columnIndexes.createdDate]),
      operator: row[columnIndexes.operator] || '',
    }));

    // Apply filters
    if (filters.status) {
      requests = requests.filter((req) => req.status === filters.status);
    }
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      requests = requests.filter((req) => new Date(req.requestDate) >= startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      requests = requests.filter((req) => new Date(req.requestDate) <= endDate);
    }
    if (filters.requester) {
      requests = requests.filter(
        (req) =>
          req.requester.toLowerCase().includes(filters.requester.toLowerCase()) || req.email.toLowerCase().includes(filters.requester.toLowerCase())
      );
    }

    // Sort by date descending
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

    return {
      success: true,
      data: requests,
    };
  } catch (error) {
    console.error('Error in getAllRequests:', error);
    return {
      success: false,
      message: 'ไม่สามารถดึงข้อมูลการเบิกได้: ' + (error.message || 'เกิดข้อผิดพลาด'),
    };
  }
}

/**
 * Utility function to format date
 */
function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toISOString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}
