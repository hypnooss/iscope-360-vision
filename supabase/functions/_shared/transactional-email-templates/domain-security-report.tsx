import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Domain Security"

interface DomainSecurityReportProps {
  domain?: string
  complianceScore?: number
  attackSurfaceScore?: number
  analysisDate?: string
  findings?: {
    critical?: number
    high?: number
    medium?: number
    low?: number
  }
  network?: {
    totalIPs?: number
    openPorts?: number
    services?: number
    cves?: number
  }
  reportUrl?: string
}

const DomainSecurityReportEmail = ({
  domain = 'example.com',
  complianceScore = 0,
  attackSurfaceScore = 0,
  analysisDate = new Date().toISOString(),
  findings = {},
  network = {},
  reportUrl,
}: DomainSecurityReportProps) => {
  const { critical = 0, high = 0, medium = 0, low = 0 } = findings
  const { totalIPs = 0, openPorts = 0, services = 0, cves = 0 } = network
  const totalFindings = critical + high + medium + low
  const formattedDate = new Date(analysisDate).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  const complianceUrl = reportUrl ? `${reportUrl}?download=compliance` : undefined
  const surfaceUrl = reportUrl ? `${reportUrl}?download=surface` : undefined

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Relatório de Segurança — {domain} — Análise concluída</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>{SITE_NAME}</Text>
            <Text style={headerSubtitle}>Relatório de Segurança de Domínio</Text>
          </Section>

          <Section style={content}>
            {/* DEMO Banner */}
            <Section style={demoBanner}>
              <Text style={demoBannerText}>RELATORIO DEMO</Text>
              <Text style={demoBannerSubtext}>
                Versao resumida — dados parcialmente ofuscados
              </Text>
            </Section>

            <Heading style={h1}>Resultado da Analise</Heading>
            <Text style={domainLabel}>Dominio analisado</Text>
            <Text style={domainValue}>{domain}</Text>
            <Text style={dateText}>Analise realizada em {formattedDate}</Text>

            <Hr style={divider} />

            {/* Scores */}
            <Text style={sectionTitle}>Pontuacoes</Text>
            <Section>
              <Row>
                <Column style={scoreCard}>
                  <Text style={scoreLabel}>Compliance</Text>
                  <Text style={{ ...scoreValue, color: getScoreColor(complianceScore) }}>
                    {complianceScore}
                  </Text>
                  <Text style={scoreUnit}>/100</Text>
                </Column>
                <Column style={scoreCard}>
                  <Text style={scoreLabel}>Superficie de Ataque</Text>
                  <Text style={{ ...scoreValue, color: getScoreColor(attackSurfaceScore) }}>
                    {attackSurfaceScore}
                  </Text>
                  <Text style={scoreUnit}>/100</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Findings */}
            <Text style={sectionTitle}>Findings ({totalFindings})</Text>
            <Section>
              <Row>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#ef4444' }}>{critical}</Text>
                  <Text style={findingLabel}>Critical</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#f97316' }}>{high}</Text>
                  <Text style={findingLabel}>High</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#eab308' }}>{medium}</Text>
                  <Text style={findingLabel}>Medium</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#22c55e' }}>{low}</Text>
                  <Text style={findingLabel}>Low</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Network Stats */}
            <Text style={sectionTitle}>Superficie de Rede</Text>
            <Section style={statsGrid}>
              <Row>
                <Column style={statItem}>
                  <Text style={statValue}>{totalIPs}</Text>
                  <Text style={statLabel}>IPs</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={statValue}>{openPorts}</Text>
                  <Text style={statLabel}>Portas Abertas</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={statValue}>{services}</Text>
                  <Text style={statLabel}>Servicos</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={{ ...statValue, color: cves > 0 ? '#ef4444' : '#22c55e' }}>{cves}</Text>
                  <Text style={statLabel}>CVEs</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Blur overlay message */}
            <Section style={blurMessage}>
              <Text style={blurMessageText}>
                Detalhes completos, guias de correcao e dados de rede estao disponiveis nos relatorios completos em PDF.
              </Text>
            </Section>

            {/* Two CTA buttons */}
            {reportUrl && (
              <Section style={{ textAlign: 'center' as const, padding: '16px 0 8px' }}>
                <Button style={ctaButtonPrimary} href={complianceUrl}>
                  Ver Relatorio Compliance (Demo)
                </Button>
              </Section>
            )}
            {reportUrl && (
              <Section style={{ textAlign: 'center' as const, padding: '8px 0 24px' }}>
                <Button style={ctaButtonSecondary} href={surfaceUrl}>
                  Ver Relatorio Surface Analyzer (Demo)
                </Button>
                <Text style={ctaSubtext}>
                  Link valido por 7 dias. Os relatorios completos incluem guias de correcao detalhados.
                </Text>
              </Section>
            )}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Este relatorio foi gerado automaticamente pelo {SITE_NAME}.
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} {SITE_NAME} · Todos os direitos reservados
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DomainSecurityReportEmail,
  subject: (data: Record<string, any>) =>
    `Relatório de Segurança — ${data.domain || 'Domínio'} — Análise concluída`,
  displayName: 'Domain Security Report (DEMO)',
  previewData: {
    domain: 'example.com',
    complianceScore: 72,
    attackSurfaceScore: 65,
    analysisDate: '2026-04-09T14:30:00Z',
    findings: { critical: 2, high: 5, medium: 8, low: 12 },
    network: { totalIPs: 4, openPorts: 12, services: 8, cves: 3 },
    reportUrl: 'https://iscope-teste.lovable.app/report/demo-token',
  },
} satisfies TemplateEntry

// ── Styles ──

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
}

const header = {
  backgroundColor: '#0f172a',
  padding: '24px 32px',
  borderRadius: '8px 8px 0 0',
}

const logoText = {
  color: '#38bdf8',
  fontSize: '22px',
  fontWeight: '700' as const,
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  margin: '0',
  letterSpacing: '-0.5px',
}

const headerSubtitle = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: '4px 0 0',
}

const content = {
  padding: '28px 32px',
  backgroundColor: '#f8fafc',
}

const demoBanner = {
  backgroundColor: '#fef3c7',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '20px',
  textAlign: 'center' as const,
  border: '1px solid #fbbf24',
}

const demoBannerText = {
  fontSize: '14px',
  fontWeight: '700' as const,
  color: '#92400e',
  margin: '0',
}

const demoBannerSubtext = {
  fontSize: '12px',
  color: '#a16207',
  margin: '4px 0 0',
}

const h1 = {
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#0f172a',
  margin: '0 0 16px',
}

const domainLabel = {
  fontSize: '11px',
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 4px',
}

const domainValue = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#0f172a',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  margin: '0 0 8px',
}

const dateText = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0',
}

const divider = {
  borderColor: '#e2e8f0',
  margin: '20px 0',
}

const sectionTitle = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#0f172a',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px',
}

const scoreCard = {
  textAlign: 'center' as const,
  padding: '12px 8px',
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  width: '50%',
}

const scoreLabel = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0 0 4px',
}

const scoreValue = {
  fontSize: '36px',
  fontWeight: '700' as const,
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  margin: '0',
  lineHeight: '1',
  letterSpacing: '2px',
}

const scoreUnit = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '2px 0 0',
}

const findingBadge = {
  textAlign: 'center' as const,
  padding: '8px 4px',
  width: '25%',
}

const findingCount = {
  fontSize: '24px',
  fontWeight: '700' as const,
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  margin: '0',
  lineHeight: '1',
}

const findingLabel = {
  fontSize: '11px',
  color: '#64748b',
  margin: '4px 0 0',
  textTransform: 'uppercase' as const,
}

const statsGrid = {
  padding: '0',
}

const statItem = {
  textAlign: 'center' as const,
  padding: '8px 4px',
  width: '25%',
}

const statValue = {
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#0f172a',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  margin: '0',
  lineHeight: '1',
}

const statLabel = {
  fontSize: '11px',
  color: '#64748b',
  margin: '4px 0 0',
}

const blurMessage = {
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
  padding: '16px',
  border: '1px dashed #cbd5e1',
  textAlign: 'center' as const,
}

const blurMessageText = {
  fontSize: '13px',
  color: '#475569',
  margin: '0',
  lineHeight: '1.5',
}

const ctaButtonPrimary = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '700' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const ctaButtonSecondary = {
  backgroundColor: '#334155',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '700' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const ctaSubtext = {
  fontSize: '11px',
  color: '#94a3b8',
  margin: '12px 0 0',
  textAlign: 'center' as const,
}

const footer = {
  padding: '20px 32px',
  backgroundColor: '#f1f5f9',
  borderRadius: '0 0 8px 8px',
}

const footerText = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0 0 4px',
  textAlign: 'center' as const,
}