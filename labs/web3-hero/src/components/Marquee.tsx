import { logos } from '../data/logos';

export function Marquee() {
  const doubled = [...logos, ...logos];

  return (
    <div
      className="group/marquee relative w-full overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
      }}
    >
      <div className="animate-marquee flex w-max gap-4 group-hover/marquee:[animation-play-state:paused]">
        {doubled.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden"
          >
            <div
              className="absolute inset-0 scale-150 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100"
              style={{ background: `linear-gradient(135deg, ${logo.gradient[0]}, ${logo.gradient[1]})` }}
              aria-hidden="true"
            />
            <img
              src={logo.src}
              alt={logo.name}
              loading="lazy"
              className="relative z-10 h-8 w-auto object-contain transition-all duration-300 group-hover:brightness-0 group-hover:invert"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
