// ProfileManagement.gs

function getUserData(email) {
  if (!email) {
    console.error('getUserData: Email parameter is missing or undefined');
    return null;
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.indexOf('Email');

  if (emailIndex === -1) {
    console.error('Email column not found');
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][emailIndex] && data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = data[i][index];
      });

      return {
        email: user.Email,
        name: user.Name,
        role: user.Role || 'User',
        profileImage: user.ProfileImage || null,
      };
    }
  }

  console.log(`User not found: ${email}`);
  return null;
}

function updateUserProfile(userData) {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('Email');
  const nameIndex = headers.indexOf('Name');

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailIndex].toLowerCase() === userData.email.toLowerCase()) {
      sheet.getRange(i + 2, nameIndex + 1).setValue(userData.name);
      return { success: true, message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ' };
    }
  }

  return { success: false, message: 'ไม่พบผู้ใช้ในระบบ' };
}

function changeUserPassword(email, currentPassword, newPassword) {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('Email');
  const passwordIndex = headers.indexOf('Password');

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
      if (data[i][passwordIndex] === currentPassword) {
        sheet.getRange(i + 2, passwordIndex + 1).setValue(newPassword);
        return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
      } else {
        return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
      }
    }
  }

  return { success: false, message: 'ไม่พบผู้ใช้ในระบบ' };
}

function resetUserPassword(email) {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('Email');
  const passwordIndex = headers.indexOf('Password');

  for (let i = 0; i < data.length; i++) {
    if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
      const newPassword = generateRandomPassword();
      sheet.getRange(i + 2, passwordIndex + 1).setValue(newPassword);
      return {
        success: true,
        message: 'รหัสผ่านถูกรีเซ็ตแล้ว',
        newPassword: newPassword,
      };
    }
  }
  return { success: false, message: 'ไม่พบผู้ใช้ในระบบ' };
}
