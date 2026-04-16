"use client"
import { useEffect, useState, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { subscribeToFsmInstanceEvents } from "@/lib/api"

interface SSEErrorTrackerProps {
  instanceId: number | null
  language: string
  onClear: () => void
}

export function SSEErrorTracker({ instanceId, language, onClear }: SSEErrorTrackerProps) {
  const [lastError, setLastError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>("")
  const subscriptionRef = useRef<any>(null)

  useEffect(() => {
    if (!instanceId) {
      if (subscriptionRef.current) {
        subscriptionRef.current.close()
        subscriptionRef.current = null
      }
      setLastError(null)
      setIsConnected(false)
      setSuccess(false)
      setSuccessMessage("")
      return
    }

    subscriptionRef.current = subscribeToFsmInstanceEvents(
      instanceId,
      (data) => {
        if (data.event_type === "error") {
          // Обработка ошибки
          setLastError(data.message || "Unknown error")
          setSuccess(false)
          setSuccessMessage("")
        } else if (data.event_type === "success") {
          // Обработка успеха
          setSuccess(true)
          setLastError(null)
          setSuccessMessage(data.message || "Process completed successfully")
        }
        // Fallback для старого формата (если еще приходят last_error/fsm_state)
        else if (data.last_error && data.last_error !== "") {
          setLastError(data.last_error)
          setSuccess(false)
          setSuccessMessage("")
        } else if (data.fsm_state === "COMPLETED" || data.fsm_state === "SUCCESS") {
          setSuccess(true)
          setLastError(null)
          setSuccessMessage("Process completed successfully")
        }
      },
      (error) => {
        setLastError(error)
        setSuccess(false)
        setSuccessMessage("")
        setIsConnected(false)
      }
    )

    setIsConnected(true)

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close()
      }
    }
  }, [instanceId])

  if (!instanceId) return null

  return (
    <div className="flex items-center gap-2 mt-2">
      {isConnected && !lastError && !success && (
        <Badge variant="outline" className="text-xs" onClick={onClear}>
          <span className="animate-pulse mr-2">●</span>
          {language === "ru" ? "Ожидание..." : "Waiting..."} ✕
        </Badge>
      )}
      {success && (
        <Badge variant="default" className="bg-green-600 cursor-pointer text-xs" onClick={onClear}>
          {successMessage || (language === "ru" ? "Успех" : "Success")} ✕
        </Badge>
      )}
      {lastError && (
        <Badge variant="destructive" className="text-xs cursor-pointer" onClick={onClear}>
          {lastError} ✕
        </Badge>
      )}
    </div>
  )
}
