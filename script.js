<!DOCTYPE html>
<html>
<head>
<title>Live Dashboard</title>
<link rel="stylesheet" href="style.css">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>

<!-- 🕐 BHOPAL ONLINE WORLD CLOCK -->
<div id="bhopalClock" class="bhopal-clock" aria-label="Bhopal online world clock">
    <div class="clock-topbar">
        <div class="clock-location">📍 Bhopal, Madhya Pradesh</div>
        <div class="clock-online"><span class="online-dot"></span> ONLINE</div>
    </div>

    <div class="clock-content">
        <div class="analog-clock" aria-hidden="true">
            <div class="clock-number n12">12</div>
            <div class="clock-number n1">1</div>
            <div class="clock-number n2">2</div>
            <div class="clock-number n3">3</div>
            <div class="clock-number n4">4</div>
            <div class="clock-number n5">5</div>
            <div class="clock-number n6">6</div>
            <div class="clock-number n7">7</div>
            <div class="clock-number n8">8</div>
            <div class="clock-number n9">9</div>
            <div class="clock-number n10">10</div>
            <div class="clock-number n11">11</div>
            <div class="clock-hand hour-hand" id="hourHand"></div>
            <div class="clock-hand minute-hand" id="minuteHand"></div>
            <div class="clock-hand second-hand" id="secondHand"></div>
            <div class="clock-center"></div>
        </div>

        <div class="digital-clock">
            <div class="clock-digital-row">
                <div id="bhopalDigitalTime">--:--:--</div>
                <div class="clock-ist-badge">🇮🇳 IST</div>
            </div>
            <div id="bhopalDate">Connecting to online time...</div>
            <div class="clock-divider"></div>
            <div class="clock-zone">📅 IN IST • Asia/Kolkata</div>
            <div id="clockSourceStatus" class="clock-source-status">Connecting to world time...</div>
        </div>
    </div>
</div>

<h2>📊 Agent Performance Dashboard</h2>

<div id="reportTime"></div>

<input type="text" id="search" placeholder="🔍 Search..." onkeyup="searchTable()">

<div id="cards"></div>

<div class="table-container">
<table id="table">
<thead>
<tr>
<th>S.No</th>
<th>Employee ID</th>
<th>Agent Full Name</th>
<th>Total Login</th>
<th>Net Login</th>
<th>Total Break</th>
<th>Total Meeting</th>
<th>AHT</th>
<th>Total Mature</th>
<th>IB Mature</th>
<th>OB Mature</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<div id="brandingLive"> Powered by Chandan Malakar </div>

<audio id="notifySound"></audio>

<div id="liveAlert">🚀 Agent Performance Report Updated</div>

<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>

<script src="script.js"></script>

</body>
</html>
