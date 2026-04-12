"use client"

import { useFCM } from "@/hooks/use-fcm"

export function FCMHandler() {
    useFCM()
    return null
}
