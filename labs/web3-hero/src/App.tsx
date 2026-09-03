import { Hero } from './components/Hero';
import { Marquee } from './components/Marquee';

export default function App() {
  return (
    <main className="min-h-screen px-4 py-12 md:py-20">
      <Hero />
      <div className="mx-auto mt-10 max-w-[1400px]">
        <Marquee />
      </div>
    </main>
  );
}
