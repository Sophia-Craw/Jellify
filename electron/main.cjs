const { app, BrowserWindow, ipcMain } = require("electron");
const { fork } = require("child_process");
const path = require("path");

const isMac = process.platform === "darwin";
const PORT = 15327;
let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, "..", ".output", "server", "index.mjs");
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    const onOutput = (data) => {
      const text = data.toString();
      if (text.includes("Listening")) resolve();
    };

    serverProcess.stdout.on("data", onOutput);
    serverProcess.stderr.on("data", onOutput);
    serverProcess.on("error", reject);
    setTimeout(() => resolve(), 5000);
  });
}

function createWindow() {
  const opts = {
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "..", "public", "jellify.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (isMac) {
    opts.titleBarStyle = "hidden";
  } else {
    opts.frame = false;
  }

  const win = new BrowserWindow(opts);

  win.loadURL(`http://localhost:${PORT}`);

  ipcMain.on("window:minimize", () => win.minimize());
  ipcMain.on("window:maximize", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", () => win.close());

  return win;
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
