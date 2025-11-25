import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useScraperStore } from '@/stores/scraperStore'
import { DiscordRPCService } from '@/services/discordRPC'

export default function NotificationListener() {
  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    desktop: true,
    errors: true,
    completion: true,
    keywordCompletion: true,
    subredditCompletion: true,
    rateLimit: true
  })
  const [discordEnabled, setDiscordEnabled] = useState(false)

  const { startScraping, pauseScraping, resumeScraping, stopScraping, updateProgress, updateStatus, addLog } = useScraperStore()

  useEffect(() => {
    loadNotificationSettings()
  }, [])

  const loadNotificationSettings = async () => {
    try {
      const settings = await window.electronAPI?.getSettings()
      if (settings?.notifications) {
        setNotificationSettings(settings.notifications)
      }
      if (settings?.interface?.doNotDisturb !== undefined) {
        setDoNotDisturb(settings.interface.doNotDisturb)
      }
      if (settings?.interface?.discordPresence !== undefined) {
        setDiscordEnabled(settings.interface.discordPresence)
      }
    } catch (error) {
      console.error('Error loading notification settings:', error)
    }
  }

  useEffect(() => {
    if (!window.electronAPI?.onScraperUpdate) return

    const cleanup = window.electronAPI.onScraperUpdate((message: any) => {
      const shouldShowToast = !doNotDisturb
      const shouldShowDesktop = !doNotDisturb && notificationSettings.desktop

      switch (message.type) {
        case 'started':
          startScraping()
          if (shouldShowDesktop) {
            new Notification('SupaScrapeR', {
              body: 'Scraping started successfully',
              icon: './supascraper-icon.png'
            })
          }
          if (discordEnabled) {
            DiscordRPCService.setActivity({
              details: 'Starting scraper...',
              state: 'Initializing',
              startTimestamp: Date.now()
            })
          }
          break

        case 'progress':
          const progressData = message.data
          updateProgress({
            current: progressData.posts_collected,
            total: progressData.total_target,
            currentKeyword: progressData.current_keyword,
            totalKeywords: progressData.total_keywords,
            currentSubreddit: progressData.current_subreddit,
            totalSubreddits: progressData.total_subreddits,
            currentIterationPosts: progressData.current_iteration_posts,
            maxIterationPosts: progressData.max_iteration_posts,
            currentTarget: progressData.current_target,
            mode: progressData.mode
          })
          updateStatus({
            cpuUsage: progressData.cpu_usage,
            ramUsage: progressData.ram_usage,
            elapsedTime: progressData.elapsed_time,
            postsCollected: progressData.posts_collected
          })
          if (discordEnabled && progressData.current_target) {
            const subredditMatch = progressData.current_target.match(/r\/(\w+)/)
            const subredditName = subredditMatch ? subredditMatch[1] : 'Unknown'
            DiscordRPCService.setActivity({
              details: `Scraping r/${subredditName}`,
              state: `${progressData.current_iteration_posts}/${progressData.max_iteration_posts} posts`,
              startTimestamp: Date.now() - (progressData.elapsed_time * 1000)
            })
          }
          break

        case 'log':
          addLog({
            type: message.data.type || 'info',
            message: message.data.message
          })
          break

        case 'rate_limit':
          if (notificationSettings.rateLimit && shouldShowToast) {
            toast.warning(`Reddit API rate limit reached - pausing for ${message.data.wait_time} seconds`)
          }
          break

        case 'keyword_complete':
          if (notificationSettings.completion && notificationSettings.keywordCompletion) {
            const msg = `Finished scraping r/${message.data.subreddit} for keyword "${message.data.keyword}" - ${message.data.posts_count} posts`
            if (shouldShowToast) {
              toast.success(msg)
            }
          }
          break

        case 'subreddit_complete':
          if (notificationSettings.completion && notificationSettings.subredditCompletion) {
            const msg = `Finished scraping r/${message.data.subreddit} - ${message.data.posts_count} posts`
            if (shouldShowToast) {
              toast.success(msg)
            }
          }
          break

        case 'complete':
          stopScraping()
          if (notificationSettings.completion) {
            const msg = `Scraping completed! Collected ${message.data.total_posts} posts in ${message.data.elapsed_time}s`
            if (shouldShowToast) {
              toast.success(msg)
            }
            if (shouldShowDesktop) {
              new Notification('SupaScrapeR', {
                body: msg,
                icon: '/assets/supascraper-icon.png'
              })
            }
          }
          if (discordEnabled) {
            DiscordRPCService.clearActivity()
          }
          break

        case 'error':
          stopScraping()
          if (notificationSettings.errors) {
            const msg = message.data.message || 'An error occurred during scraping'
            if (shouldShowToast) {
              toast.error(msg)
            }
            if (shouldShowDesktop) {
              new Notification('SupaScrapeR Error', {
                body: msg,
                icon: '/assets/supascraper-icon.png'
              })
            }
          }
          if (discordEnabled) {
            DiscordRPCService.clearActivity()
          }
          break

        case 'paused':
          pauseScraping()
          break

        case 'resumed':
          resumeScraping()
          break

        case 'stopped':
          stopScraping()
          if (shouldShowToast) {
            toast.info('Scraping stopped')
          }
          if (discordEnabled) {
            DiscordRPCService.clearActivity()
          }
          break
      }
    })

    return cleanup
  }, [doNotDisturb, notificationSettings, discordEnabled, startScraping, pauseScraping, resumeScraping, stopScraping, updateProgress, updateStatus, addLog])

  return null
}