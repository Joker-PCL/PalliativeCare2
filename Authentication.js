// Authentication.gs
function authenticateUser(email, password) {
  console.log('Attempting to authenticate user:', email);

  try {
    // ตรวจสอบข้อมูลพื้นฐาน
    if (!email || !password) {
      return {
        success: false,
        message: 'กรุณากรอกอีเมลและรหัสผ่าน',
      };
    }

    if (!isValidEmail(email)) {
      return {
        success: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง',
      };
    }

    // ดึงข้อมูลผู้ใช้
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // หา index ของคอลัมน์ที่จำเป็น
    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password');
    const nameIndex = headers.indexOf('Name');
    const roleIndex = headers.indexOf('Role');
    const statusIndex = headers.indexOf('Status');
    const profileImageIndex = headers.indexOf('ProfileImage');

    // ค้นหาผู้ใช้
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // ตรวจสอบสถานะการอนุมัติก่อน
        const userStatus = data[i][statusIndex];
        if (userStatus !== 'Approved') {
          let message = '';
          switch (userStatus) {
            case 'Pending':
              message = 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ';
              break;
            case 'Rejected':
              message = 'บัญชีของคุณถูกปฏิเสธการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
              break;
            default:
              message = 'บัญชีของคุณยังไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ';
          }
          return {
            success: false,
            message: message,
            status: userStatus,
          };
        }

        // ตรวจสอบรหัสผ่าน
        if (data[i][passwordIndex] === password) {
          // บันทึกประวัติการล็อกอิน
          logUserLogin(email);

          // ดึง URL รูปโปรไฟล์ (ถ้ามี)
          let profileImageUrl = null;
          if (profileImageIndex !== -1 && data[i][profileImageIndex]) {
            try {
              if (checkDriveAccess()) {
                const file = DriveApp.getFileById(data[i][profileImageIndex]);
                profileImageUrl = file.getDownloadUrl();
              }
            } catch (e) {
              console.error('Error getting profile image:', e);
            }
          }

          // ส่งข้อมูลผู้ใช้กลับ
          return {
            success: true,
            user: {
              email: data[i][emailIndex],
              name: data[i][nameIndex],
              role: data[i][roleIndex] || 'User',
              profileImage: profileImageUrl,
              status: 'Approved',
            },
          };
        } else {
          return {
            success: false,
            message: 'รหัสผ่านไม่ถูกต้อง',
          };
        }
      }
    }

    return {
      success: false,
      message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ',
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + error.message,
    };
  }
}

function formatDateTimeToThai(date) {
  const thaiYear = date.getFullYear() + 543; // แปลงเป็นปี พ.ศ.
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // เดือนเริ่มจาก 0
  const hours = date.getHours().toString().padStart(2, '0'); // ชั่วโมง
  const minutes = date.getMinutes().toString().padStart(2, '0'); // นาที
  return `${day}/${month}/${thaiYear} ${hours}:${minutes}`; // รูปแบบสุดท้าย
}

function logUserLogin(email) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOGIN_LOGS_SHEET_NAME);
    if (!sheet) {
      console.error('Login logs sheet not found');
      return;
    }

    const timestamp = formatDateTimeToThai(new Date());
    sheet.appendRow([email, timestamp]);

    // บันทึก log กิจกรรม
    logUserActivity(email, 'LOGIN', {
      timestamp: timestamp,
      userAgent: Session.getActiveUserLocale(),
    });
  } catch (error) {
    console.error('Error logging user login:', error);
  }
}

function getLoginHistory(email) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOGIN_LOGS_SHEET_NAME);
    if (!sheet) {
      console.error('Login logs sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    return data
      .slice(1) // ข้ามแถวหัวคอลัมน์
      .filter((row) => row[0].toLowerCase() === email.toLowerCase())
      .map((row) => ({
        email: row[0],
        timestamp: row[1],
      }));
  } catch (error) {
    console.error('Error getting login history:', error);
    return [];
  }
}

function validateSession(email) {
  const users = getSheetData(USERS_SHEET_NAME);
  return users.some((user) => user.Email.toLowerCase() === email.toLowerCase());
}

function formatDateTimeToThai(date) {
  try {
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return date.toISOString();
  }
}

function checkDriveAccess() {
  try {
    DriveApp.getRootFolder();
    return true;
  } catch (e) {
    console.error('No Drive access:', e);
    return false;
  }
}
