export class UpdateChecker {
  private static currentVersion = '2.0.2'
  private static isChecking = false
  static async checkForUpdates(silent: boolean = false): Promise<boolean> {
    if (this.isChecking) return false
    this.isChecking = true
    try {
      const result = await window.electronAPI?.checkForUpdates()
      this.isChecking = false
      return result?.success || false
    } catch (error) {
      console.error('Update check failed:', error)
      this.isChecking = false
      return false
    }
  }
}