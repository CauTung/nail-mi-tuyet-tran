const { getStaffListDb, saveStaffListDb } = require("../services/dbService");

function getStaffList() {
  return getStaffListDb();
}

function updateStaffList(newList) {
  return saveStaffListDb(newList);
}

module.exports = {
  getStaffList,
  updateStaffList
};
