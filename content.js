// content.js - Auto Scroll Agent v4.7
// 标记系统：fixed 浮层 + 超高 z-index，完全脱离页面 DOM，不会被压盖
(function() {
    'use strict';

    let isRunning = false;
    let intervals = [];
    let startTime = null;
    let targetEl = null;
    let windowScrollMode = false; // true = 滚动整个页面
    let scrollDir = 1;

    // 扫描状态
    let scrollableList = [];       // { el, canScrollY, canScrollX, overflow, ... }
    let overlayItems = [];         // { el, frame, badge } — 浮层 DOM 引用

    let overlayContainer = null;   // 浮层总容器
    let scrollUpdateRaf = null;    // requestAnimationFrame id
    let selectedIndex = -1;

    // ========== 浮层容器 ==========

    function ensureOverlayContainer() {
        // 清理上次注入残留的浮层
        const old = document.getElementById('asa-overlay-root');
        if (old) old.remove();

        overlayContainer = document.createElement('div');
        overlayContainer.id = 'asa-overlay-root';
        overlayContainer.style.cssText = `
            position: fixed; top: 0; left: 0;
            width: 0; height: 0;
            z-index: 99999999;
            pointer-events: none;
        `;
        document.documentElement.appendChild(overlayContainer);
    }

    // ========== 扫描并标记 ==========

    function scanAndMark() {
        clearMarkers();
        scrollableList = [];

        document.querySelectorAll('*').forEach(el => {
            if (el.id && el.id.startsWith('asa-')) return;
            if (el.closest && el.closest('[id^="asa-"]')) return;

            // 过滤太小的元素
            if (el.clientHeight < 40 && el.clientWidth < 40) return;

            const style = window.getComputedStyle(el);
            const yRange = el.scrollHeight - el.clientHeight;
            const xRange = el.scrollWidth - el.clientWidth;

            // 严格判断：overflow 为 auto/scroll 才会显示原生滚动条
            const oy = style.overflowY;
            const ox = style.overflowX;
            const hasScrollbarY = (oy === 'auto' || oy === 'scroll') && yRange > 20;
            const hasScrollbarX = (ox === 'auto' || ox === 'scroll') && xRange > 20;

            if (hasScrollbarY || hasScrollbarX) {
                const overflow = Math.max(yRange, xRange);
                scrollableList.push({
                    el,
                    canScrollY: hasScrollbarY,
                    canScrollX: hasScrollbarX,
                    overflow,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth
                });
            }
        });

        scrollableList.sort((a, b) => b.overflow - a.overflow);

        ensureOverlayContainer();

        // 为每个可滚动元素创建浮层：红色边框框 + 编号圆形徽章
        scrollableList.forEach((item, i) => {
            const rect = item.el.getBoundingClientRect();

            // 红色边框框 — fixed 定位，紧贴元素可视区域
            const frame = document.createElement('div');
            frame.style.cssText = `
                position: fixed;
                left: ${rect.left - 2}px;
                top: ${rect.top - 2}px;
                width: ${rect.width + 4}px;
                height: ${rect.height + 4}px;
                border: 4px solid #e53935;
                border-radius: 4px;
                pointer-events: none;
                box-sizing: border-box;
            `;
            overlayContainer.appendChild(frame);

            // 编号徽章 — 左上角外凸
            const badge = document.createElement('div');
            badge.style.cssText = `
                position: fixed;
                left: ${rect.left - 20}px;
                top: ${rect.top - 20}px;
                width: 44px;
                height: 44px;
                background: #e53935;
                color: white;
                font: bold 24px/44px -apple-system, 'SF Mono', 'Menlo', monospace;
                text-align: center;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 12px rgba(229,57,53,0.7);
                pointer-events: none;
            `;
            badge.textContent = String(i + 1);
            overlayContainer.appendChild(badge);

            overlayItems.push({ el: item.el, frame, badge });
        });

        // 监听滚动/resize，实时更新浮层位置
        window.addEventListener('scroll', onScrollUpdate, { passive: true, capture: true });
        window.addEventListener('resize', onScrollUpdate, { passive: true });

        // 返回可序列化列表给 popup
        return scrollableList.map((item, i) => ({
            index: i,
            tag: item.el.tagName.toLowerCase(),
            cls: item.el.className && typeof item.el.className === 'string'
                ? item.el.className.split(' ')[0] : '',
            id: item.el.id || '',
            scrollHeight: item.scrollHeight,
            clientHeight: item.clientHeight,
            overflow: item.overflow,
            canScrollY: item.canScrollY,
            canScrollX: item.canScrollX,
            rect: (() => {
                const r = item.el.getBoundingClientRect();
                return { w: Math.round(r.width), h: Math.round(r.height) };
            })()
        }));
    }

    // ========== 位置同步 ==========

    function onScrollUpdate() {
        if (scrollUpdateRaf) return;
        scrollUpdateRaf = requestAnimationFrame(() => {
            scrollUpdateRaf = null;
            repositionAll();
        });
    }

    function repositionAll() {
        overlayItems.forEach((item) => {
            const rect = item.el.getBoundingClientRect();
            item.frame.style.left = (rect.left - 2) + 'px';
            item.frame.style.top = (rect.top - 2) + 'px';
            item.frame.style.width = (rect.width + 4) + 'px';
            item.frame.style.height = (rect.height + 4) + 'px';

            item.badge.style.left = (rect.left - 20) + 'px';
            item.badge.style.top = (rect.top - 20) + 'px';
        });
    }

    // ========== 清除标记 ==========

    function clearMarkers() {
        window.removeEventListener('scroll', onScrollUpdate, true);
        window.removeEventListener('resize', onScrollUpdate);

        overlayItems.forEach(({ frame, badge }) => {
            if (frame.parentNode) frame.remove();
            if (badge.parentNode) badge.remove();
        });
        overlayItems = [];
        scrollableList = [];
        selectedIndex = -1;

        if (overlayContainer && overlayContainer.parentNode) {
            overlayContainer.remove();
            overlayContainer = null;
        }
    }

    // ========== 高亮 / 选中 ==========

    function highlightIndex(index) {
        overlayItems.forEach((item, i) => {
            if (i === index) {
                item.frame.style.border = '5px solid #1a73e8';
                item.badge.style.background = '#1a73e8';
                item.badge.style.boxShadow = '0 2px 12px rgba(26,115,232,0.7)';
            } else {
                item.frame.style.border = '4px solid #e53935';
                item.badge.style.background = '#e53935';
                item.badge.style.boxShadow = '0 2px 12px rgba(229,57,53,0.7)';
            }
        });
    }

    function selectByIndex(index) {
        if (index < 0 || index >= scrollableList.length) {
            return { success: false, error: 'Invalid index' };
        }
        selectedIndex = index;
        targetEl = scrollableList[index].el;
        windowScrollMode = false;
        highlightIndex(index);

        const tag = targetEl.tagName.toLowerCase();
        const cls = targetEl.className && typeof targetEl.className === 'string'
            ? '.' + targetEl.className.split(' ')[0] : '';

        return {
            success: true,
            info: {
                tag, cls,
                scrollHeight: targetEl.scrollHeight,
                clientHeight: targetEl.clientHeight,
                scrollable: targetEl.scrollHeight > targetEl.clientHeight
            }
        };
    }

    // 选择全页面滚动
    function selectWindow() {
        windowScrollMode = true;
        targetEl = null;
        selectedIndex = -1;

        // 所有浮层恢复红色
        overlayItems.forEach((item) => {
            item.frame.style.border = '4px solid #e53935';
            item.badge.style.background = '#e53935';
            item.badge.style.boxShadow = '0 2px 12px rgba(229,57,53,0.7)';
        });

        const docH = document.documentElement.scrollHeight;
        const winH = window.innerHeight;

        return {
            success: true,
            info: {
                tag: 'window',
                cls: '',
                scrollHeight: docH,
                clientHeight: winH,
                scrollable: docH > winH
            }
        };
    }

    function clearSelection() {
        if (targetEl || windowScrollMode) {
            overlayItems.forEach((item) => {
                item.frame.style.border = '4px solid #e53935';
                item.badge.style.background = '#e53935';
                item.badge.style.boxShadow = '0 2px 12px rgba(229,57,53,0.7)';
            });
            targetEl = null;
            windowScrollMode = false;
            selectedIndex = -1;
        }
    }

    // ========== 自动滚动 ==========

    function startScrolling(settings) {
        if (isRunning) return { success: false, error: 'Already running' };

        if (!targetEl && !windowScrollMode) {
            if (scrollableList.length > 0) {
                targetEl = scrollableList[0].el;
            } else {
                return { success: false, error: 'No target selected' };
            }
        }

        isRunning = true;
        startTime = Date.now();
        scrollDir = 1;

        const speed = settings.scrollSpeed || 30;
        const interval = (settings.scrollInterval || 2) * 1000;

        if (settings.hijackFocus) {
            try {
                Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
                Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            } catch(e) {}
            document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
            window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
        }

        if (windowScrollMode) {
            // 全页面滚动模式
            intervals.push(setInterval(() => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                if (max <= 0) return;
                const currentY = window.scrollY || window.pageYOffset;
                if (scrollDir === 1) {
                    if (currentY >= max - 5) scrollDir = -1;
                    window.scrollBy(0, speed);
                } else {
                    if (currentY <= 5) scrollDir = 1;
                    window.scrollBy(0, -speed);
                }
                const newY = window.scrollY || window.pageYOffset;
                const pct = max > 0 ? Math.round((newY / max) * 100) : 0;
                sendProgress(Math.min(100, Math.max(0, pct)));
                repositionAll();
            }, interval));
        } else {
            // 元素内滚动模式
            intervals.push(setInterval(() => {
                if (!targetEl) return;
                const max = targetEl.scrollHeight - targetEl.clientHeight;
                if (max <= 0) return;
                if (scrollDir === 1) {
                    if (targetEl.scrollTop >= max - 5) scrollDir = -1;
                    targetEl.scrollTop += speed;
                } else {
                    if (targetEl.scrollTop <= 5) scrollDir = 1;
                    targetEl.scrollTop -= speed;
                }
                targetEl.dispatchEvent(new Event('scroll', { bubbles: true }));
                const pct = max > 0 ? Math.round((targetEl.scrollTop / max) * 100) : 0;
                sendProgress(Math.min(100, Math.max(0, pct)));
                repositionAll();
            }, interval));
        }

        if (settings.simulateMouse) {
            const mouseTarget = windowScrollMode ? document.body : null;
            intervals.push(setInterval(() => {
                const t = mouseTarget || targetEl;
                if (!t) return;
                const r = windowScrollMode
                    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
                    : t.getBoundingClientRect();
                t.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, clientX: r.left + Math.random() * r.width, clientY: r.top + Math.random() * r.height
                }));
            }, 25000));
            intervals.push(setInterval(() => {
                const t = mouseTarget || targetEl;
                if (!t) return;
                const r = windowScrollMode
                    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
                    : t.getBoundingClientRect();
                t.dispatchEvent(new MouseEvent('click', {
                    bubbles: true, clientX: r.left + Math.random() * r.width, clientY: r.top + Math.random() * r.height
                }));
            }, 45000));
        }

        intervals.push(setInterval(() => {
            const t = windowScrollMode ? document.body : targetEl;
            if (!t) return;
            t.dispatchEvent(new KeyboardEvent('keydown', {
                key: scrollDir === 1 ? 'ArrowDown' : 'ArrowUp', bubbles: true
            }));
        }, 60000));

        sendLog('Started');
        chrome.storage.local.set({ asaState: { running: true, startTime: startTime, selectedIndex: -1 } });
        return { success: true };
    }

    function stopScrolling() {
        intervals.forEach(id => clearInterval(id));
        intervals = [];
        isRunning = false;
        startTime = null;
        clearSelection();
        chrome.storage.local.remove('asaState');
        sendLog('Stopped');
    }

    // ========== 工具 ==========

    function sendLog(text) {
        try { chrome.runtime.sendMessage({ type: 'log', text }); } catch(e) {}
    }

    function sendProgress(pct) {
        try { chrome.runtime.sendMessage({ type: 'progress', percent: pct }); } catch(e) {}
    }

    // ========== 消息监听 ==========

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'scanAndMark') {
            const list = scanAndMark();
            sendResponse({ success: true, list });
        } else if (msg.action === 'highlightIndex') {
            highlightIndex(msg.index);
            sendResponse({ success: true });
        } else if (msg.action === 'selectByIndex') {
            sendResponse(selectByIndex(msg.index));
        } else if (msg.action === 'selectWindow') {
            sendResponse(selectWindow());
        } else if (msg.action === 'clearMarkers') {
            clearMarkers();
            sendResponse({ success: true });
        } else if (msg.action === 'start') {
            sendResponse(startScrolling(msg.settings));
        } else if (msg.action === 'stop') {
            stopScrolling();
            sendResponse({ success: true });
        } else if (msg.action === 'getStatus') {
            sendResponse({
                running: isRunning,
                startTime,
                hasTarget: !!targetEl || windowScrollMode,
                scrollableCount: scrollableList.length
            });
        }
        return true;
    });

    console.log('[Auto Scroll Agent] v4.7 loaded');
})();
