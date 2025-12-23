"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/language-context"

interface LogsPanelProps {
  logs: any[]
}

export function LogsPanel({ logs }: LogsPanelProps) {
  const [roleFilter, setRoleFilter] = useState("all")
  const [resultFilter, setResultFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const { t } = useLanguage()

  const filteredLogs = logs.filter((log) => {
    if (roleFilter !== "all" && log.role !== roleFilter) return false
    if (resultFilter !== "all" && log.result !== resultFilter) return false
    if (searchTerm && !log.action.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const handleExport = () => {
    console.log("[Export] Exporting logs to CSV", logs)
  }

  const mockErrors = [
    {
      errorTime: "2025-10-24 11:00:00",
      errorMessage: "Cell already occupied",
      entityType: "order",
      entityId: 5,
      actionName: "reserve_cell",
    },
    {
      errorTime: "2025-10-24 11:15:00",
      errorMessage: "Courier not available",
      entityType: "stage_order",
      entityId: 2,
      actionName: "assign_courier",
    },
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{t.logs.title}</CardTitle>
        <Tabs defaultValue="actions" className="w-full">
          <TabsList>
            <TabsTrigger value="actions">{t.logs.actionLogs}</TabsTrigger>
            <TabsTrigger value="errors">{t.logs.fsmErrors}</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-2">
            <div className="flex gap-2 mb-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t.logs.role} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.logs.allRoles}</SelectItem>
                  <SelectItem value="client">{t.roles.client}</SelectItem>
                  <SelectItem value="recipient">{t.roles.recipient}</SelectItem>
                  <SelectItem value="courier">{t.roles.courier}</SelectItem>
                  <SelectItem value="driver">{t.roles.driver}</SelectItem>
                  <SelectItem value="operator">{t.roles.operator}</SelectItem>
                  <SelectItem value="FSM">FSM</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t.logs.result} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.logs.allResults}</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                  <SelectItem value="Error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={t.logs.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={handleExport}>
                <span className="mr-1">⬇</span>
                {t.logs.export}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="mt-2">
            <p className="text-sm text-muted-foreground">{t.logs.fsmErrorsDesc}</p>
          </TabsContent>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Tabs defaultValue="actions" className="h-full">
          <TabsContent value="actions" className="h-full mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.logs.step}</TableHead>
                  <TableHead>{t.logs.role}</TableHead>
                  <TableHead>{t.logs.action}</TableHead>
                  <TableHead>{t.logs.statusBefore}</TableHead>
                  <TableHead>{t.logs.statusAfter}</TableHead>
                  <TableHead>{t.logs.result}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t.logs.noLogs}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{log.step}</TableCell>
                      <TableCell className="font-medium">{log.role}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.statusBefore}</TableCell>
                      <TableCell>{log.statusAfter}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            log.result === "OK" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {log.result}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="errors" className="h-full mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.logs.time}</TableHead>
                  <TableHead>{t.logs.errorMessage}</TableHead>
                  <TableHead>{t.logs.entityType}</TableHead>
                  <TableHead>{t.logs.entityId}</TableHead>
                  <TableHead>{t.logs.action}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockErrors.map((error, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{error.errorTime}</TableCell>
                    <TableCell className="font-medium text-destructive">{error.errorMessage}</TableCell>
                    <TableCell>{error.entityType}</TableCell>
                    <TableCell>{error.entityId}</TableCell>
                    <TableCell>{error.actionName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
