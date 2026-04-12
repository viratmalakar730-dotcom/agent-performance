// ===============================
// 🔥 FIREBASE CONFIG (NEW ADD)
// ===============================
const firebaseConfig = {
    apiKey: "YOUR_KEY",
    authDomain: "YOUR_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 🔥 SAVE CLOUD (NEW ADD)
async function saveToCloud(payload){
    try{
        await db.collection("dashboard").doc("latest").set(payload);
        console.log("✅ Live Updated");
    }catch(e){
        console.error("Firebase Error:", e);
    }
}

// ===============================
// 🔥 TIME FUNCTIONS
// ===============================
function toSeconds(t){
    if(!t) return 0;
    let a = t.toString().split(":").map(Number);
    return (a[0]||0)*3600 + (a[1]||0)*60 + (a[2]||0);
}

function toTime(sec){
    sec = Math.max(0, Math.round(sec));
    let h = Math.floor(sec/3600);
    let m = Math.floor((sec%3600)/60);
    let s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

function getGradientClass(val,max){
    let p = val/max;
    if(p >= 0.75) return "green";
    if(p >= 0.45) return "yellow";
    return "red";
}

// ===============================
// 🔥 REPORT TIME
// ===============================
function extractReportTime(aprRaw){
    let row = aprRaw[1]?.[0] || "";
    let match = row.match(/to\s([\d\-:\s]+)/i);
    if(!match) return "";

    let d = new Date(match[1].trim());

    let day = String(d.getDate()).padStart(2,'0');
    let month = d.toLocaleString('en-US',{month:'short'});
    let year = String(d.getFullYear()).slice(-2);

    let time = d.toLocaleTimeString('en-US',{hour12:true});

    return `${day}-${month}-${year} ${time}`;
}

// ===============================
// 📂 READ EXCEL
// ===============================
function readExcel(file, skipRows){
    return new Promise(resolve=>{
        let reader = new FileReader();
        reader.onload = e=>{
            let wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
            let data = XLSX.utils.sheet_to_json(
                wb.Sheets[wb.SheetNames[0]],
                {header:1}
            );
            resolve(data.slice(skipRows));
        };
        reader.readAsArrayBuffer(file);
    });
}

// ===============================
// 🔥 PROCESS FILES
// ===============================
async function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Please upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display = "block";

    let aprRaw = await readExcel(aprFile,0);
    let reportTime = extractReportTime(aprRaw);

    let apr = aprRaw.slice(3);
    let cdr = await readExcel(cdrFile,2);

    let final = [];
    let ivr = 0;

    // IVR HIT
    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    // MAIN CALCULATION
    apr.forEach(r=>{

        if(!r[1]) return;

        let emp = (r[1]||"").toString().trim();
        let name = r[2];

        let login = toSeconds(r[3]);

        let breakTime =
            toSeconds(r[19]) +
            toSeconds(r[22]) +
            toSeconds(r[24]);

        let meeting =
            toSeconds(r[20]) +
            toSeconds(r[23]);

        let net = Math.max(0, login - breakTime);

        let calls = cdr.filter(c=>{
            let empCDR = (c[1]||"").toString().trim();
            let disp = (c[25]||"").toLowerCase();

            return empCDR === emp &&
                (disp.includes("callmatured") || disp.includes("transfer"));
        });

        let total = calls.length;

        let ib = calls.filter(c =>
            (c[7]||"").toUpperCase().includes("INBOUND")
        ).length;

        let ob = total - ib;

        let aht = total ? Math.round(toSeconds(r[5]) / total) : 0;

        final.push({
            emp, name, login, net,
            breakTime, meeting,
            aht, total, ib, ob
        });
    });

    // ===============================
    // 🔥 SAVE DATA
    // ===============================
    let payload = { final, ivr, reportTime };

    sessionStorage.setItem("data", JSON.stringify(payload));

    // 🔥 LIVE SYNC ADD
    saveToCloud(payload);

    location = "dashboard.html";
}
