"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, Bell, Plus, Loader2, Trash2, CheckCircle2, PlayCircle } from "lucide-react"
import { createReminder, getReminders, deleteReminder, type Reminder } from "@/app/actions/reminders"
import { useToast } from "@/hooks/use-toast"
import { useFCM } from "@/hooks/use-fcm"
import { useTranslations, useLocale } from "next-intl"

export default function RemindersTab({ isDemo = false }: { isDemo?: boolean }) {
    const t = useTranslations('dashboard.reminders')
    const locale = useLocale()
    const [reminders, setReminders] = useState<Reminder[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [datePart, setDatePart] = useState("")
    const [timePart, setTimePart] = useState("")
    const { toast } = useToast()
    const { token: fcmToken } = useFCM()

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        if (isDemo) {
            setReminders([
                {
                    id: "1",
                    user_id: "demo",
                    title: "Atender paciente Maria",
                    description: "Retorno da Maria Silva",
                    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
                    sent: false,
                    created_at: new Date().toISOString()
                }
            ])
            setLoading(false)
            return
        }

        try {
            const data = await getReminders()
            setReminders(data)
        } catch (error) {
            console.error("Failed to load reminders", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateReminder = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !datePart || !timePart) {
            toast({ title: t('toast.fillFields'), variant: "destructive" })
            return
        }

        const scheduledAt = new Date(`${datePart}T${timePart}`)
        if (scheduledAt.getTime() < Date.now()) {
            toast({ title: t('toast.futureDate'), variant: "destructive" })
            return
        }

        setSubmitting(true)
        try {
            if (!isDemo) {
                await createReminder(title, description, scheduledAt)
            } else {
                setReminders(prev => [...prev, {
                    id: Math.random().toString(),
                    user_id: "demo",
                    title,
                    description,
                    scheduled_at: scheduledAt.toISOString(),
                    sent: false,
                    created_at: new Date().toISOString()
                }])
            }
            toast({ title: t('toast.created') })
            setTitle("")
            setDescription("")
            setDatePart("")
            setTimePart("")
            if (!isDemo) await loadData()
        } catch (error) {
            toast({ title: t('toast.createError'), variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (isDemo) {
            setReminders(reminders.filter(r => r.id !== id))
            return
        }
        try {
            await deleteReminder(id)
            setReminders(reminders.filter(r => r.id !== id))
            toast({ title: t('toast.deleted') })
        } catch (error) {
            toast({ title: t('toast.deleteError'), variant: "destructive" })
        }
    }

    if (loading) {
        return <div className="flex p-12 justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        {t('title')}
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold px-2 py-0.5">{t('badgeNew')}</Badge>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
                </div>
            </div>

            {!fcmToken && (
                <Card className="p-4 bg-orange-50 border-orange-200 shadow-sm flex items-start gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-full mt-0.5">
                        <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-orange-900">Ative as Notificações</h4>
                        <p className="text-xs text-orange-700/80 mt-0.5 mb-2 max-w-md">
                            Receba alertas sobre seus compromissos e lembretes diretamente no seu navegador. 
                            Certifique-se de permitir notificações quando solicitado.
                        </p>
                    </div>
                </Card>
            )}

            <Card className="p-4 bg-blue-50 border-blue-100 shadow-sm flex items-start gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-full mt-0.5">
                    <PlayCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-blue-900">{t('tutorialTitle') || "Tutorial do Aplicativo"}</h4>
                    <p className="text-xs text-blue-700/80 mt-0.5 mb-2 max-w-md">
                        {t('tutorialDesc') || "Aprenda como instalar o ViraWeb no seu celular para receber lembretes mesmo com o app fechado e ter um acesso muito mais rápido."}
                    </p>
                    <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600 font-bold text-xs"
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('vwd:goto_tab', { detail: 'tutorial' }))
                        }}
                    >
                        {t('tutorialBtn') || "Ver Tutorial do App →"}
                    </Button>
                </div>
            </Card>


            <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Create Form */}
                <Card className="p-8">
                    <form onSubmit={handleCreateReminder} className="space-y-6">
                        <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            {t('formTitle')}
                        </h3>
                        <div>
                            <Label className="text-base">{t('formSubject')}</Label>
                            <Input 
                                placeholder={t('formSubjectPlaceholder')} 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                required 
                                maxLength={60}
                                className="h-11 mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-base">{t('formDetails')}</Label>
                            <Input 
                                placeholder={t('formDetailsPlaceholder')} 
                                value={description} 
                                onChange={e => setDescription(e.target.value)}
                                maxLength={100}
                                className="h-11 mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <Label className="text-base">{t('formDate')}</Label>
                                <div className="relative mt-1">
                                    <Input 
                                        type="date"
                                        value={datePart}
                                        onChange={e => setDatePart(e.target.value)}
                                        required
                                        className="pl-9 h-11 text-sm"
                                    />
                                    <CalendarIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-base">{t('formTime')}</Label>
                                <div className="relative mt-1">
                                    <Input 
                                        type="time"
                                        value={timePart}
                                        onChange={e => setTimePart(e.target.value)}
                                        required
                                        className="pl-9 h-11 text-sm"
                                    />
                                    <Clock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-12 mt-2 bg-primary text-white font-bold text-base shadow-md" disabled={submitting}>
                            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : t('formSubmit')}
                        </Button>
                    </form>
                </Card>

                {/* List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Bell className="w-5 h-5 text-slate-400" />
                        {t('listTitle')} ({reminders.filter(r => !r.sent).length})
                    </h3>
                    <div className="space-y-3">
                        {reminders.length === 0 && (
                            <div className="p-8 text-center bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm font-medium text-slate-500">{t('listEmpty')}</p>
                            </div>
                        )}
                        {reminders.map(reminder => (
                            <Card key={reminder.id} className={`p-4 flex gap-4 transition-colors ${reminder.sent ? "opacity-50 bg-slate-50 border-slate-100" : ""}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={`text-sm font-bold truncate ${reminder.sent ? "line-through text-slate-500" : "text-slate-900"}`}>
                                            {reminder.title}
                                        </h4>
                                        {reminder.sent && <Badge variant="secondary" className="text-[9px] h-4">{t('badgeSent')}</Badge>}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mb-3">{reminder.description}</p>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">
                                            <CalendarIcon className="w-3.5 h-3.5" />
                                            {new Date(reminder.scheduled_at).toLocaleDateString(locale)}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(reminder.scheduled_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: locale === 'en' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-start">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDelete(reminder.id)}
                                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
