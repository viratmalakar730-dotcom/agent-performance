function readExcel(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json(sheet));
        };
        reader.readAsArrayBuffer(file);
    });
}

function toSeconds(time) {
    if (!time) return 0;
    let p = time.split(":").map(Number);
    return p[0]*3600 + p[1]*60 + p[2];
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
        alert("Upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display = "block";

    const apr = await readExcel(aprFile);
    const cdr = await readExcel(cdrFile);

    // 🔹 IVR HIT
    const ivrHit = cdr.filter(r => r["Skill"] === "INBOUND").length;

    let final = [];

    apr.forEach(agent => {

        let name = agent["Agent Name"];

        // match CDR
        let calls = cdr.filter(c => 
            c["Username"] === name &&
            (c["Disposition"] === "callmature" || c["Disposition"] === "transfer")
        );

        let totalCalls = calls.length;

        let ib = calls.filter(c => c["Campaign"]?.includes("IB")).length;
        let ob = calls.filter(c => c["Campaign"]?.includes("OB")).length;

        let totalTalk = calls.reduce((sum, c) => sum + toSeconds(c["Talk Duration"]), 0);

        let login = toSeconds(agent["Total Login Time"]);
        let breakTime = toSeconds(agent["LUNCHBREAK"]) + toSeconds(agent["TEABREAK"]) + toSeconds(agent["SHORTBREAK"]);
        let meeting = toSeconds(agent["MEETING"]) + toSeconds(agent["SYSTEMDOWN"]);

        let netLogin = login - breakTime;

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            name,
            totalCalls,
            ib,
            ob,
            netLogin,
            breakTime,
            meeting,
            aht
        });
    });

    // 🔹 Sorting
    final.sort((a, b) => b.totalCalls - a.totalCalls || b.netLogin - a.netLogin);

    localStorage.setItem("dashboardData", JSON.stringify({
        data: final,
        ivrHit: ivrHit
    }));

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
}
