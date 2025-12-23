"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/language-context"

const mockTests = [
  {
    id: 1,
    name: "Client creates order",
    status: "success",
    progress: "5/5",
    steps: [
      { role: "client", action: "create_order" },
      { role: "operator", action: "assign_courier" },
      { role: "courier", action: "take_order" },
      { role: "courier", action: "place_in_cell" },
      { role: "recipient", action: "pickup_from_locker" },
    ],
  },
  {
    id: 2,
    name: "FSM: reserve_cell on order",
    status: "in_progress",
    progress: "2/4",
    steps: [
      { entity_type: "order", action: "reserve_cell" },
      { entity_type: "order", action: "assign_courier" },
      { entity_type: "order", action: "pickup_from_cell" },
      { entity_type: "order", action: "confirm_delivery" },
    ],
  },
  { id: 3, name: "Driver bulk delivery", status: "error", progress: "3/6", steps: [] },
]

interface TestQueueProps {
  setCurrentTest: (test: any) => void
  addLog: (log: any) => void
}

export function TestQueue({ setCurrentTest, addLog }: TestQueueProps) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTest, setSelectedTest] = useState<any>(mockTests[0])
  const [addTestOpen, setAddTestOpen] = useState(false)
  const { t } = useLanguage()

  const filteredTests = mockTests.filter((test) => {
    if (statusFilter !== "all" && test.status !== statusFilter) return false
    if (searchTerm && !test.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      success: "default",
      in_progress: "secondary",
      error: "destructive",
    }
    const labels: Record<string, string> = {
      success: t.testQueue.success,
      in_progress: t.testQueue.inProgress,
      error: t.testQueue.error,
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const handleRunStep = () => {
    console.log("[API] Running single step of test", selectedTest.id)
    addLog({
      role: "Test Runner",
      action: `Execute step from test: ${selectedTest.name}`,
      statusBefore: "N/A",
      statusAfter: "N/A",
      result: "OK",
    })
  }

  const handleRunTest = () => {
    console.log("[API] Running full test", selectedTest.id)
    setCurrentTest(selectedTest)
    addLog({
      role: "Test Runner",
      action: `Execute full test: ${selectedTest.name}`,
      statusBefore: "N/A",
      statusAfter: "N/A",
      result: "OK",
    })
  }

  return (
    <div className="h-full flex overflow-hidden">
      <Card className="flex-1 flex flex-col mr-2">
        <CardHeader>
          <CardTitle>{t.testQueue.title}</CardTitle>
          <div className="flex gap-2 mt-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t.testQueue.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.testQueue.allStatus}</SelectItem>
                <SelectItem value="success">{t.testQueue.success}</SelectItem>
                <SelectItem value="in_progress">{t.testQueue.inProgress}</SelectItem>
                <SelectItem value="error">{t.testQueue.error}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t.testQueue.allTypes} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.testQueue.allTypes}</SelectItem>
                <SelectItem value="normal">{t.testQueue.normal}</SelectItem>
                <SelectItem value="fsm">{t.testQueue.fsm}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t.testQueue.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleRunStep}>
              <span className="mr-1">▶</span>
              {t.testQueue.runStep}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleRunTest}>
              <span className="mr-1">⏯</span>
              {t.testQueue.runTest}
            </Button>
            <Dialog open={addTestOpen} onOpenChange={setAddTestOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  {t.testQueue.addTest}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.testQueue.addNewTest}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-name">{t.testQueue.testName}</Label>
                    <Input id="test-name" placeholder={t.testQueue.enterTestName} />
                  </div>
                  <div>
                    <Label htmlFor="test-description">{t.testQueue.description}</Label>
                    <Textarea id="test-description" placeholder={t.testQueue.enterDescription} />
                  </div>
                  <div>
                    <Label htmlFor="test-json">{t.testQueue.testJson}</Label>
                    <Textarea
                      id="test-json"
                      placeholder='[{"role": "client", "action": "create_order"}]'
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button onClick={() => setAddTestOpen(false)}>{t.testQueue.createTest}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t.testQueue.name}</TableHead>
                <TableHead>{t.testQueue.status}</TableHead>
                <TableHead>{t.testQueue.progress}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTests.map((test) => (
                <TableRow
                  key={test.id}
                  className={`cursor-pointer hover:bg-muted/50 ${selectedTest?.id === test.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedTest(test)}
                >
                  <TableCell>{test.id}</TableCell>
                  <TableCell className="font-medium">{test.name}</TableCell>
                  <TableCell>{getStatusBadge(test.status)}</TableCell>
                  <TableCell>{test.progress}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="w-[300px] flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">{t.testQueue.testDetails}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {selectedTest ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t.testQueue.name}</p>
                <p className="text-sm">{selectedTest.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t.testQueue.description}</p>
                <p className="text-sm">
                  {t.testQueue.automatedTest} {selectedTest.name.toLowerCase()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t.testQueue.testJson}</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[300px]">
                  {JSON.stringify(selectedTest.steps, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.testQueue.selectTest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
