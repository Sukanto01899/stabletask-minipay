'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'

export function ReferralCard(props: { code: string; reward: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const codeAvailable = Boolean(props.code && props.code.trim().length > 0)
  const { toast } = useToast()

  useEffect(() => {
    if (copyState !== 'copied') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1600)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  const handleCopy = async () => {
    if (!codeAvailable) return

    try {
      await copyText(props.code)
      setCopyState('copied')
      toast({ title: 'Copied', description: 'Referral code copied.', variant: 'success' })
    } catch {
      setCopyState('failed')
      toast({ title: 'Copy failed', description: 'Could not copy referral code.', variant: 'error' })
    }
  }

  const handleShare = async () => {
    if (!codeAvailable) return
    const shareText = `Use my StableTask referral code: ${props.code}`

    try {
      const nav = navigator as Navigator & {
        share?: (data: { text?: string; title?: string }) => Promise<void>
        canShare?: (data: { text?: string; title?: string }) => boolean
      }

      if (nav.share && (!nav.canShare || nav.canShare({ text: shareText }))) {
        await nav.share({ title: 'StableTask referral', text: shareText })
        toast({ title: 'Shared', description: 'Referral shared.', variant: 'success' })
        return
      }

      await copyText(shareText)
      toast({ title: 'Copied', description: 'Share text copied (share sheet unavailable).', variant: 'success' })
    } catch (error) {
      console.error('Share failed:', error)
      try {
        await copyText(shareText)
        toast({ title: 'Copied', description: 'Share text copied.', variant: 'success' })
      } catch {
        toast({ title: 'Share failed', description: 'Could not share or copy.', variant: 'error' })
      }
    }
  }

  return (
    <Card className="rounded-[1.75rem] border border-blue-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(219,234,254,0.96))] py-5 shadow-[0_18px_50px_rgba(59,130,246,0.12)]">
      <CardHeader>
        <div className="text-lg font-semibold text-slate-950">Referral Boost</div>
        <div className="text-sm text-slate-600">
          Share your code and earn {props.reward} cUSD per friend.
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0 rounded-2xl border border-dashed border-blue-300 bg-white/80 px-4 py-3 text-sm font-semibold text-blue-800">
          <div className="truncate">{codeAvailable ? props.code : 'No referral code yet'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!codeAvailable}
            onClick={handleShare}
            className="h-11 rounded-2xl px-4 text-sm font-semibold"
          >
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!codeAvailable}
            onClick={handleCopy}
            className="h-11 rounded-2xl px-4 text-sm font-semibold"
          >
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
