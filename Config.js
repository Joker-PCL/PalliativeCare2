// =================
// Config.gs
// =================
const settings = getSettings();
const SHEET_ID = settings.SHEET_ID;
const USERS_SHEET_NAME = 'Users';
const LOGIN_LOGS_SHEET_NAME = 'LoginLogs';
const PROFILE_IMAGES_FOLDER_ID = settings.PROFILE_IMAGES_FOLDER_ID;
const LOGS_SHEET_NAME = 'Logs';

const PAGES = {
  EditUser: 'EditUser',
  profile: 'profile',
  index: 'index',
  newPage2: 'NewPage2',
  SupplySystem: 'SupplySystem',
  SupplyRequest: 'SupplyRequest',
  SupplyRequestStatus: 'SupplyRequestStatus', // เพิ่มบรรทัดนี้
  SupplyApproval: 'SupplyApproval', // เพิ่มบรรทัดนี้
};

const SUPPLY_STATUSES = {
  PENDING: 'รอดำเนินการ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  COMPLETED: 'เสร็จสิ้น',
};
