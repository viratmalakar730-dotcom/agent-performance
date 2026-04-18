// ===============================
// 🔥 SAFE FIREBASE INIT
// ===============================
let db = null;

try{
    const firebaseConfig = {
        apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
        projectId: "agent-performance-live"
    };

    if (typeof firebase !== "undefined") {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
    }
}catch(e){
    console.log("Firebase Disabled:", e);
}

// ===============================
// 🔥 SAVE CLOUD (SAFE)
// ===============================
function saveToCloud(payload){
    try{
        if(db){
            db.ref("dashboard").set(payload);
        }
    }catch(e){
        console.log("Cloud Error:", e);
    }
}

// ===============================
// 🔥 TIME
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

// ===============================
// 📂 READ EXCEL
// ===============================
function readExcel(file,skip){
    return new Promise((res,rej)=>{
        let r=new FileReader();

        r.onload=e=>{
            try{
                let wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
                let d=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
                res(d.slice(skip));
            }catch(err){
                console.error("Excel Read Error:", err);
                rej(err);
            }
        };

        r.onerror = err => {
            console.error("File Read Error:", err);
            rej(err);
        };

        r.readAsArrayBuffer(file);
    });
}

// ===============================
// 🔥 PROCESS FILES (DEBUG VERSION)
// ===============================
async function processFiles(){

    console.log("🔥 Button Clicked");

    try{

        let aprFile=document.getElementById("aprFile")?.files[0];
        let cdrFile=document.getElementById("cdrFile")?.files[0];

        if(!aprFile || !cdrFile){
            alert("Upload both files ❌");
            return;
        }

        document.getElementById("loading").style.display="block";

        console.log("📂 Reading APR...");
        let apr=await readExcel(aprFile,3);

        console.log("📂 Reading CDR...");
        let cdr=await readExcel(cdrFile,2);

        console.log("✅ Files Loaded");

        let final=[];
        let ivr=0;

        cdr.forEach(c=>{
            if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
        });

        apr.forEach(r=>{

            if(!r[1]) return;

            let emp=(r[1]||"").toString().trim();
            let name=r[2];

            let login=toSeconds(r[3]);

            let breakTime=
            toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);

            let meeting=
            toSeconds(r[20])+toSeconds(r[23]);

            let net=Math.max(0,login-breakTime);

            let calls=cdr.filter(c=>{
                return (c[1]||"").toString().trim()===emp &&
                ((c[25]||"").toLowerCase().includes("callmatured") ||
                 (c[25]||"").toLowerCase().includes("transfer"));
            });

            let total=calls.length;

            let ib=calls.filter(c=>
                (c[7]||"").toUpperCase().includes("INBOUND")
            ).length;

            let ob=total-ib;

            let aht=total?Math.round(toSeconds(r[5])/total):0;

            final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
        });

        console.log("📊 Data Prepared:", final.length);

        let payload = { final, ivr };

        sessionStorage.setItem("data", JSON.stringify(payload));

        saveToCloud(payload);

        console.log("🚀 Redirecting...");

        location="dashboard.html";

    }catch(e){
        console.error("❌ PROCESS ERROR:", e);
        alert("Error aaya — console check karo (F12)");
    }
}

// 🔥 FIX BUTTON
window.processFiles = processFiles;
