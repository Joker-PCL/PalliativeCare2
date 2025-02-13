// Constants
const VALID_UNITS = ['แผ่น', 'รีม', 'ม้วน', 'กล่อง', 'ชิ้น', 'อัน', 'ชุด'];

const SHEETS = {
  ITEMS: 'SupplyItems',
  REQUESTS: 'SupplyRequests',
  LOGS: 'SupplyLogs',
};

/**
 * Initialize supply system sheets
 */
function initializeSupplySystem() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('Initializing Supply System...');

    // Initialize Items sheet
    let itemsSheet = ss.getSheetByName(SHEETS.ITEMS);
    if (!itemsSheet) {
      itemsSheet = ss.insertSheet(SHEETS.ITEMS);
      const itemHeaders = [
        'รหัสสินค้า',
        'รายการสินค้า',
        'หน่วย',
        'สต๊อกสินค้า',
        'สต๊อกขั้นต่ำ',
        'ราคาต่อหน่วย',
        'ราคารวม',
        'หมายเหตุ',
        'วันที่อัปเดต',
        'ผู้อัปเดต',
      ];
      itemsSheet.getRange(1, 1, 1, itemHeaders.length).setValues([itemHeaders]);
      itemsSheet.getRange('A1:J1').setBackground('#f8f9fa').setFontWeight('bold');
      Logger.log('Created Items sheet');
    }

    // Initialize Requests sheet
    let requestsSheet = ss.getSheetByName(SHEETS.REQUESTS);
    if (!requestsSheet) {
      requestsSheet = ss.insertSheet(SHEETS.REQUESTS);
      const requestHeaders = [
        'รหัสเบิก',
        'วันที่เขียนเบิก',
        'ผู้เบิก',
        'อีเมล',
        'วันที่ต้องการใช้',
        'ระดับชั้น',
        'หลักสูตร',
        'วัตถุประสงค์',
        'รายการ',
        'จำนวน',
        'หน่วย',
        'สถานะ',
        'หมายเหตุ',
        'วันที่บันทึก',
        'วันที่ดำเนินการ',
        'ผู้ดำเนินการ',
      ];
      requestsSheet.getRange(1, 1, 1, requestHeaders.length).setValues([requestHeaders]);
      requestsSheet.getRange(`A1:P1`).setBackground('#f8f9fa').setFontWeight('bold');
      Logger.log('Created Requests sheet');
    }

    // Initialize Logs sheet
    let logsSheet = ss.getSheetByName(SHEETS.LOGS);
    if (!logsSheet) {
      logsSheet = ss.insertSheet(SHEETS.LOGS);
      const logHeaders = ['วันที่-เวลา', 'การดำเนินการ', 'รหัสเอกสาร', 'รายละเอียด', 'ผู้ดำเนินการ'];
      logsSheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
      logsSheet.getRange('A1:E1').setBackground('#f8f9fa').setFontWeight('bold');
      Logger.log('Created Logs sheet');
    }

    return { success: true, message: 'เริ่มต้นระบบสำเร็จ' };
  } catch (error) {
    Logger.log('Error initializing system:', error);
    return {
      success: false,
      message: 'ไม่สามารถเริ่มต้นระบบได้: ' + error.message,
    };
  }
}

/**
 * Check and ensure supply system is initialized
 */
function ensureSystemInitialized() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requiredSheets = [SHEETS.ITEMS, SHEETS.REQUESTS, SHEETS.LOGS];

    // Check if all required sheets exist
    const existingSheets = ss.getSheets().map((sheet) => sheet.getName());
    const missingSheets = requiredSheets.filter((name) => !existingSheets.includes(name));

    if (missingSheets.length > 0) {
      Logger.log('Missing sheets:', missingSheets);
      return initializeSupplySystem();
    }

    return { success: true, message: 'ระบบพร้อมใช้งาน' };
  } catch (error) {
    Logger.log('Error checking system:', error);
    return {
      success: false,
      message: 'ไม่สามารถตรวจสอบระบบได้: ' + error.message,
    };
  }
}

/**
 * Get all supply items
 */
function getSupplyItems() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ITEMS);
    if (!sheet) {
      throw new Error('ไม่พบชีทรายการพัสดุ');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    return data.slice(1).map((row) => ({
      // แปลงรหัสสินค้าเป็น string และ trim
      code: String(row[headers.indexOf('รหัสสินค้า')]).trim(),
      name: row[headers.indexOf('รายการสินค้า')] || '',
      unit: row[headers.indexOf('หน่วย')] || '',
      stock: Number(row[headers.indexOf('สต๊อกสินค้า')]) || 0,
      minStock: Number(row[headers.indexOf('สต๊อกขั้นต่ำ')]) || 0,
      price: Number(row[headers.indexOf('ราคาต่อหน่วย')]) || 0,
      total: Number(row[headers.indexOf('ราคารวม')]) || 0,
      note: row[headers.indexOf('หมายเหตุ')] || '',
    }));
  } catch (error) {
    Logger.log('Error getting items:', error);
    throw new Error('ไม่สามารถดึงข้อมูลรายการได้: ' + error.message);
  }
}

/**
 * Save supply item with validation
 */
function saveSupplyItem(item) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      return {
        success: false,
        message: 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง',
      };
    }

    // Validate required fields
    if (!item.code || !item.name || !item.unit) {
      return {
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      };
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ITEMS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeCol = headers.indexOf('รหัสสินค้า');

    // แปลงรหัสสินค้าเป็น string และ trim()
    const itemCode = String(item.code).trim();

    // Check if code already exists (for new items only)
    let existingRow = -1;
    for (let i = 1; i < data.length; i++) {
      // แปลงข้อมูลในตารางเป็น string และ trim() ก่อนเปรียบเทียบ
      const dbCode = String(data[i][codeCol]).trim();
      if (dbCode === itemCode) {
        existingRow = i + 1;
        break;
      }
    }

    // ถ้าเป็นการเพิ่มรายการใหม่ และพบรหัสซ้ำ
    if (existingRow !== -1 && !item.isEditing) {
      return {
        success: false,
        message: `รหัสสินค้า ${itemCode} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`,
      };
    }

    // แปลงค่าตัวเลขให้ถูกต้อง
    const stock = Number(item.stock) || 0;
    const minStock = Number(item.minStock) || 0;
    const price = Number(item.price) || 0;
    const total = stock * price;

    // Validate numeric values
    if (stock < 0 || minStock < 0 || price < 0) {
      return {
        success: false,
        message: 'จำนวนและราคาต้องไม่ต่ำกว่า 0',
      };
    }

    const now = new Date();
    const newData = [
      itemCode, // เก็บรหัสที่ trim() แล้ว
      item.name.trim(),
      item.unit,
      stock,
      minStock,
      price,
      total,
      item.note ? item.note.trim() : '',
      now,
      item.updatedBy || 'System',
    ];

    if (existingRow !== -1) {
      // Update existing item
      sheet.getRange(existingRow, 1, 1, headers.length).setValues([newData]);
      logSupplyAction('UPDATE_ITEM', itemCode, data[existingRow - 1], newData, item.updatedBy);
    } else {
      // Add new item
      sheet.appendRow(newData);
      logSupplyAction('CREATE_ITEM', itemCode, null, newData, item.updatedBy);
    }

    return {
      success: true,
      message: existingRow !== -1 ? 'อัปเดตรายการสำเร็จ' : 'เพิ่มรายการสำเร็จ',
      data: {
        code: itemCode,
        name: item.name.trim(),
        unit: item.unit,
        stock: stock,
        minStock: minStock,
        price: price,
        total: total,
        note: item.note ? item.note.trim() : '',
      },
    };
  } catch (error) {
    console.error('Error in saveSupplyItem:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาด: ' + error.message,
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Delete supply item with validation
 */
function deleteSupplyItem(code) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    // แปลงรหัสสินค้าเป็น string และ trim()
    const itemCode = String(code).trim();

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ITEMS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeCol = headers.indexOf('รหัสสินค้า');

    // Check if item is being used in requests
    const requestsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.REQUESTS);
    const requestsData = requestsSheet.getDataRange().getValues();
    const requestsHeaders = requestsData[0];
    const itemCol = requestsHeaders.indexOf('รายการ');

    // แปลงข้อมูลเป็น string เพื่อเปรียบเทียบ
    const hasActiveRequests = requestsData.slice(1).some((row) => {
      const rowItemCode = String(row[itemCol]).trim();
      const status = row[requestsHeaders.indexOf('สถานะ')];
      return rowItemCode === itemCode && status !== 'เสร็จสิ้น' && status !== 'ปฏิเสธ';
    });

    if (hasActiveRequests) {
      throw new Error('ไม่สามารถลบรายการที่มีการเบิกที่ยังไม่เสร็จสิ้น');
    }

    // Find and delete the item
    let found = false;
    for (let i = 1; i < data.length; i++) {
      // แปลงข้อมูลในตารางเป็น string และ trim() ก่อนเปรียบเทียบ
      if (String(data[i][codeCol]).trim() === itemCode) {
        logSupplyAction('DELETE_ITEM', itemCode, data[i], null, Session.getActiveUser().getEmail());
        sheet.deleteRow(i + 1);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error('ไม่พบรายการที่ต้องการลบ');
    }

    return {
      success: true,
      message: 'ลบรายการสำเร็จ',
    };
  } catch (error) {
    console.error('Error deleting supply item:', error);
    return {
      success: false,
      message: 'ไม่สามารถลบรายการได้: ' + error.message,
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Get low stock items
 */
function getLowStockItems() {
  try {
    const items = getSupplyItems();
    return items
      .filter((item) => item.stock <= item.minStock)
      .map((item) => ({
        code: item.code,
        name: item.name,
        stock: item.stock,
        minStock: item.minStock,
        unit: item.unit,
      }));
  } catch (error) {
    Logger.log('Error getting low stock items:', error);
    throw new Error('ไม่สามารถตรวจสอบสต็อกต่ำได้: ' + error.message);
  }
}

/**
 * Log supply action
 */
function logSupplyAction(action, documentId, oldData, newData, user) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.LOGS);
    if (!sheet) return;

    sheet.appendRow([
      new Date(),
      action,
      documentId,
      JSON.stringify({
        oldData: oldData,
        newData: newData,
      }),
      user || 'System',
    ]);
  } catch (error) {
    Logger.log('Error logging supply action:', error);
  }
}

/**
 * Update stock levels
 */
function updateStock(code, amount, type = 'subtract') {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ITEMS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeCol = headers.indexOf('รหัสสินค้า');
    const stockCol = headers.indexOf('สต๊อกสินค้า');
    const minStockCol = headers.indexOf('สต๊อกขั้นต่ำ');

    for (let i = 1; i < data.length; i++) {
      if (data[i][codeCol] === code) {
        const currentStock = Number(data[i][stockCol]) || 0;
        const minStock = Number(data[i][minStockCol]) || 0;
        let newStock;

        if (type === 'subtract') {
          if (amount > currentStock) {
            throw new Error(`สินค้า ${code} มีไม่เพียงพอ (คงเหลือ ${currentStock})`);
          }
          newStock = currentStock - amount;
        } else {
          newStock = currentStock + amount;
        }

        // Update stock
        sheet.getRange(i + 1, stockCol + 1).setValue(newStock);

        // Check low stock and log warning if needed
        if (newStock <= minStock) {
          logSupplyAction(
            'LOW_STOCK_WARNING',
            code,
            {
              currentStock: newStock,
              minStock: minStock,
            },
            null,
            Session.getActiveUser().getEmail()
          );
        }

        // Log stock update
        logSupplyAction(
          type === 'subtract' ? 'STOCK_DECREASE' : 'STOCK_INCREASE',
          code,
          { stock: currentStock },
          { stock: newStock },
          Session.getActiveUser().getEmail()
        );

        return {
          success: true,
          message: 'อัปเดตสต็อกสำเร็จ',
          oldStock: currentStock,
          newStock: newStock,
          isLowStock: newStock <= minStock,
        };
      }
    }

    throw new Error(`ไม่พบสินค้ารหัส ${code}`);
  } catch (error) {
    Logger.log('Error updating stock:', error);
    return {
      success: false,
      message: 'ไม่สามารถอัปเดตสต็อกได้: ' + error.message,
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Check stock availability
 */
function checkStockAvailability(itemCode, amount) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ITEMS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeCol = headers.indexOf('รหัสสินค้า');
    const stockCol = headers.indexOf('สต๊อกสินค้า');
    const minStockCol = headers.indexOf('สต๊อกขั้นต่ำ');

    for (let i = 1; i < data.length; i++) {
      if (data[i][codeCol] === itemCode) {
        const currentStock = Number(data[i][stockCol]) || 0;
        const minStock = Number(data[i][minStockCol]) || 0;

        return {
          success: true,
          available: currentStock >= amount,
          currentStock: currentStock,
          minStock: minStock,
          isLowStock: currentStock <= minStock,
        };
      }
    }

    return {
      success: false,
      message: `ไม่พบสินค้ารหัส ${itemCode}`,
    };
  } catch (error) {
    Logger.log('Error checking stock:', error);
    return {
      success: false,
      message: 'ไม่สามารถตรวจสอบสต็อกได้: ' + error.message,
    };
  }
}

/**
 * Get stock summary report
 */
function getStockSummary() {
  try {
    const items = getSupplyItems();

    const summary = {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + item.stock * item.price, 0),
      lowStockItems: items.filter((item) => item.stock <= item.minStock).length,
      outOfStockItems: items.filter((item) => item.stock === 0).length,
      categories: {},
      topLowStock: items
        .filter((item) => item.stock <= item.minStock && item.stock > 0)
        .sort((a, b) => a.stock / a.minStock - b.stock / b.minStock)
        .slice(0, 5)
        .map((item) => ({
          code: item.code,
          name: item.name,
          stock: item.stock,
          minStock: item.minStock,
          unit: item.unit,
        })),
    };

    // Group by unit
    items.forEach((item) => {
      if (!summary.categories[item.unit]) {
        summary.categories[item.unit] = {
          count: 0,
          totalStock: 0,
          totalValue: 0,
        };
      }
      summary.categories[item.unit].count++;
      summary.categories[item.unit].totalStock += item.stock;
      summary.categories[item.unit].totalValue += item.stock * item.price;
    });

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    Logger.log('Error getting stock summary:', error);
    return {
      success: false,
      message: 'ไม่สามารถสรุปข้อมูลสต็อกได้: ' + error.message,
    };
  }
}

/**
 * Generate stock alert notification
 */
function generateStockAlerts() {
  try {
    const lowStockItems = getLowStockItems();
    if (lowStockItems.length === 0) return null;

    const alerts = {
      critical: lowStockItems.filter((item) => item.stock === 0),
      warning: lowStockItems.filter((item) => item.stock > 0),
    };

    const message = {
      title: 'แจ้งเตือนสถานะสต็อก',
      critical:
        alerts.critical.length > 0 ? 'รายการที่หมดสต็อก:\n' + alerts.critical.map((item) => `- ${item.name} (${item.code})`).join('\n') : null,
      warning:
        alerts.warning.length > 0
          ? 'รายการที่ต่ำกว่าสต็อกขั้นต่ำ:\n' +
            alerts.warning.map((item) => `- ${item.name} (เหลือ ${item.stock} ${item.unit} จากขั้นต่ำ ${item.minStock} ${item.unit})`).join('\n')
          : null,
    };

    return message;
  } catch (error) {
    Logger.log('Error generating stock alerts:', error);
    return null;
  }
}
/**
 * Save supply request with validation
 */
function saveSupplyRequest(requestData) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      throw new Error('ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    // Validate request data
    if (!requestData || !requestData.items || !Array.isArray(requestData.items) || requestData.items.length === 0) {
      throw new Error('ข้อมูลการเบิกไม่ถูกต้อง');
    }

    // Validate email
    if (!requestData.email) {
      throw new Error('ไม่พบข้อมูลอีเมล กรุณาเข้าสู่ระบบใหม่');
    }

    // Get sheets
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const requestsSheet = ss.getSheetByName('SupplyRequests');
    const itemsSheet = ss.getSheetByName('SupplyItems');

    if (!requestsSheet || !itemsSheet) {
      throw new Error('ไม่พบชีทที่จำเป็น');
    }

    // Generate request code
    const requestCode = generateRequestCode();

    // Check stock and prepare updates
    const stockData = itemsSheet.getDataRange().getValues();
    const stockHeaders = stockData[0];
    const codeCol = stockHeaders.indexOf('รหัสสินค้า');
    const stockCol = stockHeaders.indexOf('สต๊อกสินค้า');

    // Validate all items first
    for (const item of requestData.items) {
      let found = false;
      const searchCode = String(item.code).trim();

      for (let i = 1; i < stockData.length; i++) {
        // แปลงรหัสสินค้าในฐานข้อมูลเป็น string เพื่อเปรียบเทียบ
        const dbCode = String(stockData[i][codeCol]).trim();

        if (dbCode === searchCode) {
          found = true;
          const currentStock = Number(stockData[i][stockCol]) || 0;

          if (item.amount > currentStock) {
            throw new Error(`สินค้า ${item.name} มีไม่เพียงพอ (คงเหลือ ${currentStock})`);
          }
          break;
        }
      }
      if (!found) {
        throw new Error(`ไม่พบสินค้ารหัส ${searchCode}`);
      }
    }

    // Prepare rows to add
    const rowsToAdd = requestData.items.map((item) => [
      requestCode,
      requestData.requestDate,
      requestData.requesterName,
      requestData.email,
      requestData.useDate,
      requestData.grade,
      requestData.curriculum,
      requestData.purpose,
      item.name,
      item.amount,
      item.unit,
      'รอดำเนินการ',
      requestData.note || '',
      new Date(),
      '',
      '',
    ]);

    // Update stock
    for (const item of requestData.items) {
      const searchCode = String(item.code).trim();

      for (let i = 1; i < stockData.length; i++) {
        const dbCode = String(stockData[i][codeCol]).trim();

        if (dbCode === searchCode) {
          const currentStock = Number(stockData[i][stockCol]) || 0;
          const newStock = currentStock - item.amount;
          itemsSheet.getRange(i + 1, stockCol + 1).setValue(newStock);
          break;
        }
      }
    }

    // Add request rows
    const lastRow = requestsSheet.getLastRow();
    requestsSheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);

    // Log the request
    logSupplyAction(
      'CREATE_REQUEST',
      requestCode,
      null,
      {
        requester: requestData.requesterName,
        email: requestData.email,
        items: requestData.items.map((item) => ({
          ...item,
          code: String(item.code).trim(),
        })),
      },
      requestData.email
    );

    return {
      success: true,
      message: 'บันทึกการเบิกสำเร็จ',
      requestCode: requestCode,
    };
  } catch (error) {
    Logger.log('Error in saveSupplyRequest:', error);
    return {
      success: false,
      message: error.message || 'ไม่สามารถบันทึกการเบิกได้',
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Generate unique request code
 */
function generateRequestCode() {
  const prefix = 'REQ';
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}
