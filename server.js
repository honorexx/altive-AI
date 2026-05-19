require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEYapp.get("/painel"
});

const INSTANCE_ID = process.env.INSTANCE_ID;
const INSTANCE_TOKEN = process.env.INSTANCE_TOKEN;
const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
const SITE_OFICIAL = "https://altivetech.com.br";
const DADOS_PATH = path.join(__dirname, "dados-bot.json");

const ESTADOS = {
  BOT: "bot",
  AGUARDANDO_CONFIRMACAO_HUMANO: "aguardando_confirmacao_humano",
  HUMANO: "humano"
};

const banco = carregarBanco();

const servicosAltive = {
  desenvolvimento_web: {
    nome: "Desenvolvimento web",
    descricao:
      "Sites institucionais, landing pages, páginas de serviço, portais e experiências web responsivas, rápidas e pensadas para conversão.",
    exemplos: ["site institucional", "landing page", "página de vendas", "portal web"]
  },
  automacao_processos: {
    nome: "Automação de processos",
    descricao:
      "Automação de rotinas operacionais, atendimento, cadastros, tarefas repetitivas, integrações entre ferramentas e fluxos internos.",
    exemplos: ["automação de atendimento", "integração de sistemas", "rotina operacional"]
  },
  sistemas_personalizados: {
    nome: "Sistemas personalizados",
    descricao:
      "Sistemas sob medida para empresas que precisam controlar processos, clientes, pedidos, equipe, indicadores e regras próprias do negócio.",
    exemplos: ["CRM próprio", "ERP leve", "painel administrativo", "sistema interno"]
  },
  operacoes_complexas: {
    nome: "Soluções para operações complexas",
    descricao:
      "Projetos com controle, escalabilidade, permissões, múltiplas integrações, auditoria, automações e lógica profunda de negócio.",
    exemplos: ["operação com várias áreas", "controle multiusuário", "integração profunda"]
  },
  inteligencia_artificial: {
    nome: "Inteligência artificial",
    descricao:
      "IAs para atendimento, suporte, vendas, triagem, análise de dados, automação de respostas e integração com WhatsApp ou sistemas internos.",
    exemplos: ["IA para WhatsApp", "chatbot treinado", "assistente comercial", "suporte com IA"]
  },
  dashboards_dados: {
    nome: "Dashboards de dados",
    descricao:
      "Painéis para acompanhar indicadores, vendas, atendimento, operação, produtividade e dados estratégicos em tempo real ou por período.",
    exemplos: ["dashboard comercial", "painel financeiro", "BI operacional"]
  },
  consultoria_digital: {
    nome: "Consultoria digital",
    descricao:
      "Diagnóstico técnico e estratégico para definir arquitetura de dados, sistemas, integrações, automações, IA e próximos passos digitais.",
    exemplos: ["arquitetura de dados", "mapa de automação", "estratégia de sistemas"]
  }
};

const faixasOrcamento = {
  landing_page: {
    nome: "Landing page profissional",
    faixa: "R$ 1.500 a R$ 5.000",
    prazo: "7 a 20 dias",
    observacao: "Varia conforme design, copy, formulário, integrações e quantidade de seções."
  },
  site_institucional: {
    nome: "Site institucional",
    faixa: "R$ 3.000 a R$ 12.000",
    prazo: "15 a 45 dias",
    observacao: "Depende da quantidade de páginas, conteúdo, SEO, blog e integrações."
  },
  automacao_whatsapp: {
    nome: "Automação/IA para WhatsApp",
    faixa: "R$ 2.500 a R$ 15.000+",
    prazo: "10 a 45 dias",
    observacao:
      "Depende do fluxo, uso de IA, base de conhecimento, integrações, painel e atendimento humano."
  },
  sistema_personalizado: {
    nome: "Sistema personalizado",
    faixa: "R$ 8.000 a R$ 80.000+",
    prazo: "30 a 120+ dias",
    observacao:
      "Depende de módulos, usuários, regras de negócio, permissões, relatórios, integrações e escalabilidade."
  },
  dashboard_dados: {
    nome: "Dashboard de dados",
    faixa: "R$ 3.500 a R$ 25.000+",
    prazo: "15 a 60 dias",
    observacao: "Depende das fontes de dados, métricas, atualização automática e nível de análise."
  },
  consultoria_digital: {
    nome: "Consultoria digital/arquitetura",
    faixa: "R$ 800 a R$ 5.000 por diagnóstico inicial",
    prazo: "3 a 15 dias",
    observacao:
      "Pode virar um plano técnico com arquitetura, prioridades, ferramentas, integrações e estimativa de implantação."
  }
};

function carregarBanco() {
  try {
    if (!fs.existsSync(DADOS_PATH)) {
      return { contatos: {} };
    }

    return JSON.parse(fs.readFileSync(DADOS_PATH, "utf8"));
  } catch (erro) {
    console.log("Não foi possível carregar dados-bot.json:", erro.message);
    return { contatos: {} };
  }
}

function salvarBanco() {
  fs.writeFileSync(DADOS_PATH, JSON.stringify(banco, null, 2));
}

function contato(numero) {
  if (!banco.contatos[numero]) {
    banco.contatos[numero] = {
      numero,
      estado: ESTADOS.BOT,
      historico: [],
      resumo: "",
      dados: {},
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
  }

  return banco.contatos[numero];
}

function atualizarContato(numero, patch = {}) {
  const c = contato(numero);
  Object.assign(c, patch, { atualizadoEm: new Date().toISOString() });
  salvarBanco();
  return c;
}

async function enviarMensagem(numero, mensagem) {
  await axios.post(
    `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`,
    {
      phone: numero,
      message: mensagem
    },
    {
      headers: {
        "Client-Token": CLIENT_TOKEN
      }
    }
  );
}

function normalizarNumero(numero) {
  return String(numero || "").replace(/\D/g, "");
}

function pegarMensagem(body) {
  return (
    body.text?.message ||
    body.body ||
    body.message?.conversation ||
    body.message ||
    ""
  );
}

function pegarNumero(body) {
  const numero = body.phone || body.senderPhone || body.from || body.chatId || "";
  return normalizarNumero(numero);
}

function normalizarTexto(mensagem) {
  return String(mensagem || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\/\s+/, "/");
}

function salvarHistorico(numero, role, content) {
  const c = contato(numero);
  c.historico.push({ role, content, at: new Date().toISOString() });

  if (c.historico.length > 24) {
    c.historico = c.historico.slice(-24);
  }

  c.atualizadoEm = new Date().toISOString();
  salvarBanco();
}

function ultimasMensagens(numero) {
  return contato(numero).historico.map(({ role, content }) => ({ role, content }));
}

function detectarIntencao(texto) {
  if (temAlgum(texto, ["orcamento", "quanto custa", "valor", "preco", "investimento"])) {
    return "orcamento";
  }

  if (temAlgum(texto, ["site", "landing", "pagina", "web"])) {
    return "desenvolvimento_web";
  }

  if (temAlgum(texto, ["whatsapp", "zap", "automacao", "mensagem automatica"])) {
    return "automacao_whatsapp";
  }

  if (temAlgum(texto, ["ia", "inteligencia artificial", "chatbot", "bot", "assistente"])) {
    return "inteligencia_artificial";
  }

  if (temAlgum(texto, ["dashboard", "bi", "indicador", "relatorio", "dados"])) {
    return "dashboards_dados";
  }

  if (temAlgum(texto, ["sistema", "plataforma", "software", "painel", "crm", "erp"])) {
    return "sistemas_personalizados";
  }

  if (temAlgum(texto, ["consultoria", "arquitetura", "diagnostico", "estrategia"])) {
    return "consultoria_digital";
  }

  if (temAlgum(texto, ["empresa", "altive", "quem sao", "o que voces fazem"])) {
    return "sobre_altive";
  }

  return "geral";
}

function temAlgum(texto, palavras) {
  return palavras.some(palavra => texto.includes(palavra));
}

function respostaPositiva(texto) {
  return [
    "sim",
    "s",
    "ok",
    "okay",
    "pode",
    "pode sim",
    "quero",
    "quero sim",
    "claro",
    "beleza",
    "fechado",
    "manda",
    "chama",
    "chamar",
    "por favor"
  ].some(palavra => texto === palavra || texto.includes(palavra));
}

function pediuHumano(texto) {
  return temAlgum(texto, [
    "especialista",
    "atendente",
    "humano",
    "pessoa",
    "falar com alguem",
    "falar com uma pessoa",
    "chama alguem",
    "chamar alguem",
    "pessoa real",
    "vendedor",
    "consultor"
  ]);
}

function deveSugerirHumano(texto, intencao) {
  return (
    intencao === "orcamento" ||
    temAlgum(texto, [
      "contratar",
      "fechar",
      "proposta",
      "reuniao",
      "urgente",
      "integracao",
      "complexo",
      "api",
      "banco de dados"
    ])
  );
}

function tipoOrcamentoPorTexto(texto, intencao) {
  if (temAlgum(texto, ["landing"])) return "landing_page";
  if (temAlgum(texto, ["site", "pagina"])) return "site_institucional";
  if (temAlgum(texto, ["whatsapp", "zap", "chatbot", "bot", "ia"])) return "automacao_whatsapp";
  if (temAlgum(texto, ["dashboard", "bi", "relatorio", "indicador"])) return "dashboard_dados";
  if (temAlgum(texto, ["consultoria", "arquitetura", "diagnostico"])) return "consultoria_digital";
  if (temAlgum(texto, ["sistema", "software", "plataforma", "painel", "crm", "erp"])) {
    return "sistema_personalizado";
  }

  if (intencao === "desenvolvimento_web") return "site_institucional";
  if (intencao === "automacao_whatsapp" || intencao === "inteligencia_artificial") {
    return "automacao_whatsapp";
  }
  if (intencao === "dashboards_dados") return "dashboard_dados";
  if (intencao === "consultoria_digital") return "consultoria_digital";
  if (intencao === "sistemas_personalizados") return "sistema_personalizado";

  return null;
}

function contextoOrcamento(tipo) {
  if (!tipo || !faixasOrcamento[tipo]) {
    return "Ainda não há tipo de orçamento claro. Explique que precisa entender se é site, IA, automação, sistema, dashboard ou consultoria.";
  }

  const item = faixasOrcamento[tipo];
  return `
Referência interna de orçamento para ${item.nome}:
- Faixa comum: ${item.faixa}
- Prazo comum: ${item.prazo}
- Observação: ${item.observacao}

Use isso como noção inicial, nunca como proposta fechada. Diga que o valor final depende do escopo.
`;
}

async function pesquisarMercadoSeDisponivel(consulta) {
  if (!process.env.SERPAPI_KEY) {
    return "Pesquisa externa não configurada. Use as faixas internas como referência.";
  }

  try {
    const { data } = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google",
        q: consulta,
        gl: "br",
        hl: "pt-br",
        api_key: process.env.SERPAPI_KEY
      },
      timeout: 8000
    });

    const resultados = (data.organic_results || [])
      .slice(0, 4)
      .map(r => `- ${r.title}: ${r.snippet || r.link}`)
      .join("\n");

    return resultados || "A pesquisa externa não retornou dados úteis.";
  } catch (erro) {
    console.log("Erro na pesquisa externa:", erro.message);
    return "Não consegui pesquisar o mercado agora. Use as faixas internas como referência.";
  }
}

function montarConhecimentoAltive() {
  return Object.values(servicosAltive)
    .map(servico => {
      return `${servico.nome}: ${servico.descricao} Exemplos: ${servico.exemplos.join(", ")}.`;
    })
    .join("\n");
}

async function gerarRespostaIA({ numero, mensagem, texto, intencao, tipoOrcamento }) {
  const c = contato(numero);
  const contextoMercado =
    intencao === "orcamento" || tipoOrcamento
      ? await pesquisarMercadoSeDisponivel(
          `preço médio Brasil ${faixasOrcamento[tipoOrcamento]?.nome || "desenvolvimento de software"} 2026`
        )
      : "Não necessário nesta resposta.";

  const respostaIA = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Você é a assistente virtual oficial da Altive, uma empresa brasileira de tecnologia.

Seu objetivo é conversar como uma consultora de tecnologia: entender o problema, sugerir caminhos reais e conduzir para orçamento ou especialista quando fizer sentido.

SITE OFICIAL:
${SITE_OFICIAL}
Nunca informe outro domínio.

SERVIÇOS DA ALTIVE:
${montarConhecimentoAltive()}

REFERÊNCIAS DE ORÇAMENTO:
${contextoOrcamento(tipoOrcamento)}

CONTEXTO DE MERCADO:
${contextoMercado}

ESTADO DO CONTATO:
- Estado atual: ${c.estado}
- Resumo salvo: ${c.resumo || "sem resumo"}
- Dados conhecidos: ${JSON.stringify(c.dados || {})}

REGRAS:
- Responda em português do Brasil.
- Seja clara, humana, inteligente e objetiva.
- Não diga que é ChatGPT.
- Não faça muitas perguntas. Faça no máximo uma pergunta útil por resposta.
- Não dê orçamento fechado. Dê faixa estimada quando houver base, com ressalva de complexidade.
- Se o cliente pedir preço, dê uma noção por faixa e explique o que muda o valor.
- Se perceber projeto complexo, orçamento real, contratação, integração ou dúvida comercial, ofereça especialista.
- Quando oferecer especialista, deixe claro que a pessoa pode responder "sim", "ok" ou "pode" para encaminhar.
- Não prometa spam, disparo abusivo ou burla de regras do WhatsApp.
- Para campanhas no WhatsApp, recomende consentimento, WhatsApp Business API oficial, lista autorizada e captação voluntária.
- Não responda em formato de lista grande se uma resposta curta resolver.

A resposta deve ser SOMENTE um JSON válido com este formato:
{
  "mensagem": "texto que será enviado ao cliente",
  "ofereceu_humano": true ou false,
  "acionar_humano_agora": true ou false,
  "resumo": "resumo curto atualizado do cliente e necessidade",
  "dados": {
    "interesse": "serviço provável",
    "complexidade": "baixa|media|alta|desconhecida",
    "orcamento_tipo": "tipo provável ou vazio"
  }
}
`
      },
      ...ultimasMensagens(numero),
      { role: "user", content: mensagem }
    ]
  });

  try {
    return JSON.parse(respostaIA.choices[0].message.content);
  } catch (erro) {
    return {
      mensagem:
        "Entendi. A Altive consegue analisar esse cenário e sugerir o caminho mais adequado. Para eu te orientar melhor, você está pensando em site, sistema, automação, IA ou dashboard?",
      ofereceu_humano: false,
      acionar_humano_agora: false,
      resumo: c.resumo,
      dados: c.dados
    };
  }
}

function escaparHtml(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPainel() {
  const contatos = Object.values(banco.contatos).sort(
    (a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm)
  );

  const cards = contatos.length
    ? contatos
        .map(c => {
          const status =
            c.estado === ESTADOS.HUMANO
              ? "Atendimento humano ativo"
              : c.estado === ESTADOS.AGUARDANDO_CONFIRMACAO_HUMANO
                ? "Aguardando confirmação para humano"
                : "IA atendendo";

          const ultima = c.historico[c.historico.length - 1]?.content || "Sem mensagens";

          return `
            <article class="card ${c.estado}">
              <div class="card-top">
                <div>
                  <strong>${escaparHtml(c.numero)}</strong>
                  <p>${escaparHtml(status)}</p>
                </div>
                <span>${new Date(c.atualizadoEm).toLocaleString("pt-BR")}</span>
              </div>
              <p class="resumo">${escaparHtml(c.resumo || "Sem resumo salvo ainda.")}</p>
              <p class="ultima">${escaparHtml(ultima)}</p>
              <div class="acoes">
                <a class="btn assumir" href="/assumir/${c.numero}">Assumir</a>
                <a class="btn bot" href="/bot/${c.numero}">Voltar IA</a>
                <a class="btn encerrar" href="/encerrar/${c.numero}">Encerrar</a>
              </div>
            </article>
          `;
        })
        .join("")
    : "<p>Nenhum contato registrado ainda.</p>";

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Painel Altive</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            background: #0b1020;
            color: #f8fafc;
            padding: 28px;
            margin: 0;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 16px;
            margin-bottom: 22px;
          }
          h1 { color: #38bdf8; margin: 0; font-size: 28px; }
          header p { color: #94a3b8; margin: 6px 0 0; }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 14px;
          }
          .card {
            background: #151d31;
            border: 1px solid #25324a;
            border-radius: 8px;
            padding: 18px;
          }
          .card.humano { border-color: #22c55e; }
          .card.aguardando_confirmacao_humano { border-color: #f59e0b; }
          .card-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: start;
          }
          .card strong { font-size: 18px; }
          .card p { color: #a8b3c7; margin: 5px 0 0; line-height: 1.35; }
          .card span { color: #64748b; font-size: 12px; white-space: nowrap; }
          .resumo {
            margin-top: 14px !important;
            color: #e2e8f0 !important;
          }
          .ultima {
            background: #0f172a;
            border-radius: 8px;
            padding: 10px;
            max-height: 95px;
            overflow: auto;
          }
          .acoes { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
          .btn {
            padding: 9px 12px;
            border-radius: 7px;
            text-decoration: none;
            color: white;
            display: inline-block;
            font-size: 14px;
          }
          .assumir { background: #2563eb; }
          .bot { background: #475569; }
          .encerrar { background: #16a34a; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Painel de Atendimento Altive</h1>
            <p>Contatos, estados da IA e atendimentos humanos.</p>
          </div>
        </header>
        <main class="grid">${cards}</main>
      </body>
    </html>
  `;
}

app.get("/painel", (req, res) => {
  res.status(200).send(`
    <h1>Painel Altive</h1>
    <p>Servidor funcionando.</p>
  `);
});

app.get("/assumir/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);
  atualizarContato(numero, { estado: ESTADOS.HUMANO });

  await enviarMensagem(
    numero,
    "Atendimento assumido por um especialista da Altive. Pode continuar por aqui, nossa equipe está acompanhando."
  );

  res.redirect("/painel");
});

app.get("/bot/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);
  atualizarContato(numero, { estado: ESTADOS.BOT });

  await enviarMensagem(
    numero,
    "Pronto, a assistente virtual da Altive voltou para te ajudar por aqui."
  );

  res.redirect("/painel");
});

app.get("/encerrar/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);
  atualizarContato(numero, { estado: ESTADOS.BOT });

  await enviarMensagem(
    numero,
    "A Altive agradece o seu contato! O atendimento humano foi encerrado e nossa assistente virtual está de volta."
  );

  res.redirect("/painel");
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("BODY COMPLETO:", JSON.stringify(req.body, null, 2));

    const mensagem = pegarMensagem(req.body);
    const numero = pegarNumero(req.body);
    const fromMe = req.body.fromMe === true;

    if (!mensagem || !numero) {
      return res.sendStatus(200);
    }

    const c = contato(numero);
    const texto = normalizarTexto(mensagem);

    console.log("Mensagem:", mensagem);
    console.log("Número:", numero);
    console.log("FromMe:", fromMe);
    console.log("Estado:", c.estado);

    if (fromMe && texto.startsWith("/assumir")) {
      atualizarContato(numero, { estado: ESTADOS.HUMANO });

      console.log("ATENDIMENTO HUMANO ATIVADO:", numero);

      return res.sendStatus(200);
    }

    if (fromMe && (texto.startsWith("/encerrar") || texto.startsWith("/bot"))) {
       atualizarContato(numero, { estado: ESTADOS.BOT });
       console.log("IA REATIVADA:", numero);

       return res.sendStatus(200);
    }

    if (fromMe) {
       return res.sendStatus(200);
    }

    if (texto.startsWith("/assumir")) {
      atualizarContato(numero, { estado: ESTADOS.HUMANO });
      await enviarMensagem(numero, "Atendimento humano ativado. Um especialista da Altive está acompanhando.");
      return res.sendStatus(200);
    }

    if (texto.startsWith("/encerrar") || texto.startsWith("/bot")) {
      atualizarContato(numero, { estado: ESTADOS.BOT });
      await enviarMensagem(numero, "Atendimento da IA reativado. Pode mandar sua dúvida.");
      return res.sendStatus(200);
    }

    if (c.estado === ESTADOS.AGUARDANDO_CONFIRMACAO_HUMANO && respostaPositiva(texto)) {
      salvarHistorico(numero, "user", mensagem);
      atualizarContato(numero, {
        estado: ESTADOS.HUMANO,
        resumo: c.resumo || "Cliente confirmou que deseja falar com especialista."
      });

      await enviarMensagem(
        numero,
        "Perfeito. Vou encaminhar você para um especialista da Altive. Por favor, aguarde um instante."
      );

      return res.sendStatus(200);
    }

    if (pediuHumano(texto)) {
      salvarHistorico(numero, "user", mensagem);
      atualizarContato(numero, {
        estado: ESTADOS.HUMANO,
        resumo: c.resumo || "Cliente pediu atendimento humano."
      });

      await enviarMensagem(
        numero,
        "Perfeito. Vou encaminhar você para um especialista da Altive. Por favor, aguarde um instante."
      );

      return res.sendStatus(200);
    }

    if (c.estado === ESTADOS.HUMANO) {
      salvarHistorico(numero, "user", mensagem);
      return res.sendStatus(200);
    }

    if (temAlgum(texto, ["link", "endereco", "site oficial"])) {
      await enviarMensagem(numero, `Claro. O site oficial da Altive é:\n${SITE_OFICIAL}`);
      return res.sendStatus(200);
    }

    const intencao = detectarIntencao(texto);
    const tipoOrcamento = tipoOrcamentoPorTexto(texto, intencao);

    salvarHistorico(numero, "user", mensagem);

    const resposta = await gerarRespostaIA({
      numero,
      mensagem,
      texto,
      intencao,
      tipoOrcamento
    });

    const novaMensagem = resposta.mensagem || "Entendi. Posso te ajudar a encontrar o melhor caminho.";
    salvarHistorico(numero, "assistant", novaMensagem);

    const novoEstado =
      resposta.acionar_humano_agora || (deveSugerirHumano(texto, intencao) && pediuHumano(novaMensagem))
        ? ESTADOS.HUMANO
        : resposta.ofereceu_humano
          ? ESTADOS.AGUARDANDO_CONFIRMACAO_HUMANO
          : ESTADOS.BOT;

    atualizarContato(numero, {
      estado: novoEstado,
      resumo: resposta.resumo || c.resumo,
      dados: {
        ...(c.dados || {}),
        ...(resposta.dados || {}),
        intencao,
        tipoOrcamento
      }
    });

    await enviarMensagem(numero, novaMensagem);

    return res.sendStatus(200);
  } catch (erro) {
    console.log("Erro:", erro.response?.data || erro.message);
    return res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Altive IA profissional online na porta ${PORT} 🚀`);
});