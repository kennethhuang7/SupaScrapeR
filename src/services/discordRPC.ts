export interface DiscordActivity {
  state?: string
  details?: string
  startTimestamp?: number
  largeImageKey?: string
  largeImageText?: string
  smallImageKey?: string
  smallImageText?: string
}
export class DiscordRPCService {
  private static clientId = '1423464610287190136'
  private static isEnabled = false
  private static currentActivity: DiscordActivity | null = null
  static async initialize(enabled: boolean) {
    this.isEnabled = enabled
    if (enabled && window.electronAPI?.initDiscordRPC) {
      try {
        await window.electronAPI.initDiscordRPC(this.clientId)
        if (this.currentActivity) {
          await this.setActivity(this.currentActivity)
        }
      } catch (error) {
        console.error('Failed to initialize Discord RPC:', error)
      }
    } else if (!enabled && window.electronAPI?.destroyDiscordRPC) {
      await window.electronAPI.destroyDiscordRPC()
    }
  }
  static async setActivity(activity: DiscordActivity) {
    this.currentActivity = activity
    if (this.isEnabled && window.electronAPI?.setDiscordActivity) {
      try {
        await window.electronAPI.setDiscordActivity(activity)
      } catch (error) {
        console.error('Failed to set Discord activity:', error)
      }
    }
  }
  static async clearActivity() {
    this.currentActivity = null
    if (this.isEnabled && window.electronAPI?.clearDiscordActivity) {
      try {
        await window.electronAPI.clearDiscordActivity()
      } catch (error) {
        console.error('Failed to clear Discord activity:', error)
      }
    }
  }
  static setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    if (enabled) {
      this.initialize(true)
    } else {
      this.clearActivity()
      if (window.electronAPI?.destroyDiscordRPC) {
        window.electronAPI.destroyDiscordRPC()
      }
    }
  }
}