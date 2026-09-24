'use client'

import { useMemo, useState } from 'react'
import { markNotificationRead } from './markRead'

type NotificationItem = {
  id: string
  message: string
  is_read: boolean
  created_at: string
}

type NotificationBellProps = {
  initialNotifications: NotificationItem[]
}

function formatRelativeTime(timestamp: string) {
  const value = new Date(timestamp).getTime()
  const diffMs = Date.now() - value
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function NotificationBell({ initialNotifications }: NotificationBellProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isOpen, setIsOpen] = useState(false)

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [notifications],
  )

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  const handleNotificationClick = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, is_read: true } : notification,
      ),
    )

    await markNotificationRead(notificationId)
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
          </div>

          {sortedNotifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {sortedNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification.id)}
                  className={`flex w-full items-start gap-2 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    notification.is_read ? 'text-slate-600' : 'bg-slate-50 text-slate-900'
                  }`}
                >
                  <span
                    className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                      notification.is_read ? 'bg-transparent' : 'bg-slate-900'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">
                    <span className={`block text-sm ${notification.is_read ? 'font-medium' : 'font-semibold'}`}>
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
