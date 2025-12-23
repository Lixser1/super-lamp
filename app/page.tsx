"use client"

import { useState } from "react"
import { RoleEmulator } from "@/components/role-emulator"
import { ParcelLockerSchema } from "@/components/parcel-locker-schema"
import { TestQueue } from "@/components/test-queue"
import { LogsPanel } from "@/components/logs-panel"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { LanguageProvider, useLanguage } from "@/lib/language-context"
import { Button } from "@/components/ui/button"
import { EyeOff, Eye } from "lucide-react"

function TestInterfaceContent() {
  const [logs, setLogs] = useState<any[]>([])
  const [currentTest, setCurrentTest] = useState<any>(null)
  const [currentMode, setCurrentMode] = useState<"create" | "run">("create")
  const [activeTab, setActiveTab] = useState<string>("client")
  const { language, setLanguage, t } = useLanguage()

  const [panelsVisible, setPanelsVisible] = useState({
    roles: true,
    lockers: false,
    tests: false,
  })

  const togglePanel = (panel: keyof typeof panelsVisible) => {
    const visibleCount = Object.values(panelsVisible).filter(Boolean).length
    // Don't hide if it's the last visible panel
    if (visibleCount === 1 && panelsVisible[panel]) {
      return
    }
    setPanelsVisible((prev) => ({ ...prev, [panel]: !prev[panel] }))
  }

  const addLog = (log: any) => {
    setLogs((prev) => [...prev, { ...log, step: prev.length + 1, timestamp: new Date().toISOString() }])
  }

  const visiblePanelCount = Object.values(panelsVisible).filter(Boolean).length
  const defaultSize = 100 / visiblePanelCount

  return (
    <div className="h-screen w-full bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{t.header.title}</h1>
            <p className="text-sm text-muted-foreground">{t.header.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {!panelsVisible.roles && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => togglePanel("roles")}
                title={language === "en" ? "Show Roles" : "Показать Роли"}
              >
                <Eye className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{language === "en" ? "Roles" : "Роли"}</span>
              </Button>
            )}
            {!panelsVisible.lockers && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => togglePanel("lockers")}
                title={language === "en" ? "Show Lockers" : "Показать Постаматы"}
              >
                <Eye className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{language === "en" ? "Lockers" : "Постаматы"}</span>
              </Button>
            )}
            {!panelsVisible.tests && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => togglePanel("tests")}
                title={language === "en" ? "Show Tests" : "Показать Тесты"}
              >
                <Eye className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{language === "en" ? "Tests" : "Тесты"}</span>
              </Button>
            )}
            <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>
              EN
            </Button>
            <Button variant={language === "ru" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ru")}>
              RU
            </Button>
          </div>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-88px)]">
        {panelsVisible.roles && (
          <>
            <ResizablePanel defaultSize={defaultSize} minSize={20}>
              <div className="relative h-full">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 z-10 h-7 w-7"
                  onClick={() => togglePanel("roles")}
                  title={language === "en" ? "Hide panel" : "Скрыть панель"}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
                <RoleEmulator
                  addLog={addLog}
                  currentTest={currentTest}
                  onModeChange={setCurrentMode}
                  onTabChange={setActiveTab}
                />
              </div>
            </ResizablePanel>
            {(panelsVisible.lockers || panelsVisible.tests) && <ResizableHandle withHandle />}
          </>
        )}

        {panelsVisible.lockers && (
          <>
            <ResizablePanel defaultSize={defaultSize} minSize={20}>
              <div className="relative h-full">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 z-10 h-7 w-7"
                  onClick={() => togglePanel("lockers")}
                  title={language === "en" ? "Hide panel" : "Скрыть панель"}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
                <ParcelLockerSchema mode={currentMode} activeTab={activeTab} addLog={addLog} />
              </div>
            </ResizablePanel>
            {panelsVisible.tests && <ResizableHandle withHandle />}
          </>
        )}

        {panelsVisible.tests && (
          <ResizablePanel defaultSize={defaultSize} minSize={20}>
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10 h-7 w-7"
                onClick={() => togglePanel("tests")}
                title={language === "en" ? "Hide panel" : "Скрыть панель"}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={45} minSize={30}>
                  <TestQueue setCurrentTest={setCurrentTest} addLog={addLog} />
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={55} minSize={30}>
                  <LogsPanel logs={logs} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  )
}

export default function TestInterface() {
  return (
    <LanguageProvider>
      <TestInterfaceContent />
    </LanguageProvider>
  )
}
