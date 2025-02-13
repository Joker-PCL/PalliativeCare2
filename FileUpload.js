// FileUpload.gs

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * อัปโหลดรูปโปรไฟล์สำหรับผู้ใช้
 * @param {string} email - อีเมลของผู้ใช้
 * @param {string} base64Image - รูปภาพในรูปแบบ base64
 * @param {string} fileName - ชื่อไฟล์ของรูปภาพ
 * @returns {Object} ผลลัพธ์การอัปโหลด
 */
function uploadProfileImage(email, base64Image, fileName) {
  logToSheet(`เริ่มการอัปโหลดรูปโปรไฟล์สำหรับ email: ${email}`);

  if (!validateInputs(email, base64Image, fileName)) {
    return { success: false, message: 'ข้อมูลไม่ถูกต้องหรือไม่ครบถ้วน' };
  }

  try {
    const { mimeType, base64Data } = processBase64Image(base64Image);
    const imageSize = base64Data.length * 0.75;

    if (imageSize > MAX_FILE_SIZE) {
      logToSheet(`ขนาดไฟล์เกิน 5MB สำหรับ email: ${email}`);
      return { success: false, message: 'ขนาดไฟล์เกิน 5MB กรุณาอัปโหลดไฟล์ที่มีขนาดเล็กกว่านี้' };
    }

    const file = createFileInDrive(base64Data, mimeType, fileName);
    const imageUrl = createPublicImageUrl(file);

    updateUserProfileImage(email, imageUrl);

    logToSheet(`อัปโหลดรูปโปรไฟล์สำเร็จสำหรับ email: ${email}`);
    return { success: true, message: 'อัพโหลดรูปโปรไฟล์สำเร็จ', imageUrl: imageUrl };
  } catch (error) {
    logToSheet(`เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์สำหรับ email: ${email}, ข้อผิดพลาด: ${error.message}`);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัพโหลดรูปโปรไฟล์: ' + error.message };
  }
}

function validateInputs(email, base64Image, fileName) {
  if (!email || !base64Image || !fileName) {
    logToSheet('ข้อมูลไม่ครบถ้วน: ' + JSON.stringify({ email, hasImage: !!base64Image, fileName }));
    return false;
  }
  return true;
}

function processBase64Image(base64Image) {
  const matches = base64Image.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);
  if (!matches) {
    throw new Error('รูปแบบข้อมูลรูปภาพไม่ถูกต้อง');
  }
  return {
    mimeType: `image/${matches[1]}`,
    base64Data: matches[2],
  };
}

function createFileInDrive(base64Data, mimeType, fileName) {
  const folder = DriveApp.getFolderById(PROFILE_IMAGES_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  logToSheet(`สร้างไฟล์ใน Drive สำเร็จ, ID: ${file.getId()}`);
  return file;
}

function createPublicImageUrl(file) {
  return `https://lh5.googleusercontent.com/d/${file.getId()}`;
}

function updateUserProfileImage(email, imageUrl) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('Email');
  const profileImageIndex = headers.indexOf('ProfileImage');

  if (emailIndex === -1 || profileImageIndex === -1) {
    throw new Error('ไม่พบคอลัมน์ Email หรือ ProfileImage ในชีต');
  }

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
      const oldImageUrl = data[i][profileImageIndex];
      if (oldImageUrl && !oldImageUrl.startsWith('http')) {
        try {
          DriveApp.getFileById(oldImageUrl).setTrashed(true);
          logToSheet(`ลบไฟล์เก่าสำเร็จ: ${oldImageUrl}`);
        } catch (e) {
          logToSheet(`ไม่สามารถลบไฟล์เก่าได้: ${oldImageUrl}, ข้อผิดพลาด: ${e.message}`);
        }
      }
      sheet.getRange(i + 2, profileImageIndex + 1).setValue(imageUrl);
      logToSheet(`อัปเดต URL รูปโปรไฟล์สำเร็จสำหรับ email: ${email}`);
      return;
    }
  }
  throw new Error('ไม่พบผู้ใช้ในระบบ');
}

/**
 * บันทึกข้อความลงในชีต log
 * @param {string} message - ข้อความที่ต้องการบันทึก
 */
function logToSheet(message) {
  const logSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOGS_SHEET_NAME);
  if (!logSheet) {
    console.error('ไม่พบชีต log');
    return;
  }

  const timestamp = new Date().toISOString();
  logSheet.appendRow([timestamp, message]);
}

/**
 * ฟังก์ชันสำหรับรับข้อมูลจากฝั่ง client ผ่าน HTTP POST
 */
function doPost(e) {
  const { email, base64Image, fileName } = e.parameter;
  return ContentService.createTextOutput(JSON.stringify(uploadProfileImage(email, base64Image, fileName))).setMimeType(ContentService.MimeType.JSON);
}
