import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'MarhamPattii | Community first aid', description: 'A community first-aid and safety platform. Secure application foundation.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a className="skip" href="#main">Skip to content</a>
    <div className="emergency">Life-threatening emergency? <a href="tel:1122">Call Rescue 1122</a><span> or your local emergency service.</span></div>
    <header><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">+</span>MarhamPattii<span className="version">COMMUNITY SAFETY</span></Link>
      <nav aria-label="Main navigation"><Link href="/">Overview</Link><Link href="/dashboard">Dashboard</Link><Link className="nav-login" href="/login">Sign in <span aria-hidden="true">↗</span></Link></nav></header>
    <main id="main">{children}</main><footer><span>Care starts with community.</span><span>Guidance and community support do not replace medical care or emergency services.</span></footer>
  </body></html>;
}
