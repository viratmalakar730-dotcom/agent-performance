let globalData = [];

function toSeconds(time) {
if (!time) return 0;
let parts = time.split(":").map(Number);
return parts[0]*3600 + parts[1]*60 + parts[2];
}

function toTime(sec) {
let h = Math.floor(sec/3600);
let m = Math.floor((sec%3600)/60);
let s = sec%60;
return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

function handleFile(e) {
const file = e.target.files[0];
const reader = new FileReader();

reader.onload = function(e) {
const data = new Uint8Array(e.target.result);
const workbook = XLSX.read(data, { type: "array" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
globalData = XLSX.utils.sheet_to_json(sheet);

localStorage.setItem("excelData", JSON.stringify(globalData));
window.location.href = "dashboard.html";
};

reader.readAsArrayBuffer(file);
}

document.addEventListener("DOMContentLoaded", () => {
const fileInput = document.getElementById("fileInput");
if (fileInput) fileInput.addEventListener("change", handleFile);

const table = document.querySelector("#dataTable tbody");
if (!table) return;

const data = JSON.parse(localStorage.getItem("excelData") || "[]");

data.forEach(row => {

let login = toSeconds(row["Total Login Time"]);
let lunch = toSeconds(row["LUNCHBREAK"]);
let tea = toSeconds(row["TEABREAK"]);
let shortb = toSeconds(row["SHORTBREAK"]);
let meeting = toSeconds(row["MEETING"]);
let system = toSeconds(row["SYSTEMDOWN"]);

let totalBreak = lunch + tea + shortb;
let netLogin = login - totalBreak;
let totalMeeting = meeting + system;

const tr = document.createElement("tr");

tr.innerHTML = `
<td>${row["Agent Name"] || ""}</td>
<td>${row["Total Login Time"] || ""}</td>
<td>${toTime(totalBreak)}</td>
<td>${toTime(netLogin)}</td>
<td>${toTime(totalMeeting)}</td>
`;

table.appendChild(tr);
});
});
