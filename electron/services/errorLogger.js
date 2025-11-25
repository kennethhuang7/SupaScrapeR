import fs from 'fs'
import path from 'path'
import { app } from 'electron'

class ErrorLogger {
	static instance = null
	baseDir = ''
	logDir = ''
	exportDir = ''
	settingsExportDir = ''
	errorLogPath = ''
	crashLogPath = ''
	currentDate = ''

	constructor() {
		this.baseDir = ''
		this.logDir = ''
		this.exportDir = ''
		this.settingsExportDir = ''
		this.errorLogPath = ''
		this.crashLogPath = ''
		this.currentDate = ''
	}

	static getInstance() {
		if (!ErrorLogger.instance) {
			ErrorLogger.instance = new ErrorLogger()
		}
		return ErrorLogger.instance
	}

	initialize(customDataPath) {
		this.baseDir = customDataPath || path.join(app.getPath('documents'), 'SupaScrapeR')
		this.logDir = path.join(this.baseDir, 'Error Logs')
		this.exportDir = path.join(this.baseDir, 'Exported Posts')
		this.settingsExportDir = path.join(this.baseDir, 'Exported Settings')
		if (!fs.existsSync(this.baseDir)) {
			fs.mkdirSync(this.baseDir, { recursive: true })
		}
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true })
		}
		if (!fs.existsSync(this.exportDir)) {
			fs.mkdirSync(this.exportDir, { recursive: true })
		}
		if (!fs.existsSync(this.settingsExportDir)) {
			fs.mkdirSync(this.settingsExportDir, { recursive: true })
		}
		this.updateLogPaths()
		this.cleanOldLogs()
	}

	updateLogPaths() {
		const today = new Date().toISOString().split('T')[0]
		if (this.currentDate !== today) {
			this.currentDate = today
			this.errorLogPath = path.join(this.logDir, `error-${today}.log`)
			this.crashLogPath = path.join(this.logDir, 'crash-reports', `crash-${today}.json`)
			const crashDir = path.dirname(this.crashLogPath)
			if (!fs.existsSync(crashDir)) {
				fs.mkdirSync(crashDir, { recursive: true })
			}
		}
	}

	cleanOldLogs() {
		try {
			const files = fs.readdirSync(this.logDir)
			const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
			files.forEach(file => {
				if (file.startsWith('error-') && file.endsWith('.log')) {
					const filePath = path.join(this.logDir, file)
					const stats = fs.statSync(filePath)
					if (stats.mtimeMs < thirtyDaysAgo) {
						fs.unlinkSync(filePath)
					}
				}
			})
		} catch (error) {
		}
	}

	formatLogEntry(level, message, stack, context) {
		const timestamp = new Date().toISOString()
		let entry = `[${timestamp}] [${level.toUpperCase()}] ${message}`
		if (stack) {
			entry += `\nStack Trace:\n${stack}`
		}
		if (context) {
			entry += `\nContext: ${JSON.stringify(context, null, 2)}`
		}
		entry += '\n' + '-'.repeat(80) + '\n'
		return entry
	}

	log(level, message, error, context) {
		this.updateLogPaths()
		const stack = error?.stack
		const logEntry = this.formatLogEntry(level, message, stack, context)
		try {
			fs.appendFileSync(this.errorLogPath, logEntry, 'utf8')
		} catch (err) {
		}
	}

	error(message, error, context) {
		this.log('error', message, error, context)
	}

	warn(message, context) {
		this.log('warn', message, undefined, context)
	}

	info(message, context) {
		this.log('info', message, undefined, context)
	}

	crash(error, context) {
		this.updateLogPaths()
		const crashReport = {
			timestamp: new Date().toISOString(),
			message: error.message,
			stack: error.stack,
			context: context,
			appVersion: app.getVersion(),
			platform: process.platform,
			arch: process.arch,
			nodeVersion: process.version
		}
		try {
			const existingCrashes = fs.existsSync(this.crashLogPath)
				? JSON.parse(fs.readFileSync(this.crashLogPath, 'utf8'))
				: []
			existingCrashes.push(crashReport)
			fs.writeFileSync(this.crashLogPath, JSON.stringify(existingCrashes, null, 2), 'utf8')
		} catch (err) {
		}
		this.error('CRITICAL CRASH', error, context)
	}

	getLogDirectory() {
		return this.logDir
	}

	getExportDirectory() {
		return this.exportDir
	}

	getSettingsExportDirectory() {
		return this.settingsExportDir
	}

	getBaseDirectory() {
		return this.baseDir
	}
}

export const errorLogger = ErrorLogger.getInstance()