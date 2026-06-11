'use client'

import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Share08Icon, Tick02Icon } from '@hugeicons/core-free-icons'

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
    <Card className="game-panel-strong rounded-[1.25rem] py-5">
      <CardHeader>
        <div className="text-lg font-black text-slate-50">Referral Boost</div>
        <div className="text-sm text-slate-400">
          Share your code and earn {props.reward} cUSD per friend.
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0 rounded-xl border border-dashed border-lime-300/35 bg-slate-900/75 px-4 py-3 text-sm font-black text-lime-100">
          <div className="truncate">{codeAvailable ? props.code : 'No referral code yet'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!codeAvailable}
            onClick={handleShare}
            className="h-11 gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 hover:bg-cyan-300/16"
          >
            <HugeiconsIcon aria-hidden="true" icon={Share08Icon} size={16} strokeWidth={2} />
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!codeAvailable}
            onClick={handleCopy}
            className={`h-11 gap-1.5 rounded-xl border px-4 text-sm font-bold transition-colors ${
              copyState === 'copied'
                ? 'border-emerald-300/40 bg-emerald-300/12 text-emerald-100'
                : 'border-lime-300/25 bg-lime-300/12 text-lime-100 hover:bg-lime-300/18'
            }`}
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={copyState === 'copied' ? Tick02Icon : Copy01Icon}
              size={16}
              strokeWidth={2}
            />
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
