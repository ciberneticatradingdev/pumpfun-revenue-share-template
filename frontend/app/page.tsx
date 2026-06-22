"use client"

import { useState, useEffect } from "react"
import { Home, LayoutDashboard, Users, History, X, Copy, Check, Plus } from "lucide-react"
import Image from "next/image"
import { config } from "@/lib/config"

export default function TokenPage() {
  const [countdown, setCountdown] = useState(300)
  const [copied, setCopied] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev > 0) return prev - 1
        return 300
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(config.tokenCA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const faqItems = [
    {
      question: "DO I NEED TO STAKE OR CLAIM ANYTHING?",
      answer: `No. USDC rewards are automatically distributed to your wallet every 5 minutes. Just hold ${config.tokenName} and receive rewards — no actions required.`
    },
    {
      question: "WHAT IS THE REWARD TOKEN?",
      answer: "Rewards are paid in USDC — the most trusted stablecoin on Solana. Real dollar value, sent directly to your wallet automatically."
    },
    {
      question: "HOW IS MY SHARE CALCULATED?",
      answer: `Your share is proportional to your ${config.tokenName} balance at each 5-minute snapshot relative to total eligible supply. Hold more, earn more.`
    },
    {
      question: "IS THERE A MINIMUM TO QUALIFY?",
      answer: `Yes. You must hold at least 500,000 tokens to qualify for distributions. This filters out dust wallets and keeps gas costs low for everyone.`
    },
    {
      question: "IS THERE A MAXIMUM HOLDING LIMIT?",
      answer: `Yes. To keep rewards fair for all holders, any wallet holding more than 40,000,000 ${config.tokenName} tokens (approximately 4% of supply) is completely excluded from receiving USDC distributions. This ensures rewards are spread across real holders, not concentrated in a few big wallets.`
    }
  ]

  const flowSteps = [
    {
      number: "01",
      title: "TRADE FEES",
      description: `Every buy and sell of ${config.tokenName} generates trading fees that accrue to the distribution vault automatically.`
    },
    {
      number: "02",
      title: "AUTO-COLLECT",
      description: "Every 5 minutes a permissionless on-chain program collects the accumulated fees — no human required."
    },
    {
      number: "03",
      title: "AIRDROP",
      description: "Every eligible wallet is snapshotted and receives USDC in real time."
    }
  ]

  const marqueeText = "★ AUTO USDC DISTRIBUTIONS EVERY 5 MINUTES ● 15% RESERVED FOR GAS ● NO STAKING REQUIRED ● HOLD 500K+ TOKENS TO QUALIFY ● BIG HOLDERS OVER 4% EXCLUDED ● NO CLAIM REQUIRED ● REAL DOLLAR REWARDS ● "

  return (
    <div className="min-h-screen bg-[#060D1F]">
      {/* Header */}
      <header className="border-b-4 border-black bg-[#0D1F3C] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 font-black text-white text-lg tracking-tight">
              {/* Replace this src with your own token logo URL */}
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66578298-cba9-4de5-af8a-2eabfddd5bb4-zk4xO6LZ5xMYuNjjeWCZHMSWsH3RYh.png"
                alt={`${config.tokenName} coin logo`}
                width={32}
                height={32}
                className="border-2 border-black"
              />
              {config.tokenName}
            </a>
            <nav className="hidden sm:flex items-center gap-1">
              <a href="/" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white font-bold text-sm border-2 border-black">
                <Home className="w-4 h-4" />
                HOME
              </a>
              <a href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 text-white font-bold text-sm hover:bg-[#1A3A6E] transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                DASHBOARD
              </a>
              <a href="/holders" className="flex items-center gap-1.5 px-3 py-1.5 text-white font-bold text-sm hover:bg-[#1A3A6E] transition-colors">
                <Users className="w-4 h-4" />
                HOLDERS
              </a>
              <a href="/history" className="flex items-center gap-1.5 px-3 py-1.5 text-white font-bold text-sm hover:bg-[#1A3A6E] transition-colors">
                <History className="w-4 h-4" />
                HISTORY
              </a>
            </nav>
          </div>
          {config.twitterUrl && (
            <a
              href={config.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 bg-black text-white hover:bg-[#2563EB] transition-colors"
              aria-label={`Follow ${config.tokenName} on X`}
            >
              <X className="w-5 h-5" />
            </a>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Hero Section */}
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          {/* Left Card */}
          <div className="bg-[#EFF6FF] border-4 border-black p-6 flex flex-col justify-between min-h-[280px]">
            <div className="flex items-center gap-3">
              {/* Replace this src with your own token logo URL */}
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66578298-cba9-4de5-af8a-2eabfddd5bb4-zk4xO6LZ5xMYuNjjeWCZHMSWsH3RYh.png"
                alt={`${config.tokenName} coin`}
                width={64}
                height={64}
                className="border-2 border-black"
              />
              <h1 className="text-5xl font-black leading-none text-[#060D1F]">
                {config.tokenName}
              </h1>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 bg-black text-white text-xs font-bold px-2 py-1">
                <span className="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse"></span>
                STATUS: DISTRIBUTING
              </div>
              <p className="text-sm text-[#1A3A6E]">
                {config.tokenDescription}
              </p>
              <p className="text-sm text-[#060D1F]">
                NEXT DROP IN{" "}
                <span className="bg-[#2563EB] text-white font-mono font-bold px-1">
                  {formatCountdown(countdown)}
                </span>
              </p>
            </div>
          </div>

          {/* Right Card */}
          <div className="bg-[#1D4ED8] border-4 border-black p-8 flex flex-col justify-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-none mb-6">
              HOLD {config.tokenName}<br />EARN $USDC
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <p className="text-[#BFDBFE] text-sm max-w-md">
                Every 5 minutes, trading fees are auto-collected, swapped into USDC, and airdropped to your wallet instantly. No staking. No claiming.
              </p>
              <a
                href="/dashboard"
                className="bg-white text-[#060D1F] font-bold px-6 py-3 border-4 border-black hover:bg-[#BFDBFE] transition-colors whitespace-nowrap"
              >
                LIVE DASHBOARD →
              </a>
            </div>
          </div>
        </div>

        {/* USDC Section */}
        <div className="grid md:grid-cols-[1fr_1.5fr] gap-4">
          {/* USDC Card */}
          <div className="bg-[#1A3A6E] border-4 border-black p-6">
            <p className="text-xs font-bold text-[#93C5FD] mb-2">REWARD TOKEN</p>
            <h3 className="text-5xl md:text-6xl font-black text-white mb-4">
              US<span className="text-[#60A5FA]">DC</span>
            </h3>
            <p className="text-sm text-[#BFDBFE]">
              Real dollar value, delivered directly to your wallet. No volatility, no speculation — just USDC on Solana every 5 minutes.
            </p>
          </div>

          {/* Why USDC Card */}
          <div className="bg-[#EFF6FF] border-4 border-black p-6">
            <h3 className="text-2xl font-black mb-4 text-[#060D1F]">WHY USDC?</h3>
            <p className="text-sm text-[#1A3A6E] mb-4">
              {"We don't distribute random memecoins or volatile tokens. Every reward is real purchasing power — USD Coin, the most trusted stablecoin on Solana. Your rewards hold value the moment they land."}
            </p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between bg-[#DBEAFE] border-2 border-black p-3 font-mono text-xs hover:bg-[#BFDBFE] transition-colors text-[#060D1F]"
            >
              <span className="truncate">{config.tokenCA || "Token CA not configured"}</span>
              {copied ? <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0 ml-2" /> : <Copy className="w-4 h-4 flex-shrink-0 ml-2" />}
            </button>
            <p className="text-xs text-[#1A3A6E] mt-1">CONTRACT ADDRESS</p>
          </div>
        </div>

        {/* The Flow Section */}
        <div className="bg-[#0D1F3C] border-4 border-black p-6">
          <h3 className="text-3xl font-black mb-6 border-b-4 border-[#2563EB] pb-4 text-white">THE FLOW</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flowSteps.map((step) => (
              <div key={step.number} className="border-l-4 border-[#2563EB] pl-4">
                <span className="text-xs font-mono text-[#60A5FA]">{step.number}</span>
                <h4 className="text-lg font-black mb-2 text-white">{step.title}</h4>
                <p className="text-sm text-[#93C5FD]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Anti Big Holder Protection Banner */}
        <div className="bg-[#1D4ED8] border-4 border-black p-4 flex items-center gap-4">
          <div className="flex-shrink-0">
            <span className="text-3xl">🛡️</span>
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide mb-1">
              ANTI BIG HOLDER PROTECTION
            </p>
            <p className="text-[#BFDBFE] text-xs">
              Wallets holding more than <span className="font-bold text-white">40,000,000 {config.tokenName}</span> (~4% of supply) are <span className="font-bold text-white">excluded</span> from USDC distributions to keep rewards fair for all holders.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-[#1A3A6E] border-4 border-black p-6">
          <h3 className="text-2xl font-black mb-4 text-white">FAQ READOUT</h3>
          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <div key={index} className="border-b-2 border-[#2563EB] last:border-b-0">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-3 text-left font-bold text-sm text-white hover:text-[#60A5FA] transition-colors"
                >
                  {item.question}
                  <Plus className={`w-5 h-5 flex-shrink-0 ml-2 transition-transform ${openFaq === index ? "rotate-45" : ""}`} />
                </button>
                {openFaq === index && (
                  <p className="pb-3 text-sm text-[#BFDBFE]">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Marquee */}
        <div className="bg-[#2563EB] border-4 border-black overflow-hidden">
          <div className="py-3 flex">
            <div className="animate-marquee flex whitespace-nowrap">
              <span className="font-bold text-sm mx-4 text-white">{marqueeText}</span>
              <span className="font-bold text-sm mx-4 text-white">{marqueeText}</span>
            </div>
          </div>
        </div>

        {/* Hero Banner Image — replace this src with your own banner image URL */}
        <div className="border-4 border-black overflow-hidden">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/46305028-1eb4-4c83-8d38-c9c7281b2f01-31kaVLKLMt86yaad3rkdGYXYhrmXub.png"
            alt={`${config.tokenName} banner`}
            width={1400}
            height={400}
            className="w-full object-cover"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0D1F3C] border-t-4 border-black mt-6">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Replace this src with your own token logo URL */}
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66578298-cba9-4de5-af8a-2eabfddd5bb4-zk4xO6LZ5xMYuNjjeWCZHMSWsH3RYh.png"
              alt={`${config.tokenName} coin`}
              width={24}
              height={24}
              className="border border-black"
            />
            <p className="text-white text-sm font-bold">
              {config.tokenName} © 2026 · BUILT ON SOLANA
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-white text-sm font-bold hover:text-[#60A5FA] transition-colors">
              DASHBOARD
            </a>
            <a href="/holders" className="text-white text-sm font-bold hover:text-[#60A5FA] transition-colors">
              HOLDERS
            </a>
            <a href="/history" className="text-white text-sm font-bold hover:text-[#60A5FA] transition-colors">
              HISTORY
            </a>
            {config.twitterUrl && (
              <a
                href={config.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white text-sm font-bold hover:text-[#60A5FA] transition-colors"
              >
                <X className="w-4 h-4" />
                FOLLOW
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
