import { useState } from 'react';
import { Button } from './ui/Button';
import { Shield, Menu, X } from 'lucide-react';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Monitoramento', href: '#monitoramento' },
    { label: 'Planos', href: '#planos' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-surface-border/50 bg-surface/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-brand" />
            <span className="font-heading font-bold text-lg text-text">
              iSCOPE <span className="text-brand">Domain Security</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" size="sm">
              Solicite uma Demo
            </Button>
            <Button size="sm">Começar Agora</Button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-text-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-surface-border/50">
            <nav className="flex flex-col gap-3">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-text-muted hover:text-text py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" size="sm">Solicite uma Demo</Button>
                <Button size="sm">Começar Agora</Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
