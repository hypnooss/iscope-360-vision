import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import logoIscope from '@/assets/logo-iscope.png';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { label: 'Produto', href: '#features' },
  { label: 'Features', href: '#how-it-works' },
  { label: 'Integrações', href: '#integrations' },
  { label: 'Docs', href: '#blog' },
  { label: 'Contato', href: '#cta' },
];

export function Header() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-500 ${
        scrolled
          ? 'border-border/20 bg-background/80 backdrop-blur-2xl'
          : 'border-transparent bg-transparent backdrop-blur-none'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img src={logoIscope} alt="iScope 360" className="h-8 w-auto" />
          <span className="text-lg font-bold font-heading text-foreground">iScope 360</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-primary after:scale-x-0 after:origin-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-left"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block shrink-0">
          <Button
            onClick={() => navigate('/auth')}
            size="sm"
            className="hover:-translate-y-0.5 transition-all duration-300 shadow-[0_0_20px_hsl(175_80%_45%/0.15)] hover:shadow-[0_0_30px_hsl(175_80%_45%/0.3)]"
          >
            Acessar Plataforma
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden border-t border-border/20 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3 overflow-hidden"
          >
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Button onClick={() => navigate('/auth')} className="w-full mt-2">
              Acessar Plataforma
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
