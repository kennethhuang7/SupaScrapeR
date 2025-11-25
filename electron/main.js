import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { spawn } from 'child_process'
import Store from 'electron-store'
import DiscordRPC from 'discord-rpc'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { setupAutoUpdater, checkForUpdates as checkUpdates, downloadUpdate, quitAndInstall } from './autoUpdater.js'
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
	app.quit()
} else {
	app.on('second-instance', () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.show()
			mainWindow.focus()
		}
	})
}
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
let errorLogger
const store = new Store()
let mainWindow
let splashWindow
let tray
let isDev = !app.isPackaged
let rpcClient = null
let rpcReady = false
let scraperProcess = null
let logCleanupInterval = null
let centralSupabase = null
async function initCentralSupabase() {
	try {
		centralSupabase = createClient(
			'https://omitxzblawsmbmptavby.supabase.co',
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taXR4emJsYXdzbWJtcHRhdmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTMyOTksImV4cCI6MjA3NDQ4OTI5OX0.UmrLVOs8JSfGgV3_pGZt0NlsMwVxl-83WINVlJcld4w'
		)
	} catch (error) {
		errorLogger.error('Failed to initialize central Supabase', error)
	}
}
function startLogCleanupScheduler() {
	if (logCleanupInterval) {
		clearInterval(logCleanupInterval)
	}
	logCleanupInterval = setInterval(async () => {
		try {
			const userId = store.get('userId')
			if (!userId || !centralSupabase) return
			const { data: profile } = await centralSupabase
				.from('profiles')
				.select('preferences')
				.eq('id', userId)
				.single()
			const autoDeleteEnabled = profile?.preferences?.security?.autoDeleteLogs ?? true
			if (autoDeleteEnabled) {
				errorLogger.cleanOldLogs()
				await cleanOldActivityLogs(userId)
				errorLogger.info('Auto-cleanup: Old logs deleted')
			}
		} catch (error) {
			errorLogger.error('Failed to run auto-cleanup', error)
		}
	}, 24 * 60 * 60 * 1000)
}
async function cleanOldActivityLogs(userId) {
	try {
		if (!centralSupabase) return
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
		const { error } = await centralSupabase
			.from('recent_activities')
			.delete()
			.eq('user_id', userId)
			.lt('created_at', thirtyDaysAgo.toISOString())
		if (error) throw error
	} catch (error) {
		errorLogger.error('Failed to clean old activity logs', error)
	}
}
function createSplashWindow() {
	splashWindow = new BrowserWindow({
		width: 350,
		height: 350,
		frame: false,
		titleBarStyle: 'hidden',
		alwaysOnTop: true,
		transparent: true,
		resizable: false,
		movable: false,
		center: true,
		hasShadow: false,
		icon: join(__dirname, '../assets/supascraper-icon.ico'),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true
		}
	})
	splashWindow.loadFile(join(__dirname, 'splash.html'))
	splashWindow.once('ready-to-show', () => {
		splashWindow.show()
	})
	splashWindow.on('closed', () => {
		splashWindow = null
	})
}
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 1200,
		minHeight: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: join(__dirname, 'preload.js')
		},
		icon: join(__dirname, '../assets/supascraper-icon.png'),
		show: false,
		frame: false,
		autoHideMenuBar: true,
		backgroundColor: '#0a0e1a'
	})
	mainWindow.setMenuBarVisibility(false)
	mainWindow.setAutoHideMenuBar(true)
	mainWindow.setMenu(null)
	mainWindow.webContents.on('before-input-event', (event, input) => {
		const settings = store.get('settings')
		const devMode = settings?.interface?.developerMode ?? false
		if (devMode && ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12')) {
			mainWindow.webContents.toggleDevTools()
			event.preventDefault()
		}
	})
	if (isDev) {
		mainWindow.loadURL('http://localhost:5173')
	} else {
		const indexPath = join(__dirname, '..', 'dist', 'index.html')
		mainWindow.loadFile(indexPath)
	}
	mainWindow.once('ready-to-show', () => {
		setTimeout(() => {
			if (splashWindow && !splashWindow.isDestroyed()) {
			splashWindow.close()
			splashWindow = null
			}
			setTimeout(() => {
			mainWindow.maximize()
			mainWindow.show()
			}, 300)
		}, 2000)
	})
	mainWindow.on('close', (event) => {
		const settings = store.get('settings')
		const minimizeToTray = settings?.interface?.minimizeToTray ?? true
		if (minimizeToTray && !app.isQuitting) {
			event.preventDefault()
			mainWindow.hide()
			if (process.platform === 'darwin') {
				app.dock.hide()
			}
			updateTrayVisibility()
		}
	})
	mainWindow.on('closed', () => {
		mainWindow = null
		if (tray) {
			tray.destroy()
			tray = null
		}
	})
	mainWindow.on('show', () => {
		updateTrayVisibility()
	})
	mainWindow.on('hide', () => {
		updateTrayVisibility()
	})
	mainWindow.on('maximize', () => {
		mainWindow.webContents.send('window-maximized')
	})
	mainWindow.on('unmaximize', () => {
		mainWindow.webContents.send('window-unmaximized')
	})
}
function createTray() {
	const iconPath = join(__dirname, '../assets/supascraper-icon.png')
	const icon = nativeImage.createFromPath(iconPath)
	tray = new Tray(icon.resize({ width: 16, height: 16 }))
	const contextMenu = Menu.buildFromTemplate([
		{
			label: 'Show SupaScrapeR',
			click: () => {
				if (mainWindow) {
					mainWindow.show()
					if (process.platform === 'darwin') {
						app.dock.show()
					}
				}
			}
		},
		{
			label: 'Hide SupaScrapeR',
			click: () => {
				if (mainWindow) {
					mainWindow.hide()
					if (process.platform === 'darwin') {
						app.dock.hide()
					}
				}
			}
		},
		{ type: 'separator' },
		{
			label: 'Quit',
			click: () => {
				app.isQuitting = true
				app.quit()
			}
		}
	])
	tray.setToolTip('SupaScrapeR')
	tray.setContextMenu(contextMenu)
	tray.on('click', () => {
		if (mainWindow) {
			if (mainWindow.isVisible()) {
				mainWindow.hide()
				if (process.platform === 'darwin') {
					app.dock.hide()
				}
			} else {
				mainWindow.show()
				if (process.platform === 'darwin') {
					app.dock.show()
				}
			}
		}
	})
}
function updateTrayVisibility() {
	const settings = store.get('settings')
	const minimizeToTray = settings?.interface?.minimizeToTray ?? true
	if (minimizeToTray && !tray) {
		createTray()
	} else if (!minimizeToTray && tray) {
		tray.destroy()
		tray = null
	}
}
app.whenReady().then(async () => {
	const loggerPath = join(__dirname, 'services', 'errorLogger.js')
	const loggerUrl = pathToFileURL(loggerPath).href
	const { errorLogger: logger } = await import(loggerUrl)
	errorLogger = logger
	const customDataPath = store.get('customDataPath', null)
	errorLogger.initialize(customDataPath)
	await initCentralSupabase()
	startLogCleanupScheduler()
	const settings = store.get('settings') || {}
	if (settings?.interface?.hardwareAcceleration === false) {
		app.disableHardwareAcceleration()
	}
	createSplashWindow()
	setTimeout(() => {
		createWindow()
		setupAutoUpdater(mainWindow)
		const shouldStartMinimized = settings?.interface?.startMinimized && settings?.interface?.startWithSystem
		if (shouldStartMinimized && mainWindow) {
			mainWindow.hide()
			if (process.platform === 'darwin') {
				app.dock.hide()
			}
		}
	}, 100)
	store.set('settings.sessionStartTime', Date.now())
	if (settings?.interface?.minimizeToTray ?? true) {
		createTray()
	}
})
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})
app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}
})
app.on('before-quit', () => {
	app.isQuitting = true
	if (scraperProcess) {
		scraperProcess.kill('SIGTERM')
	}
	if (rpcClient) {
		try {
			rpcClient.destroy()
		} catch (error) {
			errorLogger.error('Error destroying Discord RPC', error)
		}
	}
	if (logCleanupInterval) {
		clearInterval(logCleanupInterval)
	}
})
ipcMain.handle('get-app-version', () => {
	return app.getVersion()
})
ipcMain.handle('save-credentials', async (event, credentials) => {
	try {
		store.set('credentials', credentials)
		return { success: true }
	} catch (error) {
		return { success: false, error: error.message }
	}
})
ipcMain.handle('get-credentials', async () => {
	try {
		return store.get('credentials')
	} catch (error) {
		return null
	}
})
ipcMain.handle('clear-credentials', async () => {
	try {
		store.delete('credentials')
		return { success: true }
	} catch (error) {
		return { success: false, error: error.message }
	}
})
ipcMain.handle('set-login-item', async (event, openAtLogin) => {
	app.setLoginItemSettings({
		openAtLogin: openAtLogin,
		path: app.getPath('exe')
	})
	return { success: true }
})
ipcMain.handle('get-login-item-settings', async () => {
	return app.getLoginItemSettings()
})
ipcMain.handle('save-settings', async (event, settings) => {
	try {
		store.set('settings', settings)
		return { success: true }
	} catch (error) {
		return { success: false, error: error.message }
	}
})
ipcMain.handle('get-settings', async () => {
	try {
		return store.get('settings')
	} catch (error) {
		return null
	}
})
ipcMain.handle('update-tray-visibility', async () => {
	updateTrayVisibility()
	return { success: true }
})
ipcMain.handle('save-miniplayer-state', async (event, state) => {
	try {
		store.set('miniplayer', state)
		return { success: true }
	} catch (error) {
		errorLogger.error('Failed to save miniplayer state', error, { state })
		return { success: false, error: error.message }
	}
})
ipcMain.handle('get-miniplayer-state', async () => {
	try {
		const state = store.get('miniplayer', {
			x: 100,
			y: 100,
			width: 380,
			height: 420,
			isVisible: false
		})
		return state
	} catch (error) {
		errorLogger.error('Failed to get miniplayer state', error)
		return {
			x: 100,
			y: 100,
			width: 380,
			height: 420,
			isVisible: false
		}
	}
})
ipcMain.handle('init-discord-rpc', async (event, clientId) => {
	try {
		if (rpcClient) {
			rpcClient.destroy()
		}
		rpcClient = new DiscordRPC.Client({ transport: 'ipc' })
		await rpcClient.login({ clientId })
		rpcReady = true
		return { success: true }
	} catch (error) {
		rpcClient = null
		rpcReady = false
		return { success: false, error: error.message }
	}
})
ipcMain.handle('set-discord-activity', async (event, activity) => {
	try {
		if (!rpcClient || !rpcReady) {
			return { success: false, error: 'Discord RPC not initialized' }
		}
		await rpcClient.setActivity(activity)
		return { success: true }
	} catch (error) {
		errorLogger.error('Discord RPC set activity error', error, { activity })
		return { success: false, error: error.message }
	}
})
ipcMain.handle('clear-discord-activity', async () => {
	try {
		if (!rpcClient || !rpcReady) {
			return { success: false, error: 'Discord RPC not initialized' }
		}
		await rpcClient.clearActivity()
		return { success: true }
	} catch (error) {
		errorLogger.error('Discord RPC clear activity error', error)
		return { success: false, error: error.message }
	}
})
ipcMain.handle('destroy-discord-rpc', async () => {
	try {
		if (rpcClient) {
			await rpcClient.destroy()
			rpcClient = null
			rpcReady = false
		}
		return { success: true }
	} catch (error) {
		errorLogger.error('Discord RPC destroy error', error)
		return { success: false, error: error.message }
	}
})
ipcMain.handle('check-for-updates', async () => {
	try {
		const result = await checkUpdates(false)
		return { success: true, updateInfo: result }
	} catch (error) {
		errorLogger.error('Manual update check failed', error)
		return { success: false, error: error.message }
	}
})
ipcMain.handle('download-update', async () => {
	try {
		await downloadUpdate()
		return { success: true }
	} catch (error) {
		errorLogger.error('Update download failed', error)
		return { success: false, error: error.message }
	}
})
ipcMain.handle('install-update', () => {
	quitAndInstall()
})
ipcMain.handle('select-folder', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory', 'createDirectory'],
		title: 'Select Data Storage Location',
		buttonLabel: 'Select Folder'
	})
	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths[0]
	}
	return null
})
ipcMain.handle('get-default-data-path', () => {
	return join(app.getPath('documents'), 'SupaScrapeR')
})
ipcMain.handle('get-custom-data-path', () => {
	return store.get('customDataPath', null)
})
ipcMain.handle('set-custom-data-path', async (event, customPath) => {
	try {
		store.set('customDataPath', customPath)
		errorLogger.initialize(customPath)
		return { success: true, path: customPath }
	} catch (error) {
		errorLogger.error('Failed to set custom data path', error, { customPath })
		return { success: false, error: error.message }
	}
})
ipcMain.handle('get-data-directories', () => {
	return {
		base: errorLogger.getBaseDirectory(),
		logs: errorLogger.getLogDirectory(),
		exports: errorLogger.getExportDirectory(),
		settingsExports: errorLogger.getSettingsExportDirectory()
	}
})
ipcMain.handle('open-folder', async (event, folderType) => {
	try {
		let folderPath
		switch (folderType) {
			case 'base':
				folderPath = errorLogger.getBaseDirectory()
				break
			case 'logs':
				folderPath = errorLogger.getLogDirectory()
				break
			case 'exports':
				folderPath = errorLogger.getExportDirectory()
				break
			case 'settingsExports':
				folderPath = errorLogger.getSettingsExportDirectory()
				break
			default:
				return { success: false, error: 'Invalid folder type' }
		}
		await shell.openPath(folderPath)
		return { success: true }
	} catch (error) {
		errorLogger.error('Failed to open folder', error, { folderType })
		return { success: false, error: error.message }
	}
})
ipcMain.handle('save-export-file', async (event, { content, filename, format, type = 'posts' }) => {
	try {
		const exportDir = type === 'settings' 
			? errorLogger.getSettingsExportDirectory() 
			: errorLogger.getExportDirectory()
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
		const dateStr = timestamp[0]
		const timeStr = timestamp[1].split('-').slice(0, 3).join('-')
		const prefix = type === 'settings' ? 'settings_export' : 'posts_export'
		const fullFilename = `${prefix}_${dateStr}_${timeStr}.${format}`
		const filepath = join(exportDir, fullFilename)
		fs.writeFileSync(filepath, content, 'utf8')
		return { success: true, path: filepath, filename: fullFilename }
	} catch (error) {
		errorLogger.error('Failed to save export file', error, { filename, format, type })
		return { success: false, error: error.message }
	}
})
ipcMain.on('window-minimize', () => {
	if (mainWindow) {
		mainWindow.minimize()
	}
})
ipcMain.on('window-maximize', () => {
	if (mainWindow) {
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize()
		} else {
			mainWindow.maximize()
		}
	}
})
ipcMain.on('window-close', () => {
	if (mainWindow) {
		mainWindow.close()
	}
})
ipcMain.on('start-scraper', (event, data) => {
	if (scraperProcess) {
		scraperProcess.kill('SIGTERM')
	}
	const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'
	const pythonScript = isDev 
		? join(__dirname, '../scripts/scraper.py')
		: join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'scraper.py')
	scraperProcess = spawn(pythonExecutable, [pythonScript, JSON.stringify(data)])
	scraperProcess.stdout.on('data', (data) => {
		try {
			const lines = data.toString().split('\n')
			lines.forEach(line => {
				if (line.trim()) {
					const message = JSON.parse(line)
					if (mainWindow && mainWindow.webContents) {
						mainWindow.webContents.send('scraper-update', message)
					}
				}
			})
		} catch (error) {
			errorLogger.error('Error parsing scraper output', error, { rawData: data.toString() })
		}
	})
	scraperProcess.stderr.on('data', (data) => {
		errorLogger.error('Scraper process error', new Error(data.toString()))
	})
	scraperProcess.on('close', (code) => {
		console.log(`Scraper process exited with code ${code}`)
		if (code !== 0) {
			errorLogger.warn('Scraper process exited with non-zero code', { exitCode: code })
		}
		scraperProcess = null
	})
})
ipcMain.on('pause-scraper', () => {
	if (scraperProcess && process.platform !== 'win32') {
		scraperProcess.kill('SIGSTOP')
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('scraper-update', { type: 'paused', data: {} })
		}
	}
})
ipcMain.on('resume-scraper', () => {
	if (scraperProcess && process.platform !== 'win32') {
		scraperProcess.kill('SIGCONT')
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('scraper-update', { type: 'resumed', data: {} })
		}
	}
})
ipcMain.on('stop-scraper', () => {
	if (scraperProcess) {
		scraperProcess.kill('SIGTERM')
		scraperProcess = null
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('scraper-update', { type: 'stopped', data: {} })
		}
	}
})