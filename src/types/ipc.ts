export interface IPCScraperCommand {
action: 'start' | 'pause' | 'resume' | 'stop'
config?: ScraperConfig
preset?: PresetWithConfig
credentials?: {
client_id: string
client_secret: string
user_agent: string
}
}
export interface IPCScraperUpdate {
type: 'progress' | 'log' | 'complete' | 'error'
data: any
}