import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4';

export function Hero() {
  return (
    <div className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] flex flex-col">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105 transition-transform duration-1000"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start"
      >
        <h1 className="font-display text-[42px] md:text-[56px] font-medium tracking-tight leading-[1.05] text-[#0a1b33]">
          Foundation of the
          <br />
          new digital epoch
        </h1>
        <p className="mt-5 max-w-md font-sans text-[14px] md:text-[15px] leading-relaxed text-[#64748b]">
          Designing products, powering ecosystems and laying the foundation of a decentralized web for
          enterprises, builders and communities alike.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
          className="mt-8 rounded-full bg-[#0a152d] px-6 py-3 text-[13px] font-semibold text-white"
        >
          Contact Us
        </motion.button>
      </motion.div>

      <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2">
        <motion.nav
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center rounded-full border border-slate-200/40 bg-white/90 px-1.5 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
        >
          <span className="mr-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 bg-white text-[15px] shadow-sm">
            &#10022;
          </span>
          <button className="px-4 py-2 text-[12px] font-semibold text-slate-500 transition-colors hover:text-[#0a1b33]">
            Products
          </button>
          <button className="px-4 py-2 text-[12px] font-semibold text-slate-500 transition-colors hover:text-[#0a1b33]">
            Docs
          </button>
          <button className="ml-1 flex items-center gap-1 rounded-full border border-slate-200/60 bg-white px-5 py-2 text-[12px] font-semibold text-[#0a1b33] shadow-sm transition-all hover:border-slate-300">
            Get in touch
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </motion.nav>
      </div>
    </div>
  );
}
