import { useState } from 'react'
import { toast } from 'sonner'
import { invokeEdge } from '@/api/edge'

// Drives the LoomLance subscription flows: start a Stripe Checkout (subscription + trial) and
// open the Stripe Billing Portal. Both hand off to Stripe via a full-page redirect.
export function useBilling() {
  const [loading, setLoading] = useState(null) // e.g. 'freelancer:monthly' | 'portal'

  const startCheckout = async (plan, period) => {
    setLoading(`${plan}:${period}`)
    try {
      const { url } = await invokeEdge('create-subscription-checkout', { plan, period })
      window.location.href = url
    } catch (e) {
      toast.error(e.userMessage || 'Could not start checkout')
      setLoading(null)
    }
  }

  const openPortal = async () => {
    setLoading('portal')
    try {
      const { url } = await invokeEdge('create-billing-portal', {})
      window.location.href = url
    } catch (e) {
      toast.error(e.userMessage || 'Could not open the billing portal')
      setLoading(null)
    }
  }

  return { loading, startCheckout, openPortal }
}
