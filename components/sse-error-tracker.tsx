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

    console.log('[SSEErrorTracker] Starting subscription for instanceId:', instanceId)
    setIsConnected(true)

    subscriptionRef.current = subscribeToFsmInstanceEvents(
      instanceId,
      (data: any) => {
        console.log('[SSEErrorTracker] Received data:', data);
        
        // Приоритет 1: event_type (новый формат)
        if (data.event_type === "error") {
          // Обработка ошибки - показываем значение из data.message или data.data
          const errorMessage = data.message || data.data || "Unknown error"
          console.log('[SSEErrorTracker] Setting error:', errorMessage)
          setLastError(errorMessage)
          setSuccess(false)
          setSuccessMessage("")
        } else if (data.event_type === "success") {
          // Обработка успеха - показываем значение из data.message или data.data
          const successMsg = data.message || data.data || (language === "ru" ? "Успех" : "Success")
          console.log('[SSEErrorTracker] Setting success:', successMsg)
          setSuccess(true)
          setLastError(null)
          setSuccessMessage(successMsg)
        }
        // Приоритет 2: last_error (старый формат)
        else if (data.last_error && data.last_error !== "") {
          console.log('[SSEErrorTracker] Setting last_error:', data.last_error)
          setLastError(data.last_error)
          setSuccess(false)
          setSuccessMessage("")
        }
        // Приоритет 3: fsm_state
        else if (data.fsm_state === "COMPLETED" || data.fsm_state === "SUCCESS") {
          console.log('[SSEErrorTracker] Setting success from fsm_state')
          setSuccess(true)
          setLastError(null)
          setSuccessMessage(language === "ru" ? "Успех" : "Success")
        }
        // Приоритет 4: message как текст ошибки (если нет event_type)
        else if (data.message && !data.event_type) {
          console.log('[SSEErrorTracker] Setting message as error:', data.message)
          setLastError(data.message)
          setSuccess(false)
          setSuccessMessage("")
        }
      },
      (error: string) => {
        console.log('[SSEErrorTracker] SSE error callback:', error);
        setLastError(error)
        setSuccess(false)
        setSuccessMessage("")
        setIsConnected(false)
      }
    )

    return () => {
      console.log('[SSEErrorTracker] Cleaning up subscription')
      if (subscriptionRef.current) {
        subscriptionRef.current.close()
      }
    }
  }, [instanceId, language])

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
