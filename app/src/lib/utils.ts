import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SATELLITE_LABELS: Record<string, string> = {
  N: "Suomi NPP",
  N20: "NOAA-20",
  N21: "NOAA-21",
  Aqua: "Aqua",
  Terra: "Terra",
}

export function satelliteLabel(code: string | null | undefined): string {
  if (code === null || code === undefined) return ""
  const trimmed = code.trim()
  return SATELLITE_LABELS[trimmed] ?? code
}

const PRODUCT_LABELS: Record<string, string> = {
  NRT: "NRT (Near Real-Time)",
  SP: "SP (Standard)",
}

export function productLabel(code: string | null | undefined): string {
  if (code === null || code === undefined) return ""
  const trimmed = code.trim()
  return PRODUCT_LABELS[trimmed] ?? code
}
