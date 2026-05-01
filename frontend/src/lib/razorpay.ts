declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string
      subscription_id: string
      name: string
      description: string
      handler: (response: {
        razorpay_payment_id: string
        razorpay_subscription_id: string
        razorpay_signature: string
      }) => void
      modal?: {
        ondismiss?: () => void
      }
      prefill?: {
        name?: string
        email?: string | null
      }
      theme?: {
        color?: string
      }
    }) => { open: () => void }
  }
}

export async function loadRazorpayCheckout() {
  if (window.Razorpay) return window.Razorpay
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'))
    document.head.appendChild(script)
  })

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout is unavailable')
  }
  return window.Razorpay
}
