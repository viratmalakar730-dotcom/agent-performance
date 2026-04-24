console.log("🔥 FINAL PRO SYSTEM");

// ================= FIREBASE =================
let db = null;

function initFirebase(){
    if(typeof firebase === "undefined"){
        console.error("❌ Firebase not loaded");
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
        projectId: "agent-performance-live"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

function waitForFirebase(cb){
    let t = setInterval(()=>{
        if(typeof firebase !== "undefined"){
            clearInterval(t);
            cb();
        }
    },100);
}

waitForFirebase(initFirebase);

// ================= HELPERS =================
const $ = id => document.getElementById(id);

function safeStr(v){ return (v ?? "").toString().trim(); }

function timeToSeconds(t){
    if(!t || t === "-") return 0;
    if(typeof t === "number") return Math.floor(t*86400);
    let [h,m,s=0] = String(t).split(":");
    return (+h*3600)+(+m*60)+(+s);
}

function secondsToTime(sec){
    sec = Math.max(0, Math.floor(sec));
    let h = String(Math.floor(sec/3600)).padStart(2,'0');
    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s = String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
}

// ================= SEARCH =================
function searchTable(){
    let v = $("search")?.value.toLowerCase() || "";
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display = r.innerText.toLowerCase().includes(v) ? "" : "none";
    });
}

// ================= SOUND =================
let lastUpdateTime = "";

document.addEventListener("click",()=>{
    let s = $("notifySound");
    if(s){
        s.muted = false;
        s.play().then(()=>{ s.pause(); s.currentTime=0; }).catch(()=>{});
    }
});

function playSound(){
    let s = $("notifySound");
    if(s){
        s.currentTime = 0;
        s.volume = 1;
        s.play().catch(()=>{});
    }
}

// ================= ALERT =================
function showAlert(){
    let el = $("liveAlert");
    if(!el) return;

    el.style.display = "block";
    el.classList.add("blink");

    setTimeout(()=>{
        el.style.display = "none";
        el.classList.remove("blink");
    },3000);
}

// ================= NOTIFICATION =================
function requestNotification(){
    if("Notification" in window && Notification.permission !== "granted"){
        Notification.requestPermission();
    }
}

function showDesktopNotification(){
    if("Notification" in window && Notification.permission === "granted"){
        let n = new Notification("📊 Agent Performance Report Updated",{
            body:"New data available",
            icon:"https://cdn-icons-png.flaticon.com/512/1827/1827392.png"
        });

        n.onclick = ()=>{
            window.focus();
            window.location.href = "dashboard.html";
        };
    }
}

// ================= EXPORT =================
function exportExcel(){
    let table = $("table");
    if(!table) return;
    let wb = XLSX.utils.table_to_book(table, {sheet:"Report"});
    XLSX.writeFile(wb, "Dashboard.xlsx");
}

// ================= 📋 TABLE COPY =================
async function downloadPNG(){

    const table = document.getElementById("table");
    const container = document.querySelector(".table-container");

    const originalHeight = container.style.maxHeight;
    const originalOverflow = container.style.overflow;

    container.style.maxHeight = "none";
    container.style.overflow = "visible";

    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(table, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff"
    });

    container.style.maxHeight = originalHeight;
    container.style.overflow = originalOverflow;

    canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        alert("✅ Table copied");
    });
}

// ================= 📋 FULL PAGE COPY =================
async function copyFullPage(){

    const body = document.body;
    const html = document.documentElement;

    const originalOverflow = body.style.overflow;
    const originalHeight = body.style.height;

    body.style.overflow = "hidden";
    body.style.height = "auto";

    const fullWidth = html.scrollWidth;
    const fullHeight = html.scrollHeight;

    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(body, {
        scale: 3,
        useCORS: true,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight
    });

    body.style.overflow = originalOverflow;
    body.style.height = originalHeight;

    canvas.toBlob(async (blob)=>{
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        alert("✅ Full page copied");
    });
}

// ================= 📄 PDF =================
async function downloadPDF(){

    const body = document.body;
    const html = document.documentElement;

    const originalOverflow = body.style.overflow;
    const originalHeight = body.style.height;

    body.style.overflow = "hidden";
    body.style.height = "auto";

    const fullWidth = html.scrollWidth;
    const fullHeight = html.scrollHeight;

    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(body, {
        scale: 3,
        useCORS: true,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight
    });

    body.style.overflow = originalOverflow;
    body.style.height = originalHeight;

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    pdf.save("Dashboard-Full.pdf");
}

// ================= बाकी logic SAME =================
// (readExcel, processFiles, buildDashboard, buildSummary, loadDashboard, LIVE)

// ================= GLOBAL =================
window.processFiles = processFiles;
window.resetDashboard = resetDashboard;
window.searchTable = searchTable;
window.exportExcel = exportExcel;
window.downloadPNG = downloadPNG;
window.copyFullPage = copyFullPage;
window.downloadPDF = downloadPDF;
