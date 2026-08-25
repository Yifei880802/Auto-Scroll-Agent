// popup.js - Auto Scroll Agent v4.7
(function() {
    'use strict';

    // ===== DOM =====
    const elSteps = document.querySelectorAll('.step');
    const elEmpty = document.getElementById('emptyMsg');
    const elList = document.getElementById('scrollList');
    const btnScan = document.getElementById('btnScan');
    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    const statusCard = document.getElementById('statusCard');
    const statusText = document.getElementById('statusText');
    const runTime = document.getElementById('runTime');
    const scrollPct = document.getElementById('scrollPct');
    const progressBar = document.getElementById('progressBar');
    const logBox = document.getElementById('logBox');

    // Settings
    const inputSpeed = document.getElementById('inputSpeed');
    const inputInterval = document.getElementById('inputInterval');
    const chkMouse = document.getElementById('chkMouse');
    const chkFocus = document.getElementById('chkFocus');

    let tabId = null;
    let selectedIndex = -1;
    let scanList = [];
    let startTime = null;
    let timerInterval = null;

    // ===== Settings persistence =====
    function loadSettings() {
        chrome.storage.local.get(['speed', 'interval', 'mouse', 'focus'], (r) => {
            if (r.speed) inputSpeed.value = r.speed;
            if (r.interval) inputInterval.value = r.interval;
            if (r.mouse !== undefined) chkMouse.checked = r.mouse;
            if (r.focus !== undefined) chkFocus.checked = r.focus;
        });
    }

    function saveSettings() {
        chrome.storage.local.set({
            speed: inputSpeed.value,
            interval: inputInterval.value,
            mouse: chkMouse.checked,
            focus: chkFocus.checked
        });
    }

    [inputSpeed, inputInterval].forEach(el => el.addEventListener('change', saveSettings));
    [chkMouse, chkFocus].forEach(el => el.addEventListener('change', saveSettings));

    loadSettings();

    // ===== Helpers =====
    function setStep(n) {
        elSteps.forEach((el, i) => {
            el.classList.toggle('active', i <= n);
        });
    }

    function addLog(text) {
        const t = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.textContent = `[${t}] ${text}`;
        logBox.prepend(line);
        while (logBox.children.length > 50) logBox.lastChild.remove();
    }

    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${h}:${m}:${sec}`;
    }

    function startTimer() {
        stopTimer();
        if (!startTime) startTime = Date.now();
        timerInterval = setInterval(() => {
            runTime.textContent = fmtTime(Date.now() - startTime);
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    }

    function send(msg, cb) {
        if (!tabId) { cb && cb(null); return; }
        chrome.tabs.sendMessage(tabId, msg, (resp) => {
            if (chrome.runtime.lastError) {
                addLog('Error: ' + chrome.runtime.lastError.message);
                cb && cb(null);
                return;
            }
            cb && cb(resp);
        });
    }

    // ===== Inject content script =====
    function injectScript(cb) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) { addLog('No active tab'); return; }
            tabId = tabs[0].id;

            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            }).then(() => {
                cb && cb();
            }).catch((e) => {
                addLog('Inject failed: ' + e.message);
            });
        });
    }

    // ===== Init: inject + 查询真实状态 =====
    injectScript(() => {
        // 先查 content.js 是否正在运行
        send({ action: 'getStatus' }, (resp) => {
            if (resp && resp.running) {
                // 正在运行 — 恢复 UI
                restoreRunningUI(resp.startTime);
            } else {
                // 未运行 — 自动扫描
                doScan();
            }
        });
    });

    // 恢复运行中 UI
    function restoreRunningUI(contentStartTime) {
        startTime = contentStartTime || Date.now();
        btnStart.disabled = true;
        btnStop.disabled = false;
        btnScan.disabled = true;
        statusCard.style.display = 'block';
        statusText.textContent = 'Running';
        statusText.className = 's-value on';
        startTimer();
        addLog('Reconnected to running session');
    }

    // ===== Scan =====
    function doScan() {
        btnStart.disabled = true;
        setStep(1);
        elEmpty.style.display = 'block';
        elEmpty.textContent = 'Scanning...';

        // Clear old list items (but keep elEmpty)
        elList.querySelectorAll('.el-item').forEach(el => el.remove());

        send({ action: 'scanAndMark' }, (resp) => {
            if (resp && resp.success && resp.list) {
                scanList = resp.list;
                renderList(resp.list);
                addLog('Found ' + resp.list.length + ' scrollable elements + Full Page');
                setStep(2); // 始终有 Full Page 选项，可以进入 Pick 步骤
            } else {
                elEmpty.textContent = 'Scan failed — try again';
                addLog('Scan failed');
            }
        });
    }

    btnScan.addEventListener('click', doScan);

    // ===== Render list =====
    function renderList(list) {
        elList.querySelectorAll('.el-item').forEach(el => el.remove());
        elEmpty.style.display = 'none'; // 至少有 Full Page 选项

        // Full Page 条目（始终显示在顶部）
        const fpRow = document.createElement('div');
        fpRow.className = 'el-item';
        fpRow.dataset.index = '-1';
        fpRow.innerHTML = `
            <div class="el-num" style="background:#333;font-size:18px">⇕</div>
            <div class="el-info">
                <div class="el-tag">Full Page</div>
                <div class="el-meta">window scroll</div>
            </div>
            <div class="el-overflow">
                <span class="arrow">↕</span> page
            </div>
        `;
        fpRow.addEventListener('click', () => selectFullPage());
        elList.appendChild(fpRow);

        // 各可滚动元素
        list.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'el-item';
            row.dataset.index = i;

            const arrow = item.canScrollY ? '↕' : '↔';
            const tagStr = '<' + item.tag + (item.cls ? '.' + item.cls : '') + '>';

            row.innerHTML = `
                <div class="el-num">${i + 1}</div>
                <div class="el-info">
                    <div class="el-tag">${tagStr}</div>
                    <div class="el-meta">${item.rect.w} x ${item.rect.h}px</div>
                </div>
                <div class="el-overflow">
                    <span class="arrow">${arrow}</span> ${item.overflow}px
                </div>
            `;

            row.addEventListener('click', () => selectItem(i));
            row.addEventListener('mouseenter', () => {
                send({ action: 'highlightIndex', index: i }, () => {});
            });

            elList.appendChild(row);
        });
    }

    // ===== Select Full Page =====
    function selectFullPage() {
        selectedIndex = -1;

        elList.querySelectorAll('.el-item').forEach((el) => {
            el.classList.toggle('selected', el.dataset.index === '-1');
        });

        send({ action: 'selectWindow' }, (resp) => {
            if (resp && resp.success) {
                btnStart.disabled = false;
                setStep(3);
                addLog('Selected: Full Page');
            } else {
                addLog('Selection failed');
            }
        });
    }

    // ===== Select item =====
    function selectItem(index) {
        selectedIndex = index;

        elList.querySelectorAll('.el-item').forEach((el, i) => {
            const idx = parseInt(el.dataset.index);
            el.classList.toggle('selected', idx === index && idx !== -1);
        });

        send({ action: 'selectByIndex', index }, (resp) => {
            if (resp && resp.success) {
                btnStart.disabled = false;
                setStep(3);
                const info = resp.info;
                addLog('Selected #' + (index + 1) + ' ' + info.tag + info.cls + ' (' + info.scrollHeight + 'px)');
            } else {
                addLog('Selection failed');
            }
        });
    }

    // ===== Start =====
    btnStart.addEventListener('click', () => {
        const settings = {
            scrollSpeed: parseInt(inputSpeed.value) || 30,
            scrollInterval: parseInt(inputInterval.value) || 2,
            simulateMouse: chkMouse.checked,
            hijackFocus: chkFocus.checked
        };

        send({ action: 'start', settings }, (resp) => {
            if (resp && resp.success) {
                btnStart.disabled = true;
                btnStop.disabled = false;
                btnScan.disabled = true;
                statusCard.style.display = 'block';
                statusText.textContent = 'Running';
                statusText.className = 's-value on';
                startTime = Date.now();
                startTimer();
                addLog('Started scrolling');
            } else {
                addLog('Start failed: ' + (resp && resp.error ? resp.error : 'unknown'));
            }
        });
    });

    // ===== Stop =====
    btnStop.addEventListener('click', () => {
        // 如果 tabId 丢了（popup 重新打开后），先重新获取
        function doStop() {
            send({ action: 'stop' }, () => {
                btnStart.disabled = false;
                btnStop.disabled = true;
                btnScan.disabled = false;
                statusText.textContent = 'Stopped';
                statusText.className = 's-value off';
                runTime.textContent = '00:00:00';
                scrollPct.textContent = '0%';
                progressBar.style.width = '0%';
                stopTimer();
                chrome.storage.local.remove('asaState');
                addLog('Stopped');
            });
        }

        if (!tabId) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    tabId = tabs[0].id;
                    chrome.scripting.executeScript({
                        target: { tabId }, files: ['content.js']
                    }).then(() => doStop()).catch(() => doStop());
                }
            });
        } else {
            doStop();
        }
    });

    // ===== Listen for messages from content script =====
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'progress') {
            scrollPct.textContent = msg.percent + '%';
            progressBar.style.width = msg.percent + '%';
        } else if (msg.type === 'log') {
            addLog(msg.text);
        }
    });

})();
