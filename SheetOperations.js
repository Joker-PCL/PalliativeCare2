// SheetOperations.gs
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

function getSheetDataAsJSON(sheetName) {
  const data = getSheetData(sheetName);
  return JSON.stringify(data);
}
