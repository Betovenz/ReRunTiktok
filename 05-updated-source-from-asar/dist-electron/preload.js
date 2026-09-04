"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('rerun', {
    licenseLogin: (payload) => electron_1.ipcRenderer.invoke('license:login', payload),
    getLicenseStatus: () => electron_1.ipcRenderer.invoke('license:status'),
    licenseLogout: () => electron_1.ipcRenderer.invoke('license:logout'),
    getUpdateStatus: () => electron_1.ipcRenderer.invoke('update:get-status'),
    installUpdate: () => electron_1.ipcRenderer.invoke('update:install'),
    checkForUpdate: () => electron_1.ipcRenderer.invoke('update:check'),
    getUpdateConfig: () => electron_1.ipcRenderer.invoke('update:get-config'),
    setUpdateConfig: (payload) => electron_1.ipcRenderer.invoke('update:set-config', payload),
    getAnnouncements: () => electron_1.ipcRenderer.invoke('announcements:get'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
    adminUnlock: (payload) => electron_1.ipcRenderer.invoke('admin:unlock', payload),
    adminStatus: () => electron_1.ipcRenderer.invoke('admin:status'),
    adminLock: () => electron_1.ipcRenderer.invoke('admin:lock'),
    adminIssueKey: (payload) => electron_1.ipcRenderer.invoke('admin:issue-key', payload),
    adminLookupUser: (username) => electron_1.ipcRenderer.invoke('admin:lookup', username),
    adminRevokeUser: (username) => electron_1.ipcRenderer.invoke('admin:revoke', username),
    adminListKeys: () => electron_1.ipcRenderer.invoke('admin:list'),
    onUpdateStatus: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('update:status', listener);
        return () => electron_1.ipcRenderer.removeListener('update:status', listener);
    },
    minimizeWindow: () => electron_1.ipcRenderer.invoke('window:minimize'),
    toggleMaximizeWindow: () => electron_1.ipcRenderer.invoke('window:toggle-maximize'),
    closeWindow: () => electron_1.ipcRenderer.invoke('window:close'),
    isWindowMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    onWindowState: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('window:state', listener);
        return () => electron_1.ipcRenderer.removeListener('window:state', listener);
    },
    chooseVideo: () => electron_1.ipcRenderer.invoke('media:choose-video'),
    probeClips: (paths) => electron_1.ipcRenderer.invoke('media:probe-clips', paths),
    chooseOverlay: () => electron_1.ipcRenderer.invoke('media:choose-overlay'),
    loginTikTok: (accountId) => electron_1.ipcRenderer.invoke('tiktok:login', accountId),
    getTikTokStatus: (accountId) => electron_1.ipcRenderer.invoke('tiktok:status', accountId),
    logoutTikTok: (accountId) => electron_1.ipcRenderer.invoke('tiktok:logout', accountId),
    openTikTok: (accountId) => electron_1.ipcRenderer.invoke('tiktok:open', accountId),
    openTikTokShop: (accountId) => electron_1.ipcRenderer.invoke('tiktok:open-shop', accountId),
    scanLiveConsole: (accountId) => electron_1.ipcRenderer.invoke('tiktok:scan-live-console', accountId),
    getPinConfig: (accountId) => electron_1.ipcRenderer.invoke('pin:get-config', accountId),
    setPinConfig: (accountId, config) => electron_1.ipcRenderer.invoke('pin:set-config', accountId, config),
    listPinProducts: (accountId) => electron_1.ipcRenderer.invoke('pin:list-products', accountId),
    pinProductNow: (accountId, name) => electron_1.ipcRenderer.invoke('pin:pin-now', accountId, name),
    couponAction: (accountId, action) => electron_1.ipcRenderer.invoke('pin:coupon', accountId, action),
    getLiveStats: (accountId) => electron_1.ipcRenderer.invoke('pin:live-stats', accountId),
    startStream: (config) => electron_1.ipcRenderer.invoke('stream:start', config),
    applyStreamConfig: (config) => electron_1.ipcRenderer.invoke('stream:apply-config', config),
    stopStream: (accountId) => electron_1.ipcRenderer.invoke('stream:stop', accountId),
    getStreamStatus: (accountId) => electron_1.ipcRenderer.invoke('stream:status', accountId),
    getAppInfo: () => electron_1.ipcRenderer.invoke('app:info'),
    runBenchmark: (videoPath) => electron_1.ipcRenderer.invoke('system:benchmark', videoPath),
    onStreamStatus: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('stream:status-changed', listener);
        return () => electron_1.ipcRenderer.removeListener('stream:status-changed', listener);
    },
    onStreamHealth: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('stream:health', listener);
        return () => electron_1.ipcRenderer.removeListener('stream:health', listener);
    },
    getChatConfig: (accountId) => electron_1.ipcRenderer.invoke('chat:get-config', accountId),
    setChatConfig: (accountId, config) => electron_1.ipcRenderer.invoke('chat:set-config', accountId, config),
    getLineConfig: () => electron_1.ipcRenderer.invoke('line:get-config'),
    setLineConfig: (config) => electron_1.ipcRenderer.invoke('line:set-config', config),
    testLine: (config) => electron_1.ipcRenderer.invoke('line:test', config),
    pushLineStatus: () => electron_1.ipcRenderer.invoke('line:push-status'),
    listHistory: () => electron_1.ipcRenderer.invoke('history:list'),
    clearHistory: () => electron_1.ipcRenderer.invoke('history:clear'),
    chooseSalesFile: () => electron_1.ipcRenderer.invoke('sales:choose-file'),
    previewSales: (mapping) => electron_1.ipcRenderer.invoke('sales:preview', mapping),
    commitSales: (payload) => electron_1.ipcRenderer.invoke('sales:commit', payload),
    listSales: () => electron_1.ipcRenderer.invoke('sales:list'),
    removeSalesBatch: (batchId) => electron_1.ipcRenderer.invoke('sales:remove-batch', batchId),
    onHistoryChanged: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('history:changed', listener);
        return () => electron_1.ipcRenderer.removeListener('history:changed', listener);
    },
    // ลากไฟล์วาง: Electron 33 เอา File.path ออกแล้ว ต้องแปลงผ่าน webUtils ใน preload
    getPathForFile: (file) => {
        try { return electron_1.webUtils.getPathForFile(file); }
        catch { return ''; }
    },
    addLibraryPaths: (paths) => electron_1.ipcRenderer.invoke('library:add-paths', paths),
    listLibrary: () => electron_1.ipcRenderer.invoke('library:list'),
    addLibrary: () => electron_1.ipcRenderer.invoke('library:add'),
    removeLibrary: (id) => electron_1.ipcRenderer.invoke('library:remove', id),
    onChatEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('chat:event', listener);
        return () => electron_1.ipcRenderer.removeListener('chat:event', listener);
    },
});
