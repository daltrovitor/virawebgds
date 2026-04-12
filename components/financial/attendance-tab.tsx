"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import MonthlyCalendar from "./monthly-calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Check, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import "react-day-picker/dist/style.css"
import { format } from "date-fns"
import { ptBR, enUS } from "date-fns/locale"
import { useAttendance } from "@/hooks/use-attendance"
import { getPatients } from "@/app/actions/patients"
import { useTranslations, useLocale } from "next-intl"

interface Patient {
  id: string
  name: string
}

interface AttendanceTabProps {
  patientId?: string
}

export function AttendanceTab({ patientId }: AttendanceTabProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string | null>(patientId || null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<"present" | "absent" | "late" | "cancelled">("present")
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | "debit" | "pix" | "transfer">("cash")
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "cancelled">("pending")
  const { toast } = useToast()
  const tAtt = useTranslations("dashboard.attendance")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const dateLocale = locale === "en" ? enUS : ptBR

  const {
    records,
    stats,
    loading,
    error,
    appointments,
    isDateScheduled,
    updateAttendance,
    loadAttendance
  } = useAttendance(selectedPatient)

  // Reload attendance when payments change elsewhere in the app
  useEffect(() => {
    const handler = (e: any) => {
      if (!selectedPatient) return
      try {
        const pid = e?.detail?.patientId
        if (pid && pid === selectedPatient) {
          loadAttendance()
        }
      } catch (ex) {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('payment-changed', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('payment-changed', handler as EventListener)
      }
    }
  }, [selectedPatient, loadAttendance])

  useEffect(() => {
    if (!patientId) {
      const loadPatients = async () => {
        try {
          const data = await getPatients()
          setPatients(data || [])
        } catch (error) {
          toast({
            title: tAtt("toast.loadPatientsError"),
            description: error instanceof Error ? error.message : tAtt("toast.loadPatientsError"),
            variant: "destructive"
          })
        }
      }
      loadPatients()
    }
  }, [patientId, toast])

  useEffect(() => {
    if (error) {
      toast({
        title: tAtt("toast.loadAttendanceError"),
        description: error,
        variant: "destructive"
      })
    }
  }, [error, toast])

  // Quando o diálogo fecha, limpar a data selecionada para permitir que o
  // usuário clique novamente no mesmo dia e reabra o diálogo sem precisar
  // atualizar a página.
  useEffect(() => {
    if (!showDialog) {
      setSelectedDate(undefined)
    }
  }, [showDialog])

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return

    // Allow editing an existing attendance record even if there is no
    // scheduled appointment for that date. If there is no existing
    // record, only allow creating a new one on scheduled dates.
    const existingRecord = records.find(r =>
      format(new Date(r.sessionDate), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    )

    if (!existingRecord && !isDateScheduled(date)) {
      toast({
        title: tAtt("toast.invalidDate"),
        description: tAtt("toast.invalidDateDesc"),
        variant: "destructive"
      })
      return
    }

    setSelectedDate(date)
    if (existingRecord) {
      setStatus(existingRecord.status)
      setNotes(existingRecord.notes || "")
      if (existingRecord.payment) {
        setAmount(existingRecord.payment.amount)
        setPaymentMethod(existingRecord.payment.method)
        setPaymentStatus(existingRecord.payment.status)
      } else {
        setAmount(0)
        setPaymentMethod("cash")
        setPaymentStatus("paid")
      }
    } else {
      setStatus("present")
      setNotes("")
      setAmount(0)
      setPaymentMethod("cash")
      // Default new attendance payment status to 'pending' so it won't
      // be counted as paid until a payment record with status 'paid'
      // exists.
      setPaymentStatus("pending")
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!selectedDate || !selectedPatient) return
    setSaving(true)
    try {
      const data: any = {
        status,
        notes
      }

      // Só inclui dados de pagamento se o status for "present"
      if (status === "present" && amount > 0) {
        data.payment = {
          amount,
          method: paymentMethod,
          status: paymentStatus,
          paymentDate: selectedDate
        }
      }

      await updateAttendance(selectedDate, data)
      setShowDialog(false)
      // limpar seleção para permitir reabrir o mesmo dia sem refresh
      setSelectedDate(undefined)
      toast({
        title: tAtt("toast.success"),
        description: tAtt("toast.successDesc")
      })
    } catch (error) {
      toast({
        title: tAtt("toast.saveError"),
        description: error instanceof Error ? error.message : tAtt("toast.saveError"),
        variant: "destructive"
      })
    }
    finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-700"
      case "absent":
        return "bg-red-100 text-red-700"
      case "late":
        return "bg-yellow-100 text-yellow-700"
      case "cancelled":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <Check className="w-4 h-4" />
      case "absent":
        return <XCircle className="w-4 h-4" />
      case "late":
        return <Clock className="w-4 h-4" />
      case "cancelled":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {!patientId && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{tAtt("title")}</h3>
            </div>
            <Select value={selectedPatient || ""} onValueChange={setSelectedPatient}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tAtt("selectPatient")} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {selectedPatient && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">{tAtt("attendanceRate")}</p>
                <p className="text-2xl font-bold">{stats.attendanceRate.toFixed(1)}%</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">{tAtt("totalSessions")}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">{tAtt("paidSessions")}</p>
                <p className="text-2xl font-bold">{stats.paid}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">{tAtt("absences")}</p>
                <p className="text-2xl font-bold">{stats.absent + stats.cancelled}</p>
              </Card>
            </div>
          )}

          {/* Calendar View */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{tAtt("calendarTitle")}</h3>
            <MonthlyCalendar
              selected={selectedDate}
              onSelect={handleDateSelect}
              scheduledDates={appointments.map(a => a.date)}
            />
          </Card>

          {/* Recent Records */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{tAtt("recentRecords")}</h3>
            <div className="space-y-2">
              {records.slice(0, 5).map(record => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  onClick={() => handleDateSelect(new Date(record.sessionDate))}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStatusColor(record.status)}`}>
                      {getStatusIcon(record.status)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {locale === "en"
                          ? format(new Date(record.sessionDate), "MMMM dd")
                          : format(new Date(record.sessionDate), "dd 'de' MMMM", { locale: dateLocale })}
                      </p>
                      {record.notes && (
                        <p className="text-sm text-muted-foreground">{record.notes}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    {tAtt("edit")}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? `${tAtt("dialogTitle").replace("{date}", locale === "en"
                  ? format(selectedDate, "MMMM dd, yyyy")
                  : format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: dateLocale }))}`
                : tAtt("title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{tAtt("status")}</label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">{tAtt("present")}</SelectItem>
                  <SelectItem value="absent">{tAtt("absent")}</SelectItem>
                  <SelectItem value="late">{tAtt("late")}</SelectItem>
                  <SelectItem value="cancelled">{tAtt("cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === 'present' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{tAtt("payment")}</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm">{tAtt("amount")}</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm">{tAtt("method")}</label>
                      <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{tAtt("cash")}</SelectItem>
                          <SelectItem value="credit">{tAtt("credit")}</SelectItem>
                          <SelectItem value="debit">{tAtt("debit")}</SelectItem>
                          <SelectItem value="pix">{tAtt("pix")}</SelectItem>
                          <SelectItem value="transfer">{tAtt("transfer")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm">{tAtt("paymentStatus")}</label>
                    <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as typeof paymentStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">{tAtt("paid")}</SelectItem>
                        <SelectItem value="pending">{tAtt("pending")}</SelectItem>
                        <SelectItem value="cancelled">{tAtt("cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{tAtt("notes")}</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={tAtt("notesPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setSelectedDate(undefined); }}>
              {tAtt("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tAtt("saving")}
                </>
              ) : (
                tAtt("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
