/**
 * relatorio-scheduler.ts — Gerador automático de relatórios de rentabilidade.
 *
 * Verifica a cada hora quais empresas têm frequenciaRelatorio != "desligado"
 * e, se for a hora certa, gera e armazena o relatório para consulta posterior.
 *
 * Os relatórios ficam em memória (array relatoriosGerados) e podem ser
 * consultados via GET /rentabilidade/relatorios. Para envio por e-mail,
 * configure SMTP_HOST, SMTP_USER, SMTP_PASS nas variáveis de ambiente.
 */
import { getCostSettings, calcularRentabilidadePorPrato, restaurants } from "./data-store.js";
import { logger } from "./logger.js";

export interface RelatorioGerado {
  id: string;
  companyId: string;
  geradoEm: string;
  frequencia: string;
  periodo: { desde: string; ate: string };
  estimativa: boolean;
  totalPratos: number;
  semFichaTecnica: number;
  alertasMargemBaixa: number;
  lucroTotalEstimado: number;
  margemGeralPercent: number;
}

// Em memória — sobrevive apenas enquanto o processo está rodando.
// Para persistência entre reinicializações, gravar em data-store com scheduleSave.
export const relatoriosGerados: RelatorioGerado[] = [];

function deveria_gerar(frequencia: string, agora: Date): boolean {
  const hora = agora.getHours();
  const diaSemana = agora.getDay(); // 0 = domingo
  const dia = agora.getDate();

  switch (frequencia) {
    case "diario":
      return hora === 6; // todo dia às 6h
    case "semanal":
      return diaSemana === 1 && hora === 6; // segunda-feira às 6h
    case "quinzenal":
      return (dia === 1 || dia === 16) && hora === 6;
    case "mensal":
      return dia === 1 && hora === 6;
    default:
      return false;
  }
}

function gerarRelatorio(companyId: string): RelatorioGerado {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const { pratos, semFichaTecnica } = calcularRentabilidadePorPrato(companyId, inicioMes, agora);

  const totalVendas = pratos.reduce((s, p) => s + p.precoVenda * p.quantidadeVendidaPeriodo, 0);
  const totalLucro = pratos.reduce((s, p) => s + p.lucroReais * p.quantidadeVendidaPeriodo, 0);
  const margemGeral = totalVendas > 0 ? (totalLucro / totalVendas) * 100 : 0;
  const alertas = pratos.filter(p => p.alertaMargemBaixa).length;

  const rel: RelatorioGerado = {
    id: `rel-${companyId}-${agora.toISOString()}`,
    companyId,
    geradoEm: agora.toISOString(),
    frequencia: getCostSettings(companyId).frequenciaRelatorio,
    periodo: { desde: inicioMes.toISOString(), ate: agora.toISOString() },
    estimativa: true,
    totalPratos: pratos.length,
    semFichaTecnica: semFichaTecnica.length,
    alertasMargemBaixa: alertas,
    lucroTotalEstimado: totalLucro,
    margemGeralPercent: margemGeral,
  };

  relatoriosGerados.unshift(rel);
  // mantém só os últimos 100 relatórios em memória
  if (relatoriosGerados.length > 100) relatoriosGerados.splice(100);

  return rel;
}

let schedulerStarted = false;

export function startRelatorioScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info("Scheduler de relatórios de rentabilidade iniciado (verifica a cada hora)");

  setInterval(() => {
    const agora = new Date();
    for (const restaurant of restaurants) {
      const config = getCostSettings(restaurant.id);
      if (config.frequenciaRelatorio === "desligado") continue;
      if (!deveria_gerar(config.frequenciaRelatorio, agora)) continue;

      try {
        const rel = gerarRelatorio(restaurant.id);
        logger.info(
          { companyId: restaurant.id, relatorioId: rel.id, frequencia: config.frequenciaRelatorio },
          "Relatório de rentabilidade gerado automaticamente"
        );
      } catch (err) {
        logger.error({ err, companyId: restaurant.id }, "Erro ao gerar relatório automático");
      }
    }
  }, 60 * 60 * 1000); // verifica a cada hora
}
