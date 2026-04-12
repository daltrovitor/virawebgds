"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CheckoutCancelledPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Pagamento cancelado</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-3xl">⚠</span>
            </div>
            <p className="text-lg font-semibold text-foreground">Você cancelou o pagamento</p>
            <p className="text-muted-foreground">Não se preocupe, você pode tentar novamente quando quiser.</p>
            <Button onClick={() => router.push("/")} className="mt-4">
              Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
