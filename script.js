function readExcel(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            resolve(json);
        };
        reader.readAsArrayBuffer(file);
    });
}

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

async function processFiles() {

    const aprFile = document.getElementById("aprFile").files[0];
    const cdrFile = document.getElementById("cdrFile").files[0];

    if (!aprFile || !cdrFile) {
        alert("Please upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display = "block";

    const aprData = await readExcel(aprFile);
    const cdrData = await readExcel(cdrFile);

    // 👉 Processing logic (basic merge example)
    let result = aprData.map(row => {

        let login = toSeconds(row["Total Login Time"]);
        let lunch = toSeconds(row["LUNCHBREAK"]);
        let tea = toSeconds(row["TEABREAK"]);
        let shortb = toSeconds(row["SHORTBREAK"]);
        let meeting = toSeconds(row["MEETING"]);
        let system = toSeconds(row["SYSTEMDOWN"]);

        let totalBreak = lunch + tea + shortb;
        let netLogin = login - totalBreak;
        let totalMeeting = meeting + system;

        return {
            "Agent Name": row["Agent Name"],
            "Total Login": row["Total Login Time"],
            "Total Break": toTime(totalBreak),
            "Net Login": toTime(netLogin),
            "Total Meeting": toTime(totalMeeting)
        };
    });

    localStorage.setItem("finalData", JSON.stringify(result));

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
}
