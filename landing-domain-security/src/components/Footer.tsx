import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-surface-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand" />
            <span className="font-heading font-bold text-text">
              iSCOPE <span className="text-brand">Domain Security</span>
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-text-muted">
            <a href="#funcionalidades" className="hover:text-text transition-colors">Funcionalidades</a>
            <a href="#monitoramento" className="hover:text-text transition-colors">Monitoramento</a>
            <a href="#planos" className="hover:text-text transition-colors">Planos</a>
            <a href="#faq" className="hover:text-text transition-colors">FAQ</a>
          </nav>

          <p className="text-xs text-text-dim">
            © {new Date().getFullYear()} iSCOPE. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
