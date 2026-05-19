require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const INSTANCE_ID = process.env.INSTANCE_ID;
const INSTANCE_TOKEN = process.env.INSTANCE_TOKEN;
const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
const SITE_OFICIAL = "https://altivetech.com.br";
const PORT = process.env.PORT || 3000;
const DADOS_PATH = path.join(__dirname, "dados-bot.json");

const ESTADOS = {
  BOT: "bot",
  AGUARDANDO_HUMANO: "aguardando_humano",
  HUMANO: "humano"
};

const banco = carregarBanco();

const faixasOrcamento = {
  landing_page: {
    nome: "Landing page profissional",
    faixa: "R$ 1.500 a R$ 5.000",
    prazo: "7 a 20 dias",
    obs: "Varia conforme design, texto, formularios, quantidade de secoes e integracoes."
  },
  site: {
    nome: "Site institucional",
    faixa: "R$ 3.000 a R$ 12.000",
    prazo: "15 a 45 dias",
    obs: "Depende da quantidade de paginas, conteudo, SEO, blog, formularios e integracoes."
  },
  ia_whatsapp: {
    nome: "IA ou automacao para WhatsApp",
    faixa: "R$ 2.500 a R$ 15.000+",
    prazo: "10 a 45 dias",
    obs: "Depende do fluxo, uso de IA, base de conhecimento, painel, atendimento humano e integracoes."
  },
  sistema: {
    nome: "Sistema personalizado",
    faixa: "R$ 8.000 a R$ 80.000+",
    prazo: "30 a 120+ dias",
    obs: "Depende de modulos, usuarios, regras de negocio, permissoes, relatorios e escalabilidade."
  },
  dashboard: {
    nome: "Dashboard de dados",
    faixa: "R$ 3.500 a R$ 25.000+",
    prazo: "15 a 60 dias",
    obs: "Depende das fontes de dados, indicadores, automacao de atualizacao e nivel de analise."
  },
  consultoria: {
    nome: "Consultoria digital",
    faixa: "R$ 800 a R$ 5.000 por diagnostico inicial",
    prazo: "3 a 15 dias",
    obs: "Pode incluir arquitetura de dados, plano de sistemas, automacoes, IA e integracoes."
  }
};

const servicosAltive = `
A Altive e uma empresa de tecnologia que cria solucoes digitais para empresas.

Servicos principais:
- Desenvolvimento web: sites institucionais, landing pages, paginas de venda, portais e experiencias responsivas.
- Automacao de processos: automacao de atendimento, cadastros, tarefas repetitivas, integracoes e rotinas internas.
- Sistemas personalizados: CRM proprio, ERP leve, paineis administrativos, sistemas internos e plataformas sob medida.
- Operacoes complexas: solucoes com controle, escalabilidade, permissoes, auditoria, multiplas areas e integracoes profundas.
- Inteligencia artificial: IA para WhatsApp, atendimento, suporte, vendas, triagem, analise de dados e assistentes internos.
- Dashboards de dados: paineis para vendas, financeiro, operacao, produtividade, atendimento e indicadores estrategicos.
- Consultoria digital: diagnostico, arquitetura de dados, mapa de automacoes, estrategia de sistemas e implantacao.
`;

function carregarBanco() {
  try {
    if (!fs.existsSync(DADOS_PATH)) {
      return { contatos: {} };
    }

    return JSON.parse(fs.readFileSync(DADOS_PATH, "utf8"));
  } catch (erro) {
    console.log("Erro ao carregar banco local:", erro.message);
    return { contatos: {} };
  }
}

function salvarBanco() {
  fs.writeFileSync(DADOS_PATH, JSON.stringify(banco, null, 2));
}

function normalizarNumero(numero) {
  return String(numero || "").replace(/\D/g, "");
}

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  return normalizarNumero(
    body.phone ||
    body.senderPhone ||
    body.from ||
    body.chatId ||
    ""
  );
}

function contato(numero) {
  if (!banco.contatos[numero]) {
    banco.contatos[numero] = {
      numero,
      estado: ESTADOS.BOT,
      resumo: "",
      dados: {},
      historico: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    salvarBanco();
  }

  return banco.contatos[numero];
}

function atualizarContato(numero, dados) {
  const c = contato(numero);

  Object.assign(c, dados, {
    atualizadoEm: new Date().toISOString()
  });

  salvarBanco();
  return c;
}

function salvarHistorico(numero, role, content) {
  const c = contato(numero);

  c.historico.push({
    role,
    content,
    at: new Date().toISOString()
  });

  if (c.historico.length > 24) {
    c.historico = c.historico.slice(-24);
  }

  c.atualizadoEm = new Date().toISOString();
  salvarBanco();
}

function ultimasMensagens(numero) {
  return contato(numero).historico.map(item => ({
    role: item.role,
    content: item.content
  }));
}

function contem(texto, palavras) {
  return palavras.some(palavra => texto.includes(palavra));
}

function respostaPositiva(texto) {
  const t = normalizarTexto(texto);

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
  ].some(palavra => t === palavra || t.includes(palavra));
}

function pediuHumano(texto) {
  const t = normalizarTexto(texto);

  return contem(t, [
    "atendente",
    "humano",
    "especialista",
    "consultor",
    "vendedor",
    "pessoa",
    "pessoa real",
    "falar com alguem",
    "falar com uma pessoa",
    "chama alguem",
    "chamar alguem"
  ]);
}

function detectarIntencao(texto) {
  const t = normalizarTexto(texto);

  if (contem(t, ["orcamento", "quanto custa", "valor", "preco", "investimento"])) {
    return "orcamento";
  }

  if (contem(t, ["landing"])) return "landing_page";
  if (contem(t, ["site", "pagina", "web"])) return "site";
  if (contem(t, ["whatsapp", "zap", "automacao", "chatbot", "bot", "ia", "inteligencia artificial"])) return "ia_whatsapp";
  if (contem(t, ["dashboard", "bi", "relatorio", "indicador", "dados"])) return "dashboard";
  if (contem(t, ["sistema", "software", "plataforma", "painel", "crm", "erp"])) return "sistema";
  if (contem(t, ["consultoria", "arquitetura", "diagnostico", "estrategia"])) return "consultoria";
  if (contem(t, ["empresa", "altive", "o que voces fazem", "quem sao"])) return "sobre";

  return "geral";
}

function tipoOrcamento(texto, intencao) {
  const t = normalizarTexto(texto);

  if (contem(t, ["landing"])) return "landing_page";
  if (contem(t, ["site", "pagina"])) return "site";
  if (contem(t, ["whatsapp", "zap", "ia", "chatbot", "bot", "automacao"])) return "ia_whatsapp";
  if (contem(t, ["dashboard", "bi", "relatorio", "dados"])) return "dashboard";
  if (contem(t, ["sistema", "software", "plataforma", "painel", "crm", "erp"])) return "sistema";
  if (contem(t, ["consultoria", "arquitetura", "diagnostico"])) return "consultoria";

  if (faixasOrcamento[intencao]) return intencao;

  return null;
}

function deveOferecerHumano(texto, intencao) {
  const t = normalizarTexto(texto);

  return (
    intencao === "orcamento" ||
    contem(t, [
      "contratar",
      "fechar",
      "proposta",
      "reuniao",
      "urgente",
      "integracao",
      "api",
      "banco de dados",
      "complexo",
      "empresa"
    ])
  );
}

function contextoOrcamento(tipo) {
  if (!tipo || !faixasOrcamento[tipo]) {
    return "Tipo de projeto ainda indefinido. Se o cliente pedir valores, explique que depende se e site, IA, automacao, sistema, dashboard ou consultoria.";
  }

  const item = faixasOrcamento[tipo];

  return `
Referencia de preco para ${item.nome}:
- Faixa inicial comum: ${item.faixa}
- Prazo comum: ${item.prazo}
- Observacao: ${item.obs}

Use como estimativa inicial, nunca como proposta fechada.
`;
}

async function pesquisarMercadoSeDisponivel(consulta) {
  if (!process.env.SERPAPI_KEY) {
    return "Pesquisa externa nao configurada. Use as faixas internas como referencia.";
  }

  try {
    const resposta = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google",
        q: consulta,
        gl: "br",
        hl: "pt-br",
        api_key: process.env.SERPAPI_KEY
      },
      timeout: 8000
    });

    const resultados = resposta.data.organic_results || [];

    return resultados
      .slice(0, 4)
      .map(item => `- ${item.title}: ${item.snippet || item.link}`)
      .join("\n") || "Pesquisa externa sem resultado util.";
  } catch (erro) {
    console.log("Erro ao pesquisar mercado:", erro.message);
    return "Nao consegui pesquisar mercado agora. Use as faixas internas.";
  }
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

async function gerarRespostaIA(numero, mensagem, intencao, tipo) {
  const c = contato(numero);

  const mercado =
    intencao === "orcamento" || tipo
      ? await pesquisarMercadoSeDisponivel(`preco medio Brasil ${faixasOrcamento[tipo]?.nome || "desenvolvimento de software"} 2026`)
      : "Nao necessario.";

  const resposta = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Voce e a assistente virtual oficial da Altive.

${servicosAltive}

Site oficial: ${SITE_OFICIAL}
Nunca informe outro dominio.

Estado do cliente:
- Estado: ${c.estado}
- Resumo: ${c.resumo || "sem resumo"}
- Dados: ${JSON.stringify(c.dados || {})}

Orcamento:
${contextoOrcamento(tipo)}

Mercado:
${mercado}

Regras:
- Responda em portugues do Brasil.
- Seja objetiva, humana, inteligente e consultiva.
- Nao diga que e ChatGPT.
- Nao de preco fechado. De faixa estimada quando fizer sentido.
- Se o cliente pedir valores, explique faixa e variaveis de complexidade.
- Se fizer sentido falar com especialista, ofereca e diga que ele pode responder "sim", "ok" ou "pode".
- Nao prometa spam, disparo abusivo ou burlar regras do WhatsApp.
- Faca no maximo uma pergunta por resposta.

Responda somente JSON valido neste formato:
{
  "mensagem": "mensagem para enviar ao cliente",
  "ofereceu_humano": true,
  "acionar_humano_agora": false,
  "resumo": "resumo curto",
  "dados": {
    "interesse": "servico provavel",
    "complexidade": "baixa|media|alta|desconhecida",
    "orcamento_tipo": "tipo provavel"
  }
}
`
      },
      ...ultimasMensagens(numero),
      {
        role: "user",
        content: mensagem
      }
    ]
  });

  try {
    return JSON.parse(resposta.choices[0].message.content);
  } catch (erro) {
    return {
      mensagem: "Entendi. A Altive consegue analisar esse projeto e te orientar com uma solucao adequada. Voce esta pensando em site, sistema, automacao, IA ou dashboard?",
      ofereceu_humano: false,
      acionar_humano_agora: false,
      resumo: c.resumo || "Cliente entrou em contato com interesse em solucao digital.",
      dados: c.dados || {}
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

  const lista = contatos.length
    ? contatos.map(c => {
        const status =
          c.estado === ESTADOS.HUMANO
            ? "Atendimento humano ativo"
            : c.estado === ESTADOS.AGUARDANDO_HUMANO
              ? "Aguardando confirmacao do cliente"
              : "IA atendendo";

        const ultima = c.historico[c.historico.length - 1]?.content || "Sem mensagens ainda.";

        return `
          <article class="card ${c.estado}">
            <div class="topo">
              <div>
                <strong>${escaparHtml(c.numero)}</strong>
                <p>${escaparHtml(status)}</p>
              </div>
              <small>${new Date(c.atualizadoEm).toLocaleString("pt-BR")}</small>
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
      }).join("")
    : "<p>Nenhum contato registrado ainda.</p>";

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Painel Altive</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 28px;
            font-family: Arial, sans-serif;
            background: #0b1020;
            color: #f8fafc;
          }
          h1 {
            margin: 0 0 6px;
            color: #38bdf8;
            font-size: 30px;
          }
          .sub {
            margin: 0 0 24px;
            color: #94a3b8;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 14px;
          }
          .card {
            background: #151d31;
            border: 1px solid #27344d;
            border-radius: 8px;
            padding: 18px;
          }
          .card.humano { border-color: #22c55e; }
          .card.aguardando_humano { border-color: #f59e0b; }
          .topo {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          strong { font-size: 18px; }
          p {
            color: #a8b3c7;
            line-height: 1.4;
          }
          small {
            color: #64748b;
            white-space: nowrap;
          }
          .resumo {
            color: #e2e8f0;
          }
          .ultima {
            background: #0f172a;
            padding: 10px;
            border-radius: 8px;
            max-height: 100px;
            overflow: auto;
          }
          .acoes {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 14px;
          }
          .btn {
            color: white;
            text-decoration: none;
            padding: 9px 12px;
            border-radius: 7px;
            font-size: 14px;
          }
          .assumir { background: #2563eb; }
          .bot { background: #475569; }
          .encerrar { background: #16a34a; }
        </style>
      </head>
      <body>
        <h1>Painel de Atendimento Altive</h1>
        <p class="sub">Contatos, estados da IA e atendimentos humanos.</p>
        <main class="grid">${lista}</main>
      </body>
    </html>
  `;
}

app.get("/", (req, res) => {
  res.redirect("/painel");
});

app.get("/painel", (req, res) => {
  res.send(renderPainel());
});

app.get("/assumir/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);

  atualizarContato(numero, {
    estado: ESTADOS.HUMANO,
    resumo: contato(numero).resumo || "Atendimento assumido pelo painel."
  });

  try {
    await enviarMensagem(
      numero,
      "Atendimento assumido por um especialista da Altive. Pode continuar por aqui, nossa equipe esta acompanhando."
    );
  } catch (erro) {
    console.log("Erro ao avisar cliente:", erro.response?.data || erro.message);
  }

  res.redirect("/painel");
});

app.get("/bot/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);

  atualizarContato(numero, {
    estado: ESTADOS.BOT
  });

  try {
    await enviarMensagem(
      numero,
      "Pronto, a assistente virtual da Altive voltou para te ajudar por aqui."
    );
  } catch (erro) {
    console.log("Erro ao avisar cliente:", erro.response?.data || erro.message);
  }

  res.redirect("/painel");
});

app.get("/encerrar/:numero", async (req, res) => {
  const numero = normalizarNumero(req.params.numero);

  atualizarContato(numero, {
    estado: ESTADOS.BOT
  });

  try {
    await enviarMensagem(
      numero,
      "A Altive agradece o seu contato. O atendimento humano foi encerrado e nossa assistente virtual esta de volta."
    );
  } catch (erro) {
    console.log("Erro ao avisar cliente:", erro.response?.data || erro.message);
  }

  res.redirect("/painel");
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("BODY:", JSON.stringify(req.body, null, 2));

    const mensagem = pegarMensagem(req.body);
    const numero = pegarNumero(req.body);
    const fromMe = req.body.fromMe === true;

    if (!mensagem || !numero) {
      return res.sendStatus(200);
    }

    const texto = normalizarTexto(mensagem);
    const c = contato(numero);

    console.log("Mensagem:", mensagem);
    console.log("Numero:", numero);
    console.log("FromMe:", fromMe);
    console.log("Estado:", c.estado);

    if (fromMe && texto.startsWith("/assumir")) {
      atualizarContato(numero, { estado: ESTADOS.HUMANO });
      console.log("Atendimento humano ativado por comando:", numero);
      return res.sendStatus(200);
    }

    if (fromMe && (texto.startsWith("/encerrar") || texto.startsWith("/bot"))) {
      atualizarContato(numero, { estado: ESTADOS.BOT });
      console.log("IA reativada por comando:", numero);
      return res.sendStatus(200);
    }

    if (fromMe) {
      return res.sendStatus(200);
    }

    salvarHistorico(numero, "user", mensagem);

    if (texto.startsWith("/assumir") || pediuHumano(texto)) {
      atualizarContato(numero, {
        estado: ESTADOS.HUMANO,
        resumo: c.resumo || "Cliente pediu atendimento humano."
      });

      await enviarMensagem(
        numero,
        "Perfeito. Vou encaminhar voce para um especialista da Altive. Por favor, aguarde um instante."
      );

      return res.sendStatus(200);
    }

    if (texto.startsWith("/encerrar") || texto.startsWith("/bot")) {
      atualizarContato(numero, { estado: ESTADOS.BOT });

      await enviarMensagem(
        numero,
        "Atendimento da IA reativado. Pode mandar sua duvida."
      );

      return res.sendStatus(200);
    }

    if (c.estado === ESTADOS.AGUARDANDO_HUMANO && respostaPositiva(texto)) {
      atualizarContato(numero, {
        estado: ESTADOS.HUMANO,
        resumo: c.resumo || "Cliente confirmou que deseja falar com especialista."
      });

      await enviarMensagem(
        numero,
        "Perfeito. Vou encaminhar voce para um especialista da Altive. Por favor, aguarde um instante."
      );

      return res.sendStatus(200);
    }

    if (c.estado === ESTADOS.HUMANO) {
      return res.sendStatus(200);
    }

    if (contem(texto, ["link", "endereco", "site oficial"])) {
      await enviarMensagem(numero, `Claro. O site oficial da Altive e:\n${SITE_OFICIAL}`);
      return res.sendStatus(200);
    }

    const intencao = detectarIntencao(texto);
    const tipo = tipoOrcamento(texto, intencao);

    const resposta = await gerarRespostaIA(numero, mensagem, intencao, tipo);

    const mensagemFinal =
      resposta.mensagem ||
      "Entendi. Posso te ajudar a encontrar o melhor caminho para esse projeto.";

    salvarHistorico(numero, "assistant", mensagemFinal);

    const novoEstado = resposta.acionar_humano_agora
      ? ESTADOS.HUMANO
      : resposta.ofereceu_humano || deveOferecerHumano(texto, intencao)
        ? ESTADOS.AGUARDANDO_HUMANO
        : ESTADOS.BOT;

    atualizarContato(numero, {
      estado: novoEstado,
      resumo: resposta.resumo || c.resumo,
      dados: {
        ...(c.dados || {}),
        ...(resposta.dados || {}),
        intencao,
        tipoOrcamento: tipo
      }
    });

    await enviarMensagem(numero, mensagemFinal);

    return res.sendStatus(200);
  } catch (erro) {
    console.log("Erro no webhook:", erro.response?.data || erro.message);
    return res.sendStatus(500);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Altive IA profissional online na porta ${PORT}`);
});