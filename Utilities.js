// Utilities.gs

function getSheet(sheetName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map((row) =>
    headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {})
  );
}

function updateExistingProfileImageUrls() {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const profileImageIndex = headers.indexOf('ProfileImage');

  for (let i = 0; i < data.length; i++) {
    const fileIdOrUrl = data[i][profileImageIndex];
    if (fileIdOrUrl && !fileIdOrUrl.startsWith('http')) {
      const newUrl = `https://lh5.googleusercontent.com/d/=${fileIdOrUrl}`;
      sheet.getRange(i + 2, profileImageIndex + 1).setValue(newUrl);
    }
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  return Array(length)
    .fill(0)
    .map(() => charset[Math.floor(Math.random() * charset.length)])
    .join('');
}

function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]+/)) strength++;
  if (password.match(/[A-Z]+/)) strength++;
  if (password.match(/[0-9]+/)) strength++;
  if (password.match(/[$@#&!]+/)) strength++;

  switch (strength) {
    case 0:
    case 1:
    case 2:
      return { valid: false, message: 'รหัสผ่านอ่อนเกินไป กรุณาใช้ตัวอักษรตัวเล็ก ตัวใหญ่ ตัวเลข และอักขระพิเศษ' };
    case 3:
      return { valid: true, message: 'รหัสผ่านปานกลาง' };
    case 4:
    case 5:
      return { valid: true, message: 'รหัสผ่านแข็งแรง' };
  }
}
