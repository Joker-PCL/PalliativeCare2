// UserManagement.gs
// Constants
const CONFIG = {
  SHEETS: {
    USERS: 'Users',
    PASSWORD_RESET_LOGS: 'PasswordResetLogs',
  },
  COOLDOWN: {
    MINUTES: 10,
    LOCK_TIMEOUT: 10000, // 10 seconds
  },
  COLUMNS: {
    USERS: {
      EMAIL: 'Email',
      PASSWORD: 'Password',
      NAME: 'Name',
      STATUS: 'Status',
    },
    LOGS: {
      TIMESTAMP: 'Timestamp',
      EMAIL: 'Email',
      NAME: 'Name',
      STATUS: 'Status',
      ERROR: 'Error',
    },
  },
  STATUS: {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    APPROVED: 'Approved',
  },
};

function getAllUsers() {
  return getSheetData(USERS_SHEET_NAME).map((user) => ({
    email: user.Email || '',
    name: user.Name || '',
    role: user.Role || 'User',
  }));
}

function addUser(userData) {
  try {
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!userData.email || !userData.password || !userData.name) {
      return { success: false, message: 'ข้อมูลผู้ใช้ไม่ครบถ้วน' };
    }

    // ตรวจสอบรูปแบบอีเมล
    if (!isValidEmail(userData.email)) {
      return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' };
    }

    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    // ตรวจสอบอีเมลซ้ำ
    const existingUser = data.slice(1).find((row) => row[emailIndex].toLowerCase() === userData.email.toLowerCase());

    if (existingUser) {
      return { success: false, message: 'อีเมลนี้มีอยู่ในระบบแล้ว' };
    }

    // สร้างข้อมูลแถวใหม่
    const newRow = headers.map((header) => {
      switch (header) {
        case 'Email':
          return userData.email;
        case 'Password':
          return userData.password;
        case 'Name':
          return userData.name;
        case 'Role':
          return userData.role || 'User';
        case 'Status':
          return 'Pending';
        case 'RegisterDate':
          return new Date();
        case 'ApprovalDate':
          return '';
        case 'RejectionReason':
          return '';
        default:
          return '';
      }
    });

    // เพิ่มข้อมูลในชีท
    sheet.appendRow(newRow);

    // บันทึก log
    logUserActivity(userData.email, 'ADD_USER', {
      name: userData.name,
      role: userData.role,
      addedBy: Session.getActiveUser().getEmail(),
    });

    // ส่งอีเมลแจ้งเตือนแอดมิน
    notifyAdminNewUser(userData);

    return {
      success: true,
      message: 'เพิ่มผู้ใช้สำเร็จ',
    };
  } catch (error) {
    console.error('Error in addUser:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้: ' + error.message,
    };
  }
}

function notifyAdminNewUser(userData) {
  try {
    const adminEmails = getAdminEmails();
    if (!adminEmails || adminEmails.length === 0) {
      console.warn('No admin users found for notification');
      return;
    }

    const subject = 'มีการเพิ่มผู้ใช้ใหม่ในระบบ';
    const body = `
เรียน ผู้ดูแลระบบ

มีการเพิ่มผู้ใช้ใหม่ในระบบ โดยมีรายละเอียดดังนี้:

ข้อมูลผู้ใช้:
- อีเมล: ${userData.email}
- ชื่อ-นามสกุล: ${userData.name}
- บทบาท: ${userData.role || 'User'}
- วันที่ลงทะเบียน: ${new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}

กรุณาดำเนินการตรวจสอบและอนุมัติผู้ใช้งานใหม่ผ่านระบบจัดการผู้ใช้

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้พัฒนาระบบ

ขอแสดงความนับถือ
ระบบบันทึกข้อมูลครู`;

    // ส่งอีเมลแจ้งเตือนแอดมินทุกคน
    adminEmails.forEach((adminEmail) => {
      try {
        MailApp.sendEmail({
          to: adminEmail,
          subject: subject,
          body: body,
          noReply: true, // ป้องกันการตอบกลับอีเมล
        });

        // บันทึก log การส่งอีเมล
        logEmailNotification({
          type: 'ADMIN_NEW_USER_NOTIFICATION',
          recipient: adminEmail,
          subject: subject,
          status: 'SUCCESS',
          userData: userData.email,
        });
      } catch (emailError) {
        console.error(`Failed to send email to admin ${adminEmail}:`, emailError);

        // บันทึก log กรณีส่งอีเมลไม่สำเร็จ
        logEmailNotification({
          type: 'ADMIN_NEW_USER_NOTIFICATION',
          recipient: adminEmail,
          subject: subject,
          status: 'FAILED',
          error: emailError.message,
          userData: userData.email,
        });
      }
    });

    // ส่งอีเมลยืนยันให้ผู้ใช้ใหม่
    sendNewUserConfirmation(userData);
  } catch (error) {
    console.error('Error in notifyAdminNewUser:', error);

    // บันทึก log กรณีเกิดข้อผิดพลาดในฟังก์ชัน
    logSystemError({
      function: 'notifyAdminNewUser',
      error: error.message,
      userData: userData.email,
    });
  }
}

// ฟังก์ชันส่งอีเมลยืนยันให้ผู้ใช้ใหม่
function sendNewUserConfirmation(userData) {
  try {
    const subject = 'ยืนยันการลงทะเบียนผู้ใช้งานใหม่';
    const body = `
เรียน คุณ${userData.name}

ขอบคุณสำหรับการลงทะเบียนใช้งานระบบบันทึกข้อมูลครู
การลงทะเบียนของคุณได้รับการบันทึกเรียบร้อยแล้ว และอยู่ระหว่างการตรวจสอบโดยผู้ดูแลระบบ

เมื่อการลงทะเบียนได้รับการอนุมัติ ระบบจะส่งอีเมลแจ้งให้ทราบอีกครั้ง
คุณสามารถใช้อีเมลและรหัสผ่านที่ลงทะเบียนไว้ในการเข้าสู่ระบบ

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ระบบบันทึกข้อมูลครู`;

    MailApp.sendEmail({
      to: userData.email,
      subject: subject,
      body: body,
      noReply: true,
    });

    // บันทึก log การส่งอีเมล
    logEmailNotification({
      type: 'NEW_USER_CONFIRMATION',
      recipient: userData.email,
      subject: subject,
      status: 'SUCCESS',
    });
  } catch (error) {
    console.error('Error sending confirmation email:', error);

    // บันทึก log กรณีส่งอีเมลไม่สำเร็จ
    logEmailNotification({
      type: 'NEW_USER_CONFIRMATION',
      recipient: userData.email,
      subject: subject,
      status: 'FAILED',
      error: error.message,
    });
  }
}

// ฟังก์ชันบันทึก log การส่งอีเมล
function logEmailNotification(logData) {
  try {
    const sheet = getSheet(LOGS_SHEET_NAME);
    const timestamp = new Date();

    const logRow = [
      timestamp,
      logData.type,
      logData.recipient,
      logData.subject,
      logData.status,
      logData.error || '',
      logData.userData || '',
      Session.getActiveUser().getEmail(),
    ];

    sheet.appendRow(logRow);
  } catch (error) {
    console.error('Error logging email notification:', error);
  }
}

// ฟังก์ชันบันทึก log ข้อผิดพลาดของระบบ
function logSystemError(errorData) {
  try {
    const sheet = getSheet(LOGS_SHEET_NAME);
    const timestamp = new Date();

    const errorRow = [timestamp, 'SYSTEM_ERROR', errorData.function, errorData.error, errorData.userData || '', Session.getActiveUser().getEmail()];

    sheet.appendRow(errorRow);
  } catch (error) {
    console.error('Error logging system error:', error);
  }
}

function deleteUser(email) {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const emailIndex = data[0].indexOf('Email');
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ผู้ใช้ถูกลบออกจากระบบแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบผู้ใช้ในระบบ' };
}

// เพิ่มฟังก์ชันตรวจสอบสถานะที่ถูกต้อง
function validateStatus(status) {
  const validStatuses = ['Approved', 'Rejected', 'Pending'];
  return validStatuses.includes(status);
}

function updateUserByAdmin(email, newData) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // หา index ของคอลัมน์ที่จำเป็น
    const emailIndex = headers.indexOf('Email');
    const nameIndex = headers.indexOf('Name');
    const roleIndex = headers.indexOf('Role');
    const statusIndex = headers.indexOf('Status');
    const approvalDateIndex = headers.indexOf('ApprovalDate');
    const rejectionReasonIndex = headers.indexOf('RejectionReason');

    // ตรวจสอบว่ามีคอลัมน์ที่จำเป็นครบหรือไม่
    if (emailIndex === -1 || statusIndex === -1) {
      throw new Error('ไม่พบคอลัมน์ที่จำเป็นในชีท');
    }

    // แก้ไขส่วนการตรวจสอบสถานะ - ต้องตรงกับค่าที่กำหนดใน Data Validation
    const validStatuses = ['Pending', 'Approved', 'Rejected'];
    if (newData.status && !validStatuses.includes(newData.status)) {
      return {
        success: false,
        message: `สถานะ ${newData.status} ไม่ถูกต้อง กรุณาเลือกจาก: ${validStatuses.join(', ')}`,
      };
    }

    // ค้นหาและอัพเดตข้อมูล
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // เก็บข้อมูลเดิมไว้สำหรับเปรียบเทียบ
        const oldStatus = data[i][statusIndex];
        const oldName = data[i][nameIndex];
        const oldRole = data[i][roleIndex];

        // อัพเดตข้อมูลพื้นฐาน
        if (newData.name && nameIndex !== -1) {
          sheet.getRange(i + 1, nameIndex + 1).setValue(newData.name);
        }

        if (newData.role && roleIndex !== -1) {
          sheet.getRange(i + 1, roleIndex + 1).setValue(newData.role);
        }

        // อัพเดตสถานะและข้อมูลที่เกี่ยวข้อง
        if (newData.status) {
          // อัพเดตสถานะ
          sheet.getRange(i + 1, statusIndex + 1).setValue(newData.status);

          switch (newData.status) {
            case 'Approved':
              // เมื่ออนุมัติ ให้บันทึกวันที่อนุมัติและเคลียร์เหตุผลการปฏิเสธ
              if (approvalDateIndex !== -1) {
                sheet.getRange(i + 1, approvalDateIndex + 1).setValue(new Date());
              }
              if (rejectionReasonIndex !== -1) {
                sheet.getRange(i + 1, rejectionReasonIndex + 1).setValue('');
              }

              // ส่งอีเมลแจ้งเตือนถ้าสถานะเปลี่ยนจาก Pending หรือ Rejected เป็น Approved
              if (oldStatus !== 'Approved') {
                sendApprovalEmail(email, newData.name || oldName);
              }
              break;

            case 'Rejected':
              // เมื่อปฏิเสธ ต้องมีเหตุผล
              if (!newData.rejectionReason) {
                return {
                  success: false,
                  message: 'กรุณาระบุเหตุผลในการปฏิเสธ',
                };
              }

              // บันทึกเหตุผลการปฏิเสธและเคลียร์วันที่อนุมัติ
              if (rejectionReasonIndex !== -1) {
                sheet.getRange(i + 1, rejectionReasonIndex + 1).setValue(newData.rejectionReason);
              }
              if (approvalDateIndex !== -1) {
                sheet.getRange(i + 1, approvalDateIndex + 1).setValue('');
              }

              // ส่งอีเมลแจ้งเตือนการปฏิเสธ
              if (oldStatus !== 'Rejected') {
                sendRejectionEmail(email, newData.name || oldName, newData.rejectionReason);
              }
              break;

            case 'Pending':
              // เมื่อกลับไปรอการอนุมัติ ให้เคลียร์ข้อมูลที่เกี่ยวข้อง
              if (approvalDateIndex !== -1) {
                sheet.getRange(i + 1, approvalDateIndex + 1).setValue('');
              }
              if (rejectionReasonIndex !== -1) {
                sheet.getRange(i + 1, rejectionReasonIndex + 1).setValue('');
              }
              break;
          }
        }

        // บันทึก log การเปลี่ยนแปลง
        logUserActivity(email, 'UPDATE_USER', {
          updatedBy: Session.getActiveUser().getEmail(),
          oldStatus: oldStatus,
          newStatus: newData.status,
          oldName: oldName,
          newName: newData.name,
          oldRole: oldRole,
          newRole: newData.role,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'อัพเดตข้อมูลผู้ใช้สำเร็จ',
          updatedUser: {
            email: email,
            name: newData.name || oldName,
            role: newData.role || oldRole,
            status: newData.status || oldStatus,
            rejectionReason: newData.rejectionReason || '',
          },
        };
      }
    }

    // กรณีไม่พบผู้ใช้
    return {
      success: false,
      message: 'ไม่พบผู้ใช้ในระบบ',
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล: ' + error.message,
    };
  }
}

// เพิ่มฟังก์ชันตรวจสอบสถานะ
function getValidUserStatuses() {
  return ['Pending', 'Approved', 'Rejected', 'Inactive'];
}

function sendStatusUpdateEmail(email, name, newStatus, rejectionReason) {
  try {
    const statusText = {
      Approved: 'ได้รับการอนุมัติ',
      Rejected: 'ถูกปฏิเสธ',
      Pending: 'อยู่ระหว่างการพิจารณา',
    }[newStatus];

    if (statusText) {
      const subject = `สถานะบัญชีของคุณมีการเปลี่ยนแปลง - ${statusText}`;
      let body = `เรียน ${name}\n\nบัญชีของคุณ${statusText}`;

      if (newStatus === 'Rejected' && rejectionReason) {
        body += `\n\nเหตุผล: ${rejectionReason}`;
      }

      body += `\n\nหากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ\n\nขอแสดงความนับถือ\nทีมงานระบบบันทึกข้อมูลครู`;

      MailApp.sendEmail(email, subject, body);
    }
  } catch (error) {
    console.error('Error sending status update email:', error);
  }
}

// เพิ่มฟังก์ชันส่งอีเมลแจ้งเตือนการเปลี่ยนสถานะ
function sendStatusUpdateEmail(email, name, newStatus) {
  try {
    const statusText = {
      Approved: 'ได้รับการอนุมัติ',
      Rejected: 'ถูกปฏิเสธ',
      Inactive: 'ถูกระงับการใช้งาน',
    }[newStatus];

    if (statusText) {
      const subject = `บัญชีของคุณ${statusText}`;
      const body = `เรียน ${name}

บัญชีของคุณได้${statusText}
${newStatus === 'Approved' ? 'คุณสามารถเข้าสู่ระบบได้ทันที' : ''}
${newStatus === 'Rejected' ? 'กรุณาติดต่อผู้ดูแลระบบเพื่อขอข้อมูลเพิ่มเติม' : ''}

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

      MailApp.sendEmail(email, subject, body);
    }
  } catch (error) {
    console.error('Error sending status update email:', error);
  }
}

function doPost(e) {
  var action = e.parameter.action;

  if (action == 'updateProfile') {
    var userData = {
      name: e.parameter.name,
      email: e.parameter.email,
      base64Image: e.parameter.base64Image,
      fileName: e.parameter.fileName,
    };

    return ContentService.createTextOutput(JSON.stringify(updateUserProfile(userData))).setMimeType(ContentService.MimeType.JSON);
  }

  // เพิ่ม actions อื่นๆ ตามต้องการ
}

// UserManagement.gs

function getAllUsers() {
  const sheet = getSheet(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // หา index ของแต่ละคอลัมน์
  const emailIndex = headers.indexOf('Email');
  const nameIndex = headers.indexOf('Name');
  const roleIndex = headers.indexOf('Role');
  const statusIndex = headers.indexOf('Status');
  const registerDateIndex = headers.indexOf('RegisterDate');
  const approvalDateIndex = headers.indexOf('ApprovalDate');
  const rejectionReasonIndex = headers.indexOf('RejectionReason');

  // แปลงข้อมูลเป็น array ของ objects
  return data.slice(1).map((row) => ({
    email: row[emailIndex] || '',
    name: row[nameIndex] || '',
    role: row[roleIndex] || 'User',
    status: row[statusIndex] || 'Pending', // ใช้ค่าเริ่มต้นเป็น Pending
    registerDate: row[registerDateIndex] ? new Date(row[registerDateIndex]).toISOString() : new Date().toISOString(),
    approvalDate: row[approvalDateIndex] ? new Date(row[approvalDateIndex]).toISOString() : null,
    rejectionReason: row[rejectionReasonIndex] || '',
  }));
}

// เพิ่มฟังก์ชันสำหรับการเพิ่มผู้ใช้ใหม่
function addUser(userData) {
  try {
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!userData.email || !userData.password || !userData.name) {
      return { success: false, message: 'ข้อมูลผู้ใช้ไม่ครบถ้วน' };
    }

    // ตรวจสอบรูปแบบอีเมล
    if (!isValidEmail(userData.email)) {
      return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' };
    }

    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    // ตรวจสอบอีเมลซ้ำ (case-insensitive)
    const existingUser = data.slice(1).find((row) => row[emailIndex].toString().toLowerCase() === userData.email.toLowerCase());

    if (existingUser) {
      return {
        success: false,
        message: 'อีเมลนี้มีอยู่ในระบบแล้ว',
        isDuplicate: true,
      };
    }

    // ตรวจสอบว่าเป็นการเพิ่มโดย admin หรือไม่
    const activeUser = Session.getActiveUser().getEmail();
    const isAdminCreating = isAdmin(activeUser);

    // สร้างข้อมูลแถวใหม่
    const newRow = headers.map((header) => {
      switch (header) {
        case 'Email':
          return userData.email;
        case 'Password':
          return userData.password;
        case 'Name':
          return userData.name;
        case 'Role':
          return userData.role || 'User';
        case 'Status':
          return isAdminCreating ? 'Approved' : 'Pending'; // อนุมัติทันทีถ้าเพิ่มโดย admin
        case 'RegisterDate':
          return new Date();
        case 'ApprovalDate':
          return isAdminCreating ? new Date() : ''; // บันทึกวันที่อนุมัติด้วยถ้าเพิ่มโดย admin
        case 'ApprovedBy':
          return isAdminCreating ? activeUser : ''; // บันทึกผู้อนุมัติ
        default:
          return '';
      }
    });

    // เพิ่มข้อมูลในชีท
    sheet.appendRow(newRow);

    // บันทึก log
    logUserActivity(userData.email, 'ADD_USER', {
      name: userData.name,
      role: userData.role,
      addedBy: activeUser,
      autoApproved: isAdminCreating,
    });

    // ส่งอีเมลแจ้งเตือนตามสถานะ
    if (isAdminCreating) {
      sendApprovalNotification(userData); // ส่งอีเมลแจ้งการอนุมัติทันที
    } else {
      notifyAdminNewUser(userData); // แจ้งเตือน admin เพื่อรออนุมัติ
    }

    return {
      success: true,
      message: isAdminCreating ? 'เพิ่มและอนุมัติผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ รอการอนุมัติ',
      autoApproved: isAdminCreating,
    };
  } catch (error) {
    console.error('Error in addUser:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้: ' + error.message,
    };
  }
}

// ฟังก์ชันส่งอีเมลแจ้งการอนุมัติ
function sendApprovalNotification(userData) {
  try {
    const subject = 'บัญชีของคุณได้รับการอนุมัติแล้ว';
    const body = `เรียน ${userData.name}

บัญชีของคุณได้รับการอนุมัติแล้ว คุณสามารถเข้าสู่ระบบได้ทันทีโดยใช้:

อีเมล: ${userData.email}
รหัสผ่าน: (รหัสผ่านที่กำหนดไว้)

กรุณาเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

    MailApp.sendEmail(userData.email, subject, body);

    // บันทึก log การส่งอีเมล
    logEmailNotification({
      type: 'APPROVAL_NOTIFICATION',
      recipient: userData.email,
      status: 'SUCCESS',
    });
  } catch (error) {
    console.error('Error sending approval notification:', error);
    logEmailNotification({
      type: 'APPROVAL_NOTIFICATION',
      recipient: userData.email,
      status: 'FAILED',
      error: error.message,
    });
  }
}

// ฟังก์ชันตรวจสอบว่าเป็น admin หรือไม่
function isAdmin(email) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');
    const roleIndex = headers.indexOf('Role');
    const statusIndex = headers.indexOf('Status');

    const user = data.slice(1).find((row) => row[emailIndex].toString().toLowerCase() === email.toLowerCase() && row[statusIndex] === 'Approved');

    return user && user[roleIndex] === 'Admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// UserManagement.gs - เพิ่มฟังก์ชันสำหรับการอนุมัติผู้ใช้

function approveUser(email) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const statusIndex = headers.indexOf('Status');
    const approvalDateIndex = headers.indexOf('ApprovalDate');
    const nameIndex = headers.indexOf('Name');

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // อัพเดตสถานะเป็น Approved
        sheet.getRange(i + 1, statusIndex + 1).setValue('Approved');
        // บันทึกวันที่อนุมัติ
        sheet.getRange(i + 1, approvalDateIndex + 1).setValue(new Date());

        // ส่งอีเมลแจ้งเตือนผู้ใช้
        sendApprovalEmail(email, data[i][nameIndex]);

        return {
          success: true,
          message: 'อนุมัติผู้ใช้สำเร็จ',
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบผู้ใช้ในระบบ',
    };
  } catch (error) {
    console.error('Error in approveUser:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอนุมัติ: ' + error.message,
    };
  }
}

function sendApprovalEmail(email, name) {
  try {
    const subject = 'บัญชีของคุณได้รับการอนุมัติแล้ว';
    const body = `เรียน ${name}

บัญชีของคุณได้รับการอนุมัติแล้ว คุณสามารถเข้าสู่ระบบได้ทันที
โดยใช้อีเมลและรหัสผ่านที่คุณลงทะเบียนไว้

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

    MailApp.sendEmail(email, subject, body);

    // บันทึก log การส่งอีเมล
    logEmailNotification({
      type: 'APPROVAL_NOTIFICATION',
      recipient: email,
      subject: subject,
      status: 'SUCCESS',
    });
  } catch (error) {
    console.error('Error sending approval email:', error);
    logEmailNotification({
      type: 'APPROVAL_NOTIFICATION',
      recipient: email,
      subject: subject,
      status: 'FAILED',
      error: error.message,
    });
  }
}

function resetUserPassword(email) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password');
    const nameIndex = headers.indexOf('Name');

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // สร้างรหัสผ่านใหม่
        const newPassword = generateRandomPassword();

        // บันทึกรหัสผ่านใหม่
        sheet.getRange(i + 1, passwordIndex + 1).setValue(newPassword);

        // ส่งอีเมลแจ้งรหัสผ่านใหม่
        sendPasswordResetEmail(email, data[i][nameIndex], newPassword);

        return {
          success: true,
          message: 'รีเซ็ตรหัสผ่านสำเร็จ',
          newPassword: newPassword,
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบผู้ใช้ในระบบ',
    };
  } catch (error) {
    console.error('Error in resetUserPassword:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน: ' + error.message,
    };
  }
}

function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function sendPasswordResetEmail(email, name, newPassword) {
  try {
    const subject = 'รหัสผ่านใหม่ของคุณ';
    const body = `เรียน ${name}

รหัสผ่านของคุณได้ถูกรีเซ็ตแล้ว
รหัสผ่านใหม่ของคุณคือ: ${newPassword}

กรุณาเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก

หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบทันที

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

    MailApp.sendEmail(email, subject, body);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
}

function rejectUser(email, reason) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const nameIndex = headers.indexOf('Name');
    const statusIndex = headers.indexOf('Status');
    const rejectionReasonIndex = headers.indexOf('RejectionReason');
    const approvalDateIndex = headers.indexOf('ApprovalDate');

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // อัพเดตสถานะและเหตุผล
        sheet.getRange(i + 1, statusIndex + 1).setValue('Rejected');
        sheet.getRange(i + 1, rejectionReasonIndex + 1).setValue(reason);

        // เคลียร์วันที่อนุมัติ (ถ้ามี)
        if (approvalDateIndex !== -1) {
          sheet.getRange(i + 1, approvalDateIndex + 1).setValue('');
        }

        // ส่งอีเมลแจ้งเตือน
        sendRejectionEmail(email, data[i][nameIndex], reason);

        // บันทึกประวัติการดำเนินการ
        logUserActivity(email, 'REJECT', {
          reason: reason,
          rejectedBy: Session.getActiveUser().getEmail(),
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'ปฏิเสธผู้ใช้เรียบร้อยแล้ว',
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบผู้ใช้ในระบบ',
    };
  } catch (error) {
    console.error('Error in rejectUser:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการปฏิเสธผู้ใช้: ' + error.message,
    };
  }
}

function sendRejectionEmail(email, name, reason) {
  try {
    const subject = 'ผลการพิจารณาการลงทะเบียน';
    const body = `เรียน ${name}

ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติด้วยเหตุผลต่อไปนี้:
${reason}

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

    MailApp.sendEmail(email, subject, body);

    // บันทึก log การส่งอีเมล
    logEmailNotification({
      type: 'REJECTION_NOTIFICATION',
      recipient: email,
      subject: subject,
      status: 'SUCCESS',
      reason: reason,
    });
  } catch (error) {
    console.error('Error sending rejection email:', error);
    logEmailNotification({
      type: 'REJECTION_NOTIFICATION',
      recipient: email,
      subject: subject,
      status: 'FAILED',
      error: error.message,
    });
  }
}

function logUserActivity(email, action, details) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('UserLogs');
    if (!sheet) {
      // สร้างชีตใหม่ถ้ายังไม่มี
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const newSheet = ss.insertSheet('UserLogs');
      // สร้างหัวตาราง
      newSheet.getRange('A1:E1').setValues([['Timestamp', 'Email', 'Action', 'PerformedBy', 'Details']]);
      return logUserActivity(email, action, details); // เรียกฟังก์ชันตัวเองอีกครั้ง
    }

    const timestamp = new Date();
    const performedBy = Session.getActiveUser().getEmail();

    sheet.appendRow([timestamp, email, action, performedBy, JSON.stringify(details)]);

    return { success: true };
  } catch (error) {
    console.error('Error in logUserActivity:', error);
    throw new Error('ไม่สามารถบันทึกประวัติการดำเนินการได้: ' + error.message);
  }
}

function registerUser(userData) {
  try {
    console.log('Starting user registration:', userData.email);

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!userData.email || !userData.password || !userData.name) {
      return {
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      };
    }

    // ตรวจสอบรูปแบบอีเมล
    if (!isValidEmail(userData.email)) {
      return {
        success: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง',
      };
    }

    // เปิด Sheet
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // หา index ของคอลัมน์ที่จำเป็น
    const columnIndexes = {
      email: headers.indexOf('Email'),
      name: headers.indexOf('Name'),
      password: headers.indexOf('Password'),
      role: headers.indexOf('Role'),
      status: headers.indexOf('Status'),
      registerDate: headers.indexOf('RegisterDate'),
    };

    // ตรวจสอบโครงสร้างชีท
    if (Object.values(columnIndexes).includes(-1)) {
      console.error('Invalid sheet structure. Column indexes:', columnIndexes);
      return {
        success: false,
        message: 'โครงสร้างชีทไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ',
      };
    }

    // ตรวจสอบอีเมลซ้ำ
    for (let i = 1; i < data.length; i++) {
      if (data[i][columnIndexes.email].toLowerCase() === userData.email.toLowerCase()) {
        return {
          success: false,
          message: 'อีเมลนี้ถูกใช้งานแล้ว',
        };
      }
    }

    // สร้างข้อมูลแถวใหม่
    const newRow = headers.map((header) => {
      switch (header) {
        case 'Email':
          return userData.email;
        case 'Name':
          return userData.name;
        case 'Password':
          return userData.password;
        case 'Role':
          return 'User'; // กำหนดค่าเริ่มต้นเป็น User
        case 'Status':
          return 'Pending'; // กำหนดค่าเริ่มต้นเป็น Pending
        case 'RegisterDate':
          return new Date();
        default:
          return '';
      }
    });

    // เพิ่มข้อมูลในชีท
    sheet.appendRow(newRow);

    // ส่งอีเมลแจ้งเตือนแอดมิน
    notifyAdminNewRegistration(userData);

    // บันทึก log
    logUserActivity(userData.email, 'REGISTER', {
      name: userData.name,
      timestamp: new Date().toISOString(),
    });

    console.log('User registration successful:', userData.email);

    return {
      success: true,
      message: 'ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากผู้ดูแลระบบ',
    };
  } catch (error) {
    console.error('Error in registerUser:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลงทะเบียน: ' + error.message,
    };
  }
}

function notifyAdminNewRegistration(userData) {
  try {
    // ดึงรายชื่ออีเมลของแอดมินทั้งหมด
    const adminEmails = getAdminEmails();

    if (adminEmails.length > 0) {
      const subject = 'มีการลงทะเบียนผู้ใช้ใหม่';
      const body = `
        มีผู้ใช้ใหม่ลงทะเบียนในระบบ:
        
        อีเมล: ${userData.email}
        ชื่อ: ${userData.name}
        วันที่ลงทะเบียน: ${new Date().toLocaleString('th-TH')}
        
        กรุณาเข้าสู่ระบบเพื่อดำเนินการอนุมัติ
      `;

      adminEmails.forEach((adminEmail) => {
        try {
          MailApp.sendEmail(adminEmail, subject, body);
          console.log('Sent notification to admin:', adminEmail);
        } catch (e) {
          console.error('Error sending notification to admin:', adminEmail, e);
        }
      });
    } else {
      console.warn('No admin users found for notification');
    }
  } catch (error) {
    console.error('Error in notifyAdminNewRegistration:', error);
  }
}

function getAdminEmails() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const roleIndex = headers.indexOf('Role');
    const statusIndex = headers.indexOf('Status');

    return data
      .slice(1)
      .filter((row) => row[roleIndex] === 'Admin' && row[statusIndex] === 'Approved')
      .map((row) => row[emailIndex]);
  } catch (error) {
    console.error('Error getting admin emails:', error);
    return [];
  }
}

// Utility function for email validation
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * ฟังก์ชันหลักสำหรับรีเซ็ตรหัสผ่าน
 * @param {string} email - อีเมลของผู้ใช้ที่ต้องการรีเซ็ตรหัสผ่าน
 * @returns {Object} ผลลัพธ์การทำงาน
 */
function resetPasswordByEmail(email) {
  const lock = LockService.getScriptLock();

  try {
    // 1. Input validation
    if (!isValidInput(email)) {
      return createResponse(false, 'กรุณาระบุอีเมลที่ถูกต้อง');
    }

    // 2. Acquire lock
    if (!lock.tryLock(CONFIG.COOLDOWN.LOCK_TIMEOUT)) {
      return createResponse(false, 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
    }

    // 3. Check cooldown period
    const cooldownCheck = checkPasswordResetCooldown(email);
    if (!cooldownCheck.canReset) {
      return createResponse(false, `ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณารอ ${cooldownCheck.remainingMinutes} นาทีก่อนลองใหม่อีกครั้ง`);
    }

    // 4. Find and validate user
    const userInfo = findUserByEmail(email);
    if (!userInfo.found) {
      return createResponse(false, 'ไม่พบอีเมลในระบบหรือบัญชียังไม่ได้รับการอนุมัติ');
    }

    // 5. Generate and set new password
    const newPassword = generateSecurePassword();
    if (!updateUserPassword(userInfo.rowIndex, newPassword)) {
      throw new Error('ไม่สามารถอัปเดตรหัสผ่านได้');
    }

    // 6. Log and notify
    const resetResult = handlePasswordResetCompletion({
      email: email,
      name: userInfo.name,
      newPassword: newPassword,
    });

    if (!resetResult.success) {
      throw new Error(resetResult.message);
    }

    return createResponse(true, 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาตรวจสอบอีเมลของคุณ');
  } catch (error) {
    console.error('Error in resetPasswordByEmail:', error);
    logPasswordReset({
      email: email,
      status: CONFIG.STATUS.FAILED,
      error: error.message,
    });
    return createResponse(false, 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลนำเข้า
 */
function isValidInput(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * ตรวจสอบระยะเวลา cooldown
 */
function checkPasswordResetCooldown(email) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PASSWORD_RESET_LOGS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Get column indexes
    const columnIndexes = {
      timestamp: headers.indexOf(CONFIG.COLUMNS.LOGS.TIMESTAMP),
      email: headers.indexOf(CONFIG.COLUMNS.LOGS.EMAIL),
      status: headers.indexOf(CONFIG.COLUMNS.LOGS.STATUS),
    };

    // Validate sheet structure
    if (Object.values(columnIndexes).includes(-1)) {
      throw new Error('โครงสร้าง sheet ไม่ถูกต้อง');
    }

    const now = new Date();
    const recentResets = data.slice(1).filter((row) => {
      const rowEmail = row[columnIndexes.email].toString().toLowerCase();
      const rowStatus = row[columnIndexes.status];
      const resetTime = new Date(row[columnIndexes.timestamp]);
      const minutesAgo = (now - resetTime) / (1000 * 60);

      return rowEmail === email.toLowerCase() && rowStatus === CONFIG.STATUS.SUCCESS && minutesAgo < CONFIG.COOLDOWN.MINUTES;
    });

    if (recentResets.length > 0) {
      const lastReset = new Date(recentResets[0][columnIndexes.timestamp]);
      const remainingMinutes = Math.ceil(CONFIG.COOLDOWN.MINUTES - (now - lastReset) / (1000 * 60));

      return {
        canReset: false,
        remainingMinutes: remainingMinutes,
      };
    }

    return { canReset: true };
  } catch (error) {
    console.error('Error in checkPasswordResetCooldown:', error);
    throw error;
  }
}

/**
 * ค้นหาข้อมูลผู้ใช้จากอีเมล
 */
function findUserByEmail(email) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const columnIndexes = {
    email: headers.indexOf(CONFIG.COLUMNS.USERS.EMAIL),
    name: headers.indexOf(CONFIG.COLUMNS.USERS.NAME),
    status: headers.indexOf(CONFIG.COLUMNS.USERS.STATUS),
  };

  if (Object.values(columnIndexes).includes(-1)) {
    throw new Error('โครงสร้าง sheet ผู้ใช้ไม่ถูกต้อง');
  }

  const userRowIndex = data.findIndex((row, index) => {
    return (
      index > 0 &&
      row[columnIndexes.email].toString().toLowerCase() === email.toLowerCase() &&
      [CONFIG.STATUS.SUCCESS, CONFIG.STATUS.APPROVED].includes(row[columnIndexes.status])
    );
  });

  if (userRowIndex === -1) {
    return { found: false };
  }

  return {
    found: true,
    rowIndex: userRowIndex + 1,
    name: data[userRowIndex][columnIndexes.name],
  };
}

/**
 * อัปเดตรหัสผ่านของผู้ใช้
 */
function updateUserPassword(rowIndex, newPassword) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const passwordColumn = headers.indexOf(CONFIG.COLUMNS.USERS.PASSWORD) + 1;

    if (passwordColumn === 0) {
      throw new Error('ไม่พบคอลัมน์รหัสผ่าน');
    }

    sheet.getRange(rowIndex, passwordColumn).setValue(newPassword);
    return true;
  } catch (error) {
    console.error('Error updating password:', error);
    return false;
  }
}

/**
 * จัดการการรีเซ็ตรหัสผ่านเมื่อสำเร็จ
 */
function handlePasswordResetCompletion(userData) {
  try {
    // บันทึกประวัติ
    logPasswordReset({
      email: userData.email,
      name: userData.name,
      status: CONFIG.STATUS.SUCCESS,
    });

    // ส่งอีเมล
    sendPasswordResetEmail(userData.email, userData.name, userData.newPassword);

    return createResponse(true, 'ดำเนินการสำเร็จ');
  } catch (error) {
    console.error('Error in completion handling:', error);
    return createResponse(false, error.message);
  }
}

/**
 * บันทึกประวัติการรีเซ็ตรหัสผ่าน
 */
function logPasswordReset(logData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PASSWORD_RESET_LOGS);
    const timestamp = new Date();

    const logRow = [timestamp, logData.email, logData.name || '', logData.status, logData.error || ''];

    sheet.insertRows(2, 1);
    sheet.getRange(2, 1, 1, logRow.length).setValues([logRow]);
  } catch (error) {
    console.error('Error logging password reset:', error);
    throw error;
  }
}

/**
 * สร้างรหัสผ่านใหม่ที่ปลอดภัย
 */
function generateSecurePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

/**
 * Utility function สำหรับสร้าง response object
 */
function createResponse(success, message) {
  return { success, message };
}

/**
 * Utility function สำหรับเรียกใช้ sheet
 */
function getSheet(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

function approveMultipleUsers(emails) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      throw new Error('ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    }

    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const statusIndex = headers.indexOf('Status');
    const approvalDateIndex = headers.indexOf('ApprovalDate');
    const nameIndex = headers.indexOf('Name');

    let approvedCount = 0;
    const errors = [];

    emails.forEach((email) => {
      try {
        for (let i = 1; i < data.length; i++) {
          if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
            if (data[i][statusIndex] === 'Pending') {
              // อัพเดตสถานะเป็น Approved
              sheet.getRange(i + 1, statusIndex + 1).setValue('Approved');
              // บันทึกวันที่อนุมัติ
              sheet.getRange(i + 1, approvalDateIndex + 1).setValue(new Date());

              // ส่งอีเมลแจ้งเตือน
              sendApprovalEmail(email, data[i][nameIndex]);

              // บันทึก log
              logUserActivity(email, 'BULK_APPROVE', {
                approvedBy: Session.getActiveUser().getEmail(),
                timestamp: new Date().toISOString(),
              });

              approvedCount++;
            }
            break;
          }
        }
      } catch (error) {
        errors.push(`${email}: ${error.message}`);
      }
    });

    // สรุปผลการทำงาน
    return {
      success: true,
      message: `อนุมัติผู้ใช้สำเร็จ ${approvedCount} คน${errors.length > 0 ? ` มีข้อผิดพลาด ${errors.length} รายการ` : ''}`,
      approvedCount: approvedCount,
      errors: errors,
    };
  } catch (error) {
    console.error('Error in approveMultipleUsers:', error);
    throw new Error('เกิดข้อผิดพลาดในการอนุมัติผู้ใช้: ' + error.message);
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

// เพิ่มฟังก์ชันส่งอีเมลแบบ batch
function sendBulkApprovalEmails(approvedUsers) {
  const emailQuota = MailApp.getRemainingDailyQuota();
  if (emailQuota < approvedUsers.length) {
    throw new Error(`โควต้าการส่งอีเมลไม่เพียงพอ (เหลือ ${emailQuota} สามารถส่งได้ ${approvedUsers.length})`);
  }

  approvedUsers.forEach((user) => {
    try {
      const subject = 'บัญชีของคุณได้รับการอนุมัติแล้ว';
      const body = `เรียน ${user.name}

บัญชีของคุณได้รับการอนุมัติแล้ว คุณสามารถเข้าสู่ระบบได้ทันที
โดยใช้อีเมลและรหัสผ่านที่คุณลงทะเบียนไว้

หากมีข้อสงสัยประการใด กรุณาติดต่อผู้ดูแลระบบ

ขอแสดงความนับถือ
ทีมงานระบบบันทึกข้อมูลครู`;

      MailApp.sendEmail(user.email, subject, body);

      // บันทึก log การส่งอีเมล
      logEmailNotification({
        type: 'BULK_APPROVAL_NOTIFICATION',
        recipient: user.email,
        subject: subject,
        status: 'SUCCESS',
      });
    } catch (error) {
      console.error(`Error sending email to ${user.email}:`, error);
      logEmailNotification({
        type: 'BULK_APPROVAL_NOTIFICATION',
        recipient: user.email,
        subject: subject,
        status: 'FAILED',
        error: error.message,
      });
    }
  });
}

// UserManagement.gs
function updateUserEmail(newEmail, currentPassword) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password');

    // ตรวจสอบว่ามีอีเมลนี้อยู่แล้วหรือไม่
    const emailExists = data.slice(1).some((row) => row[emailIndex].toLowerCase() === newEmail.toLowerCase());

    if (emailExists) {
      return {
        success: false,
        message: 'อีเมลนี้มีผู้ใช้งานแล้ว',
      };
    }

    const session = Session.getActiveUser().getEmail();
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === session.toLowerCase()) {
        // ตรวจสอบรหัสผ่าน
        if (data[i][passwordIndex] !== currentPassword) {
          return {
            success: false,
            message: 'รหัสผ่านไม่ถูกต้อง',
          };
        }

        // อัพเดตอีเมล
        sheet.getRange(i + 1, emailIndex + 1).setValue(newEmail);

        // บันทึกประวัติ
        logUserActivity(session, 'UPDATE_EMAIL', {
          oldEmail: session,
          newEmail: newEmail,
        });

        return {
          success: true,
          message: 'อัพเดตอีเมลสำเร็จ กรุณาเข้าสู่ระบบใหม่',
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบข้อมูลผู้ใช้',
    };
  } catch (error) {
    console.error('Error updating email:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดตอีเมล: ' + error.message,
    };
  }
}
// UserManagement.gs

function updateUserEmail(data) {
  try {
    const sheet = getSheet(USERS_SHEET_NAME);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];

    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password');

    // ตรวจสอบว่ามีอีเมลนี้อยู่แล้วหรือไม่
    const emailExists = values.slice(1).some((row) => row[emailIndex].toString().toLowerCase() === data.newEmail.toLowerCase());

    if (emailExists) {
      return {
        success: false,
        message: 'อีเมลนี้มีผู้ใช้งานแล้ว',
      };
    }

    // หาและอัพเดตข้อมูลผู้ใช้
    for (let i = 1; i < values.length; i++) {
      if (values[i][emailIndex].toString().toLowerCase() === data.currentEmail.toLowerCase()) {
        // ตรวจสอบรหัสผ่าน
        if (values[i][passwordIndex] !== data.currentPassword) {
          return {
            success: false,
            message: 'รหัสผ่านไม่ถูกต้อง',
          };
        }

        // อัพเดตอีเมล
        sheet.getRange(i + 1, emailIndex + 1).setValue(data.newEmail);

        // บันทึก log
        logUserActivity(data.currentEmail, 'UPDATE_EMAIL', {
          oldEmail: data.currentEmail,
          newEmail: data.newEmail,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'อัพเดตอีเมลสำเร็จ',
          newEmail: data.newEmail,
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบข้อมูลผู้ใช้',
    };
  } catch (error) {
    console.error('Error updating email:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดตอีเมล: ' + error.message,
    };
  }
}

function validatePassword(email, password) {
  try {
    // ตรวจสอบ input
    if (!email || !password) {
      return {
        success: false,
        message: 'กรุณาระบุอีเมลและรหัสผ่าน',
      };
    }

    // ดึงข้อมูลผู้ใช้จาก Sheet
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // หา index ของคอลัมน์ที่ต้องการ
    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password');
    const statusIndex = headers.indexOf('Status');

    if (emailIndex === -1 || passwordIndex === -1 || statusIndex === -1) {
      throw new Error('โครงสร้างชีทไม่ถูกต้อง');
    }

    // ค้นหาผู้ใช้
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        // ตรวจสอบสถานะบัญชี
        if (data[i][statusIndex] !== 'Approved') {
          return {
            success: false,
            message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติหรือถูกระงับ',
          };
        }

        // ตรวจสอบรหัสผ่าน
        if (data[i][passwordIndex] === password) {
          return {
            success: true,
            message: 'รหัสผ่านถูกต้อง',
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
    console.error('Error in validatePassword:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน: ' + error.message,
    };
  }
}

function updateUserEmail(formData) {
  try {
    // ตรวจสอบความถูกต้องของข้อมูล
    if (!formData.currentEmail || !formData.newEmail || !formData.password) {
      return {
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      };
    }

    // ตรวจสอบรหัสผ่านก่อน
    const passwordCheck = validatePassword(formData.currentEmail, formData.password);
    if (!passwordCheck.success) {
      return passwordCheck;
    }

    // ตรวจสอบว่าอีเมลใหม่ซ้ำกับที่มีอยู่หรือไม่
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    // ตรวจสอบอีเมลซ้ำ
    const duplicateEmail = data
      .slice(1)
      .some(
        (row) =>
          row[emailIndex].toLowerCase() === formData.newEmail.toLowerCase() && row[emailIndex].toLowerCase() !== formData.currentEmail.toLowerCase()
      );

    if (duplicateEmail) {
      return {
        success: false,
        message: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว',
      };
    }

    // อัพเดตอีเมล
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex].toLowerCase() === formData.currentEmail.toLowerCase()) {
        sheet.getRange(i + 1, emailIndex + 1).setValue(formData.newEmail);

        // บันทึก log
        logUserActivity(formData.currentEmail, 'UPDATE_EMAIL', {
          oldEmail: formData.currentEmail,
          newEmail: formData.newEmail,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'อัพเดตอีเมลสำเร็จ',
          newEmail: formData.newEmail,
        };
      }
    }

    return {
      success: false,
      message: 'ไม่พบบัญชีผู้ใช้ในระบบ',
    };
  } catch (error) {
    console.error('Error in updateUserEmail:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดตอีเมล: ' + error.message,
    };
  }
}

function getUserActivityLog(email) {
  try {
    // ดึงข้อมูลจาก Sheet
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('UserLogs');
    if (!sheet) {
      throw new Error('ไม่พบชีตบันทึกประวัติ');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // ดึงข้อมูลที่เกี่ยวข้องกับผู้ใช้
    const logs = data
      .slice(1)
      .filter((row) => row[1] === email) // สมมติว่าคอลัมน์ที่ 2 เป็น email
      .map((row) => ({
        timestamp: row[0], // วันที่-เวลา
        action: row[2], // การดำเนินการ
        performedBy: row[3], // ผู้ดำเนินการ
        details: row[4], // รายละเอียด
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // เรียงจากใหม่ไปเก่า

    return logs;
  } catch (error) {
    console.error('Error in getUserActivityLog:', error);
    throw new Error('ไม่สามารถดึงประวัติการดำเนินการได้: ' + error.message);
  }
}

function cleanupOldLogs(days = 90) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('UserLogs');
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // หาแถวที่เก่าเกินกำหนด
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      const logDate = new Date(data[i][0]);
      if (logDate < cutoffDate) {
        rowsToDelete.push(i + 1);
      }
    }

    // ลบแถวจากด้านล่างขึ้นบน
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
    }
  } catch (error) {
    console.error('Error in cleanupOldLogs:', error);
    throw new Error('ไม่สามารถล้างประวัติการดำเนินการได้: ' + error.message);
  }
}
