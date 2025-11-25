import { autoUpdater } from 'electron-updater'
import { errorLogger } from './services/errorLogger.js'
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
let updateCheckInProgress = false
export function setupAutoUpdater(mainWindow) {
	autoUpdater.on('checking-for-update', () => {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'checking',
				message: 'Checking for updates...' 
			})
		}
	})
	autoUpdater.on('update-available', (info) => {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'available',
				version: info.version,
				message: `Update available: v${info.version}` 
			})
		}
	})
	autoUpdater.on('update-not-available', () => {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'not-available',
				message: 'You are on the latest version' 
			})
		}
	})
	autoUpdater.on('error', (err) => {
		errorLogger.error('Auto-updater error', err)
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'error',
				message: 'Error checking for updates' 
			})
		}
	})
	autoUpdater.on('download-progress', (progressObj) => {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'downloading',
				percent: progressObj.percent,
				message: `Downloading update... ${Math.round(progressObj.percent)}%` 
			})
		}
	})
	autoUpdater.on('update-downloaded', (info) => {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('update-status', { 
				type: 'downloaded',
				version: info.version,
				message: 'Update downloaded. Restart to install.' 
			})
		}
	})
}
export async function checkForUpdates(silent = false) {
	if (updateCheckInProgress) return
	updateCheckInProgress = true
	try {
		const result = await autoUpdater.checkForUpdates()
		return result
	} catch (error) {
		errorLogger.error('Update check failed', error)
		if (!silent) {
			throw error
		}
	} finally {
		updateCheckInProgress = false
	}
}
export function downloadUpdate() {
	return autoUpdater.downloadUpdate()
}
export function quitAndInstall() {
	autoUpdater.quitAndInstall(false, true)
}