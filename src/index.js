const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// 开发环境下的热重载功能
if (process.env.NODE_ENV !== 'production') {
	try {
		const electronReload = require('electron-reload');
		
		// 监视的文件和目录
		electronReload(__dirname, {
			electron: path.join(__dirname, '../node_modules/electron'),
			hardResetMethod: 'quit', // 使用quit而不是exit，以避免强制关闭
			ignored: [
				/node_modules/,
				/epubs/,
				/[\/\\]\./,
				/.*\.json$/
			]
		});
		
		console.log('热重载功能已启用 - 修改src目录下的文件将自动重新加载应用');
	} catch (error) {
		console.error('热重载功能加载失败:', error);
	}
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	// eslint-disable-line global-require
	app.quit();
}

const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 720 

const createWindow = () => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: DEFAULT_WINDOW_WIDTH,
		height: DEFAULT_WINDOW_HEIGHT,
		resizable: false,
		show: false,
		frame: false,
		icon: path.join(__dirname, "icon.ico"),
		webPreferences: {
			webviewTag: true,
			nodeIntegration: true,
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, './preload.js'),
		},
	});

	// Load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'pages', 'index.html'));

	// IPC handlers
	ipcMain.handle('appVersion', () => app.getVersion());
	ipcMain.handle('storePath', () => path.resolve(path.join(app.getPath('userData'), 'localStorage')).split(path.sep).join("/"));

	// Open external URLs in default browser
	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: 'deny' };
	});

	// Show the window when the content finishes loading
	mainWindow.webContents.on('did-finish-load', () => {
		setTimeout(() => mainWindow.show(), 50); // Delayed show to avoid visual glitches
	});

	// Register global shortcut for refreshing the window
	globalShortcut.register('f5', () => {
		mainWindow.reload();
	});

	// 开发环境下添加Ctrl+R快捷键重载
	if (process.env.NODE_ENV === 'development') {
		globalShortcut.register('CommandOrControl+R', () => {
			console.log('手动触发重新加载');
			mainWindow.reload();
		});
	}

	// Event listeners for window actions
	ipcMain.on('closeApp', () => {
		mainWindow.close();
	});
	ipcMain.on('minimizeApp', () => {
		mainWindow.minimize();
	});
	ipcMain.on('resizeApp', () => {
		if (!mainWindow.isMaximized()) {
			mainWindow.maximize();
		} else {
			mainWindow.unmaximize();
		}
	});
	ipcMain.on('unmaximizeApp', () => {
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize();
		}
	});
	ipcMain.on('setWindowResizable', () => {
		mainWindow.setResizable(true)
	});
	ipcMain.on('unsetWindowResizable', () => {
		mainWindow.unmaximize();
		mainWindow.setSize(1280,720,false);
		mainWindow.center()
		mainWindow.setResizable(false);
	});
	// Show a file dialog to choose an EPUB file
	ipcMain.on('openBookChooserDialog', () => {
		dialog
			.showOpenDialog({
				properties: ['openFile'],
				filters: [
					{ name: 'Epub Files', extensions: ['epub','pdf','mobi'] }
				]
			})
			.then(result => {
				if (!result.canceled) {
					// Send the selected file path to the renderer process
					mainWindow.webContents.send('bookChosenSuccess', result.filePaths[0]);
				}
			})
			.catch(err => {
				console.log(err);
			});
	});
	ipcMain.on('openCoverChooserDialog', () => {
		dialog
			.showOpenDialog({
				properties: ['openFile'],
				filters: [
					{ name: 'Cover image', extensions: ['png','jpg'] }
				]
			})
			.then(result => {
				if (!result.canceled) {
					// Send the selected file path to the renderer process
					mainWindow.webContents.send('coverChosenSuccess', result.filePaths[0]);
				}
			})
			.catch(err => {
				console.log(err);
			});
	});

	mainWindow.on('resize', () => {
		mainWindow.webContents.send('updateMaximizeIcon', mainWindow.isMaximized());
	});
};

// Event listener for when Electron has finished initialization
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// Re-create the window when the dock icon is clicked (only for macOS)
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
