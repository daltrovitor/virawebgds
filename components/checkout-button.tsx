"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { startCheckoutSession } from "@/app/actions/stripe"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

import { useTranslations } from 'next-intl'

interface CheckoutButtonProps {
  planType: "basic" | "premium" | "master"
  children: React.ReactNode
  className?: string
  variant?: "default" | "outline" | "ghost"
}

export default function CheckoutButton({ planType, children, className, variant = "default" }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('onboarding')

  const handleCheckout = async () => {
    setIsLoading(true)
    try {
      const checkoutUrl = await startCheckoutSession(planType)
      window.location.href = checkoutUrl
    } catch (error) {
      console.error(" Checkout error:", error)
      toast({
        title: t('error'),
        description: t('tryAgainLater'),
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleCheckout} disabled={isLoading} className={className} variant={variant}>
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {t('loading')}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
