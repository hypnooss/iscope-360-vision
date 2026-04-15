import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Domain Security"
const BRAND_BLUE = '#2563EB'
const BRAND_DARK = '#1e293b'

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
    if (score >= 80) return '#16a34a'
    if (score >= 60) return '#ca8a04'
    if (score >= 40) return '#ea580c'
    return '#dc2626'
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
            <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
              <tr>
                <td style={{ verticalAlign: 'middle' }}>
                  <table cellPadding="0" cellSpacing="0">
                    <tr>
                      <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                        <div style={shieldIcon}>🛡️</div>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <Text style={logoText}>{SITE_NAME}</Text>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <Text style={headerSubtitle}>Relatório de Segurança de Domínio</Text>
          </Section>

          <Section style={content}>
            {/* DEMO Banner */}
            <Section style={demoBanner}>
              <Text style={demoBannerText}>RELATÓRIO DEMO</Text>
              <Text style={demoBannerSubtext}>
                Versão resumida — dados parcialmente ofuscados
              </Text>
            </Section>

            <Heading style={h1}>Resultado da Análise</Heading>
            <Text style={domainLabel}>Domínio analisado</Text>
            <Text style={domainValue}>{domain}</Text>
            <Text style={dateText}>Análise realizada em {formattedDate}</Text>

            <Hr style={divider} />

            {/* Scores */}
            <Text style={sectionTitle}>Pontuações</Text>
            <Section>
              <Row>
                <Column style={scoreCard}>
                  <Text style={scoreLabel}>Compliance</Text>
                  <Text style={{ ...scoreValue, color: getScoreColor(complianceScore) }}>
                    {complianceScore}
                  </Text>
                  <Text style={scoreUnit}>/100</Text>
                </Column>
                <Column style={{ width: '12px' }}>&nbsp;</Column>
                <Column style={scoreCard}>
                  <Text style={scoreLabel}>Superfície de Ataque</Text>
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
                  <Text style={{ ...findingCount, color: '#dc2626' }}>{critical}</Text>
                  <Text style={findingLabel}>Critical</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#ea580c' }}>{high}</Text>
                  <Text style={findingLabel}>High</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#ca8a04' }}>{medium}</Text>
                  <Text style={findingLabel}>Medium</Text>
                </Column>
                <Column style={findingBadge}>
                  <Text style={{ ...findingCount, color: '#16a34a' }}>{low}</Text>
                  <Text style={findingLabel}>Low</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Network Stats */}
            <Text style={sectionTitle}>Superfície de Rede</Text>
            <Section>
              <Row>
                <Column style={statItem}>
                  <Text style={statValueStyle}>{totalIPs}</Text>
                  <Text style={statLabel}>IPs</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={statValueStyle}>{openPorts}</Text>
                  <Text style={statLabel}>Portas Abertas</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={statValueStyle}>{services}</Text>
                  <Text style={statLabel}>Serviços</Text>
                </Column>
                <Column style={statItem}>
                  <Text style={{ ...statValueStyle, color: cves > 0 ? '#dc2626' : '#16a34a' }}>{cves}</Text>
                  <Text style={statLabel}>CVEs</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Info message */}
            <Section style={infoBox}>
              <Text style={infoBoxText}>
                Detalhes completos, guias de correção e dados de rede estão disponíveis nos relatórios completos em PDF.
              </Text>
            </Section>

            {/* CTA buttons */}
            {reportUrl && (
              <Section style={{ textAlign: 'center' as const, padding: '16px 0 8px' }}>
                <Button style={ctaButtonPrimary} href={complianceUrl}>
                  Baixar Relatório Compliance (Demo)
                </Button>
              </Section>
            )}
            {reportUrl && (
              <Section style={{ textAlign: 'center' as const, padding: '8px 0 24px' }}>
                <Button style={ctaButtonSecondary} href={surfaceUrl}>
                  Baixar Relatório Surface Analyzer (Demo)
                </Button>
                <Text style={ctaSubtext}>
                  Link válido por 7 dias. Os relatórios completos incluem guias de correção detalhados.
                </Text>
              </Section>
            )}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Este relatório foi gerado automaticamente pelo {SITE_NAME}.
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
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  overflow: 'hidden' as const,
}

const header = {
  backgroundColor: '#ffffff',
  padding: '28px 32px 16px',
  borderBottom: '1px solid #e5e7eb',
}

const shieldIcon = {
  fontSize: '28px',
  lineHeight: '1',
}

const logoText = {
  color: BRAND_DARK,
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0',
  letterSpacing: '-0.5px',
}

const headerSubtitle = {
  color: '#64748b',
  fontSize: '13px',
  margin: '8px 0 0',
}

const content = {
  padding: '28px 32px',
  backgroundColor: '#ffffff',
}

const demoBanner = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '24px',
  textAlign: 'center' as const,
  border: `1px solid ${BRAND_BLUE}33`,
}

const demoBannerText = {
  fontSize: '13px',
  fontWeight: '700' as const,
  color: BRAND_BLUE,
  margin: '0',
  letterSpacing: '1px',
}

const demoBannerSubtext = {
  fontSize: '12px',
  color: '#3b82f6',
  margin: '4px 0 0',
}

const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: BRAND_DARK,
  margin: '0 0 16px',
}

const domainLabel = {
  fontSize: '11px',
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 4px',
}

const domainValue = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: BRAND_BLUE,
  margin: '0 0 8px',
}

const dateText = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '0',
}

const divider = {
  borderColor: '#f1f5f9',
  margin: '24px 0',
}

const sectionTitle = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px',
}

const scoreCard = {
  textAlign: 'center' as const,
  padding: '16px 12px',
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
}

const scoreLabel = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0 0 6px',
}

const scoreValue = {
  fontSize: '36px',
  fontWeight: '800' as const,
  margin: '0',
  lineHeight: '1',
}

const scoreUnit = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '4px 0 0',
}

const findingBadge = {
  textAlign: 'center' as const,
  padding: '10px 4px',
  width: '25%',
}

const findingCount = {
  fontSize: '24px',
  fontWeight: '800' as const,
  margin: '0',
  lineHeight: '1',
}

const findingLabel = {
  fontSize: '11px',
  color: '#94a3b8',
  margin: '6px 0 0',
  textTransform: 'uppercase' as const,
}

const statItem = {
  textAlign: 'center' as const,
  padding: '10px 4px',
  width: '25%',
}

const statValueStyle = {
  fontSize: '20px',
  fontWeight: '700' as const,
  color: BRAND_DARK,
  margin: '0',
  lineHeight: '1',
}

const statLabel = {
  fontSize: '11px',
  color: '#94a3b8',
  margin: '6px 0 0',
}

const infoBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid #e5e7eb',
  textAlign: 'center' as const,
}

const infoBoxText = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0',
  lineHeight: '1.5',
}

const ctaButtonPrimary = {
  backgroundColor: BRAND_BLUE,
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const ctaButtonSecondary = {
  backgroundColor: '#1e40af',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600' as const,
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
  backgroundColor: '#f8fafc',
}

const footerText = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0 0 4px',
  textAlign: 'center' as const,
}
