/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const START_URL =
  process.env.ELECTRON_START_URL || 'http://localhost:5000/student/scanner';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let settings = {
  openAtLogin: false,
  startMinimizedToTray: false,
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    settings = {
      openAtLogin: Boolean(parsed.openAtLogin),
      startMinimizedToTray: Boolean(parsed.startMinimizedToTray),
    };
  } catch {
    // Keep default settings.
  }
}

function saveSettings() {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function applyLoginItemSettings() {
  app.setLoginItemSettings({
    openAtLogin: settings.openAtLogin,
  });
}

function createTrayIcon() {
  const platformIconCandidates =
    process.platform === 'win32'
      ? [
          path.join(process.cwd(), 'electron', 'assets', 'tray.ico'),
          path.join(process.cwd(), 'electron', 'assets', 'tray.png'),
          path.join(process.cwd(), 'public', 'favicon.ico'),
        ]
      : [
          path.join(process.cwd(), 'electron', 'assets', 'trayTemplate.png'),
          path.join(process.cwd(), 'electron', 'assets', 'trayTemplate.svg'),
          path.join(process.cwd(), 'public', 'favicon.ico'),
        ];

  const iconCandidates = [
    ...platformIconCandidates,
    path.join(process.cwd(), 'electron', 'assets', 'trayTemplate.svg'),
  ];

  for (const iconPath of iconCandidates) {
    if (fs.existsSync(iconPath)) {
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) return image;
    }
  }

  // Fallback if no icon asset is available yet.
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAFElEQVR42mNkYGD4z0ABYBxVSFUAAP+rA1xB4ezYAAAAAElFTkSuQmCC',
  );
}

function showWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  if (process.platform === 'darwin') {
    tray.setIgnoreDoubleClickEvents(false);
  }
  tray.setToolTip('滴！交作业 - 学生端');
  tray.on('double-click', showWindow);

  const rebuildMenu = () => {
    const menu = Menu.buildFromTemplate([
    { label: '显示窗口', click: showWindow },
    { type: 'separator' },
    {
      label: '打开扫码页',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(START_URL);
          showWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: menuItem => {
        settings.openAtLogin = menuItem.checked;
        applyLoginItemSettings();
        saveSettings();
        rebuildMenu();
      },
    },
    {
      label: '启动后静默驻留',
      type: 'checkbox',
      checked: settings.startMinimizedToTray,
      click: menuItem => {
        settings.startMinimizedToTray = menuItem.checked;
        saveSettings();
        rebuildMenu();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
    ]);

    tray.setContextMenu(menu);
  };

  rebuildMenu();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    autoHideMenuBar: true,
    title: '滴！交作业 - 学生端',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(START_URL);
  if (settings.startMinimizedToTray) {
    mainWindow.hide();
  }

  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    // Ensure Windows toast notifications can be routed reliably.
    app.setAppUserModelId('com.homeworktracker.desktop');
  }
  loadSettings();
  applyLoginItemSettings();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep app alive in tray on desktop platforms.
});
