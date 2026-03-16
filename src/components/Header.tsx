import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import logoIscope from '@/assets/logo-iscope.png';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'Produto', href: '#features' },
  { label: 'Documentação', href: '#blog' },
  { label: 'Segurança', href: '#problem' },
  { label: 'Contato', href: '#cta' },
];

export function Header() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-background/40 backdrop-blur-2xl">
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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
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
            className="shadow-[0_0_20px_hsl(175_80%_45%/0.15)] hover:shadow-[0_0_30px_hsl(175_80%_45%/0.3)] transition-shadow duration-300"
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
      {mobileOpen && (
        <div className="md:hidden border-t border-border/20 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3 animate-fade-in">
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
        </div>
      )}
    </header>
  );
}
