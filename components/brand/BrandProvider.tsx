"use client"

import { createContext, useContext, type ReactNode } from "react"

import { applyBrand, type AppliedBrand } from "@/lib/white-label/brand"

const BrandContext = createContext<AppliedBrand>(applyBrand(null))

export function BrandProvider({ brand, children }: { brand: AppliedBrand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useBrand(): AppliedBrand {
  return useContext(BrandContext)
}
