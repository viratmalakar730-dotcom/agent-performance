let idleTimer;

// Welcome
setTimeout(() => {
    let w = document.getElementById("welcome");
    let m = document.getElementById("main");
    if (w && m) {
        w.style.display = "none";
        m.classList.remove("hidden");
    }
}, 2000);

// Auto reset
function resetTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(resetApp, 300000);
}
document.onmousemove = resetTimer;
document.onkeypress = resetTimer;

function toSeconds(time) {
    if (!time) return 0;
    let t = time.toString().split(":").map(Number);
    return (t[0]||0)*3600 + (t[1]||0)*60 + (t[2]||0);
}

function toTime(sec) {
    sec = Math.round(sec);
    let h = Math.floor(sec/3600);
    let m = Math.floor((sec%3600)/60);
    let s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

async function processFiles() {

    const apr = await readExcel(document.getElementById("aprFile").files[0], 3);
    const cdr = await readExcel(document.getElementById("cdrFile").files[0], 2);

    let final = [];
    let ivr = 0;

    cdr.forEach(c => {
        if ((c[7] || "").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(row => {

        let empID = row[1];
        let name = row[2];

        let login = toSeconds(row[3]);

        let breakTime = toSeconds(row[19]) + toSeconds(row[22]) + toSeconds(row[24]);
        let meeting = toSeconds(row[20]) + toSeconds(row[23]);

        let net = login - breakTime;

        let calls = cdr.filter(c => {
            let d = (c[25] || "").toLowerCase();
            return c[1] == empID &&
                   (d.includes("callmatured") || d.includes("transfer"));
        });

        let total = calls.length;

        let ib = calls.filter(c =>
            (c[7] || "").toUpperCase().includes("INBOUND")
        ).length;

        let ob = total - ib;

        let totalTalk = toSeconds(row[5]);
        let aht = total ? Math.round(totalTalk / total) : 0;

        final.push({empID,name,login,net,breakTime,meeting,aht,total,ib,ob});
    });

    sessionStorage.setItem("data", JSON.stringify({final, ivr}));
    window.location.href = "dashboard.html";
}

document.addEventListener("DOMContentLoaded", () => {

    let stored = JSON.parse(sessionStorage.getItem("data") || "{}");
    if (!stored.final) return;

    let {final, ivr} = stored;

    document.getElementById("ivr").innerText = ivr;

    let total=0, ib=0, ob=0, ahtSum=0;

    const table = document.querySelector("#table tbody");

    final.forEach(r => {

        total += r.total;
        ib += r.ib;
        ob += r.ob;
        ahtSum += r.aht;

        let netClass = r.net > 28800 ? "green3d" : "";
        let breakClass = r.breakTime > 2100 ? "red3d" : "";
        let meetingClass = r.meeting > 2100 ? "red3d" : "";

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${r.empID}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td class="${netClass}">${toTime(r.net)}</td>
        <td class="${breakClass}">${toTime(r.breakTime)}</td>
        <td class="${meetingClass}">${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td>${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        table.appendChild(tr);
    });

    document.getElementById("total").innerText = total;
    document.getElementById("ib").innerText = ib;
    document.getElementById("ob").innerText = ob;
    document.getElementById("aht").innerText = toTime(ahtSum / final.length);
});

function resetApp() {
    sessionStorage.clear();
    location.href = "index.html";
}

function copyImage() {
    let element = document.getElementById("table");

    html2canvas(element, { scale: 2 }).then(canvas => {
        canvas.toBlob(blob => {
            navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
            ]);
        });
    });
}

function readExcel(file, skip) {
    return new Promise(res => {
        let reader = new FileReader();
        reader.onload = e => {
            let wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
            let data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
            res(data.slice(skip));
        };
        reader.readAsArrayBuffer(file);
    });
}
