import { useNotification } from '@/context/NotificationContext'
import { Button } from '@/components/ui/button'
import { X, Bell } from 'lucide-react'

/**
 * NotificationBanner Component
 *
 * Displays a non-blocking banner at the top of the page prompting users to
 * enable browser notifications. Only shown when:
 * - Permission is "default" (not yet granted/denied)
 * - User has not dismissed the banner
 *
 * Provides two actions:
 * - "Enable Notifications" - Requests permission
 * - "Maybe Later" / Close button - Dismisses banner
 *
 * This is preparation for Epic 4 Story 4.3 which will implement actual
 * notification sending.
 */
export function NotificationBanner() {
  const { permissionState, isDismissed, requestPermission, dismissBanner } = useNotification()

  // Handle enable notifications click
  const handleEnable = async () => {
    await requestPermission()
    // Banner will auto-dismiss after request (handled by context)
  }

  // Handle maybe later / dismiss click
  const handleDismiss = () => {
    dismissBanner()
  }

  // Only show banner when permission is "default" and not dismissed
  if (permissionState !== 'default' || isDismissed) {
    return null
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center bg-[#88C0D0] px-4 py-3 text-white shadow-md"
      role="alert"
      aria-live="polite"
    >
      {/* Bell Icon */}
      <Bell className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />

      {/* Message */}
      <div className="flex-1 flex items-center justify-center gap-4">
        <span className="font-medium">Get notified when Claude needs your input</span>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEnable}
            size="sm"
            className="bg-white text-[#88C0D0] hover:bg-gray-100 font-semibold shadow-sm"
          >
            Enable Notifications
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
          >
            Maybe Later
          </Button>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="ml-3 flex-shrink-0 rounded p-1 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#88C0D0]"
        aria-label="Dismiss notification banner"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
