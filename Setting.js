// Setting.gs

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  const data = sheet.getDataRange().getValues();
  const settings = {};

  data.forEach((row) => {
    settings[row[0]] = row[1];
  });

  return settings;
}

function saveSettings(settings) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  sheet.clear();

  const data = Object.entries(settings).map(([key, value]) => [key, value]);

  sheet.getRange(1, 1, data.length, 2).setValues(data);
}
