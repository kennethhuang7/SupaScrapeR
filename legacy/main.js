const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
let mainWindow;
let pythonProcess;
let splashWindow;
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    center: true,
    resizable: false,
    show: false,
    icon: path.join(__dirname, 'assets/supascraper-icon.png')
  });
  splashWindow.loadFile('src/splash.html');
  splashWindow.once('ready-to-show', () => {
    setTimeout(() => {
      splashWindow.show();
    }, 100);
  });
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  }, 3000);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    backgroundColor: '#0a0e1a',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, 'assets/supascraper-icon.png'),
    show: false 
  });
  mainWindow.loadFile('src/index.html');
}
app.whenReady().then(() => {
  createWindow();
  const fs = require('fs');
  const path = require('path');
  const home = process.env.HOME || process.env.USERPROFILE;
  const configFolder = path.join(home, 'Documents', 'SupaScrapeR');
  const lastFolderPath = path.join(configFolder, 'last_folder.txt');
  let showSplash = false;
  if (fs.existsSync(lastFolderPath)) {
    const lastFolder = fs.readFileSync(lastFolderPath, 'utf8').trim();
    if (lastFolder && fs.existsSync(lastFolder)) {
      const credPath = path.join(lastFolder, 'scraper_credentials.dat');
      if (fs.existsSync(credPath)) {
        showSplash = true;
        createSplashWindow();
      }
    }
  }
  if (!showSplash) {
    mainWindow.show();
  }
  startPythonBackend();
});
function startPythonBackend() {
  const script = path.join(__dirname, 'backend', 'supascraper_backend.py');
  let pythonPath;
  const venvPaths = ['venv_enhanced', 'venv_plus', 'venv'];
  let foundVenv = false;
  for (const venvName of venvPaths) {
    const venvPythonPath = process.platform === 'win32'
      ? path.join(__dirname, venvName, 'Scripts', 'python.exe')
      : path.join(__dirname, venvName, 'bin', 'python');
    if (fs.existsSync(venvPythonPath)) {
      pythonPath = venvPythonPath;
      foundVenv = true;
      console.log(`Using Python from ${venvName}: ${pythonPath}`);
      break;
    }
  }
  if (!foundVenv) {
    pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    console.log('Using system Python (no venv found)');
  }
  pythonProcess = spawn(pythonPath, [script], {
    cwd: __dirname,
    env: { ...process.env, PYTHONPATH: __dirname }
  });
  let messageBuffer = [];
let bufferTimeout = null;
pythonProcess.stdout.on('data', (data) => {
  const messages = data.toString().trim().split('\n');
  messages.forEach(message => {
    if (message && mainWindow) {
      try {
        const parsed = JSON.parse(message);
        mainWindow.webContents.send('backend-message', parsed);
      } catch (e) {
        if (message.trim()) {
          console.log('Backend output:', message);
        }
      }
    }
  });
});
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Backend error: ${data}`);
  });
  pythonProcess.on('error', (error) => {
    console.error('Failed to start Python backend:', error);
  });
}
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});
ipcMain.on('send-to-backend', (event, message) => {
  if (pythonProcess) {
    pythonProcess.stdin.write(JSON.stringify(message) + '\n');
  }
});
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => mainWindow.close());
app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  app.quit();
});