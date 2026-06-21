'use client'

import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Share08Icon, Tick02Icon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { buildReferralLink } from '@/lib/referral-link'

export function ReferralCard(props: { code: string; reward: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const codeAvailable = Boolean(props.code && props.code.trim().length > 0)
  const { toast } = useToast()

  useEffect(() => {
    if (copyState !== 'copied') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1500)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  const handleCopy = async () => {
    if (!codeAvailable || copyState === 'copied') return

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
    const referralLink = buildReferralLink(props.code)
    const shareText = `Join me on StableTask and earn cUSD! Use my code ${props.code} or just open: ${referralLink}`

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
        <button
          type="button"
          disabled={!codeAvailable || copyState === 'copied'}
          onClick={handleCopy}
          aria-label="Copy referral code"
          className={`group min-w-0 flex-1 rounded-xl border border-dashed px-4 py-3 text-left text-sm font-black transition-colors disabled:cursor-default ${
            copyState === 'copied'
              ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-100'
              : codeAvailable
                ? 'border-lime-300/35 bg-slate-900/75 text-lime-100 hover:border-lime-300/55 hover:bg-slate-900/90 active:scale-[0.98]'
                : 'border-slate-700/40 bg-slate-900/50 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{codeAvailable ? props.code : 'No referral code yet'}</span>
            {codeAvailable && (
              <HugeiconsIcon
                aria-hidden="true"
                icon={copyState === 'copied' ? Tick02Icon : Copy01Icon}
                size={14}
                strokeWidth={2}
                className={`shrink-0 transition-colors ${
                  copyState === 'copied' ? 'text-emerald-300' : 'text-lime-400/50 group-hover:text-lime-300'
                }`}
              />
            )}
          </div>
        </button>
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
        </div>
      </CardContent>
    </Card>
  )
}
