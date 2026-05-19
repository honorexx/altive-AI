require("dotenv").config();

const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Coloque esses dados no arquivo .env
const INSTANCE_ID = process.env.INSTANCE_ID;
const INSTANCE_TOKEN = process.env.INSTANCE_TOKEN;
const CLIENT_TOKEN = process.env.CLIENT_TOKEN;

const atendimentoHumano = {};
const historicoConversas = {};

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
  const numero =
    body.phone ||
    body.senderPhone ||
    body.from ||
    body.chatId ||
    "";

  return normalizarNumero(numero);
}

function normalizarTexto(mensagem) {
  return String(mensagem || "")
    .trim()
    .toLowerCase()
    .replace(/^\/\s+/, "/");
}

function salvarHistorico(numero, role, content) {
  if (!historicoConversas[numero]) {
    historicoConversas[numero] = [];
  }

  historicoConversas[numero].push({ role, content });

  // Mantém só as últimas mensagens para a IA não ficar pesada
  if (historicoConversas[numero].length > 14) {
    historicoConversas[numero] = historicoConversas[numero].slice(-14);
  }
}

function detectarIntencao(texto) {
  if (
    texto.includes("site") ||
    texto.includes("landing") ||
    texto.includes("pagina") ||
    texto.includes("página")
  ) {
    return "site";
  }

  if (
    texto.includes("whatsapp") ||
    texto.includes("zap") ||
    texto.includes("automação") ||
    texto.includes("automacao") ||
    texto.includes("mensagem automática") ||
    texto.includes("mensagem automatica")
  ) {
    return "automacao_whatsapp";
  }

  if (
    texto.includes("ia") ||
    texto.includes("inteligência artificial") ||
    texto.includes("inteligencia artificial") ||
    texto.includes("chatbot") ||
    texto.includes("bot")
  ) {
    return "ia";
  }

  if (
    texto.includes("sistema") ||
    texto.includes("plataforma") ||
    texto.includes("software") ||
    texto.includes("dashboard") ||
    texto.includes("painel")
  ) {
    return "sistema";
  }

  if (
    texto.includes("valor") ||
    texto.includes("preço") ||
    texto.includes("preco") ||
    texto.includes("orçamento") ||
    texto.includes("orcamento") ||
    texto.includes("quanto custa")
  ) {
    return "orcamento";
  }

  if (
    texto.includes("empresa") ||
    texto.includes("altive") ||
    texto.includes("quem são") ||
    texto.includes("quem sao") ||
    texto.includes("o que vocês fazem") ||
    texto.includes("oque vocês fazem") ||
    texto.includes("o que voces fazem")
  ) {
    return "sobre_altive";
  }

  return "geral";
}

function contextoPorIntencao(intencao) {
  const contextos = {
    site: `
O cliente parece interessado em site ou landing page.
Explique que a Altive pode criar uma presença digital profissional, com design moderno, responsivo, rápido, estratégico e voltado para conversão.
Sugira possibilidades como: página institucional, landing page para campanhas, página de serviços, formulário de contato, botão de WhatsApp, SEO básico e integração com ferramentas.
`,

    automacao_whatsapp: `
O cliente parece interessado em automação no WhatsApp.
Explique que a Altive pode criar fluxos inteligentes para responder clientes, filtrar interessados, explicar serviços, coletar informações e encaminhar para humano quando necessário.
Deixe claro que não é recomendado disparar mensagens em massa sem autorização, pois isso pode bloquear ou restringir o número.
Sugira uma automação segura e profissional.
`,

    ia: `
O cliente parece interessado em inteligência artificial.
Explique que a Altive pode criar uma IA para atendimento, suporte, qualificação comercial, dúvidas frequentes, triagem de clientes e integração com WhatsApp ou sistemas.
Mostre que a IA pode ser treinada com informações da empresa, serviços, regras, limites e linguagem da marca.
`,

    sistema: `
O cliente parece interessado em sistema, software, painel ou plataforma.
Explique que a Altive pode criar sistemas personalizados para organizar processos, cadastrar clientes, acompanhar pedidos, controlar tarefas, gerar relatórios, automatizar rotinas e centralizar informações.
`,

    orcamento: `
O cliente está falando de preço ou orçamento.
Explique que o valor depende do tipo de projeto, quantidade de funcionalidades, integrações e complexidade.
Não informe valor fechado sem análise.
Conduza para entender rapidamente a necessidade e ofereça encaminhar para especialista.
`,

    sobre_altive: `
O cliente quer entender a Altive.
Explique que a Altive é uma empresa de tecnologia que cria soluções digitais para empresas, como sites, sistemas, automações, IA, integração com WhatsApp e transformação digital.
Passe segurança, profissionalismo e clareza.
`,

    geral: `
O cliente ainda não deixou totalmente claro o que precisa.
Responda com inteligência, tente identificar o problema e ofereça possibilidades reais sem fazer muitas perguntas.
`
  };

  return contextos[intencao] || contextos.geral;
}

app.get("/painel", (req, res) => {
  const numeros = Object.keys(atendimentoHumano);

  const lista = numeros.length
    ? numeros.map(numero => `
      <div class="card">
        <div>
          <strong>${numero}</strong>
          <p>Atendimento humano ativo</p>
        </div>
        <div>
          <a class="btn assumir" href="/assumir/${numero}">Assumir</a>
          <a class="btn encerrar" href="/encerrar/${numero}">Encerrar</a>
        </div>
      </div>
    `).join("")
    : "<p>Nenhum atendimento humano ativo.</p>";

  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Painel Altive</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0f172a;
            color: white;
            padding: 30px;
          }

          h1 {
            color: #38bdf8;
          }

          .card {
            background: #1e293b;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .card p {
            color: #94a3b8;
            margin: 5px 0 0;
          }

          .btn {
            padding: 10px 15px;
            border-radius: 8px;
            text-decoration: none;
            color: white;
            margin-left: 8px;
            display: inline-block;
          }

          .assumir {
            background: #2563eb;
          }

          .encerrar {
            background: #16a34a;
          }
        </style>
      </head>

      <body>
        <h1>Painel de Atendimento Altive</h1>
        ${lista}
      </body>
    </html>
  `);
});

app.get("/assumir/:numero", async (req, res) => {
  const numero = req.params.numero;

  atendimentoHumano[numero] = true;

  await enviarMensagem(
    numero,
    "✅ Atendimento assumido por um especialista da Altive. Pode continuar por aqui, nossa equipe está acompanhando."
  );

  res.redirect("/painel");
});

app.get("/encerrar/:numero", async (req, res) => {
  const numero = req.params.numero;

  delete atendimentoHumano[numero];

  await enviarMensagem(
    numero,
    "A Altive agradece o seu contato! O atendimento humano foi encerrado e nossa assistente virtual está de volta. 🚀"
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

    const texto = normalizarTexto(mensagem);

    console.log("Mensagem:", mensagem);
    console.log("Número:", numero);
    console.log("FromMe:", fromMe);
    console.log("Modo humano:", atendimentoHumano[numero]);

    const comandoAssumir = texto.startsWith("/assumir");
    const comandoEncerrar = texto.startsWith("/encerrar");

    if (comandoAssumir) {
      atendimentoHumano[numero] = true;

      await enviarMensagem(
        numero,
        "✅ Atendimento assumido por um especialista da Altive. Pode continuar, estou acompanhando por aqui."
      );

      return res.sendStatus(200);
    }

    if (comandoEncerrar) {
      delete atendimentoHumano[numero];

      await enviarMensagem(
        numero,
        "A Altive agradece o seu contato! O atendimento humano foi encerrado e nossa assistente virtual está de volta. 🚀"
      );

      return res.sendStatus(200);
    }

    if (fromMe) {
      return res.sendStatus(200);
    }

    if (
      texto.includes("especialista") ||
      texto.includes("atendente") ||
      texto.includes("humano") ||
      texto.includes("falar com alguém") ||
      texto.includes("falar com uma pessoa") ||
      texto.includes("quero falar com alguém") ||
      texto.includes("chama alguém") ||
      texto.includes("chamar alguem") ||
      texto.includes("pessoa real")
    ) {
      atendimentoHumano[numero] = true;

      await enviarMensagem(
        numero,
        "Perfeito. Vou encaminhar você para um especialista da Altive 👨‍💻\n\nPor favor, aguarde um instante."
      );

      return res.sendStatus(200);
    }

    if (atendimentoHumano[numero]) {
      return res.sendStatus(200);
    }

    if (
      texto.includes("link") ||
      texto.includes("endereço") ||
      texto.includes("endereco") ||
      texto.includes("site oficial")
    ) {
      await enviarMensagem(
        numero,
        "Claro! O site oficial da Altive é:\nhttps://altivetech.com.br"
      );

      return res.sendStatus(200);
    }

    const intencao = detectarIntencao(texto);
    const contextoExtra = contextoPorIntencao(intencao);

    salvarHistorico(numero, "user", mensagem);

    const respostaIA = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.75,
      messages: [
        {
          role: "system",
          content: `
Você é a assistente virtual oficial da Altive, uma empresa moderna de tecnologia.

A Altive cria soluções digitais para empresas, como:
• sites profissionais
• landing pages
• sistemas personalizados
• automações
• inteligência artificial para atendimento
• integração com WhatsApp
• sistemas internos
• painéis administrativos
• dashboards
• soluções em nuvem
• transformação digital

SOBRE A ALTIVE:
A Altive ajuda empresas a ficarem mais profissionais, organizadas e eficientes usando tecnologia.
A empresa pode criar desde um site moderno até automações, sistemas internos e atendentes virtuais com IA.
O objetivo é elevar o negócio do cliente para um nível mais digital, profissional e inteligente.

SITE OFICIAL:
https://altivetech.com.br
Nunca informe altive.com.br.

SEU PAPEL:
Você não deve apenas fazer perguntas.
Você deve entender o problema do cliente e sugerir soluções reais, práticas e profissionais.
Você deve soar como uma consultora de tecnologia experiente, não como um robô genérico.

COMO RESPONDER:
- Seja clara, humana, didática e objetiva.
- Não repita "Olá" em toda mensagem.
- Não faça muitas perguntas seguidas.
- Sempre que possível, dê uma sugestão de solução.
- Explique o que a Altive poderia fazer para resolver o problema.
- Se precisar de informação, faça no máximo 1 ou 2 perguntas por vez.
- Evite respostas genéricas.
- Demonstre conhecimento técnico real, mas sem complicar.
- Seja atenta ao contexto da conversa.
- Não responda como se fosse suporte técnico frio.
- Responda como uma consultora que quer ajudar o cliente a tomar uma decisão.

FORMATO IDEAL:
Quando o cliente trouxer um problema, responda assim:
1. Mostre que entendeu.
2. Explique uma solução possível.
3. Mostre como a Altive poderia ajudar.
4. Faça no máximo uma pergunta útil para avançar.

EXEMPLO 1:
Cliente: "quero automatizar meu WhatsApp"
Resposta boa:
"Dá para criar uma automação no WhatsApp para responder clientes, filtrar interessados, explicar seus serviços e encaminhar para um especialista quando necessário. O ideal é montar um fluxo com respostas inteligentes, opção de atendimento humano e regras para evitar mensagens abusivas. Você quer automatizar atendimento, vendas ou suporte?"

EXEMPLO 2:
Cliente: "preciso de um site"
Resposta boa:
"Perfeito. Um site profissional pode ajudar sua empresa a passar mais confiança, apresentar serviços e receber contatos pelo WhatsApp. A Altive pode criar uma página moderna, responsiva e conectada com formulários, botões de contato e até automações. Seria um site institucional ou uma página focada em vender um serviço específico?"

EXEMPLO 3:
Cliente: "quanto custa?"
Resposta boa:
"O valor depende do tipo de projeto, quantidade de páginas, funcionalidades e integrações. Um site simples, uma landing page e um sistema com IA têm níveis bem diferentes de complexidade. Me diga rapidamente o que você quer criar que eu te explico o caminho ideal e posso encaminhar para um especialista montar o orçamento."

LIMITES IMPORTANTES:
- Nunca prometa automações abusivas ou spam.
- Não ofereça sistema para disparar mensagens em massa para centenas de pessoas no WhatsApp.
- Explique que enviar 500 mensagens para 500 pessoas diferentes pode derrubar, bloquear ou restringir o número.
- Para campanhas, recomende formas seguras:
  • lista de transmissão autorizada
  • clientes que deram consentimento
  • campanhas moderadas
  • WhatsApp Business API oficial
  • funis com captação voluntária
- Não prometa burlar regras do WhatsApp.
- Não incentive envio de mensagens sem autorização.

ATENDIMENTO HUMANO:
Você pode recomendar atendimento humano quando perceber:
• projetos complexos
• orçamento detalhado
• integração avançada
• decisões importantes
• dúvidas muito específicas
• necessidade comercial

Nesses casos, diga naturalmente:
"Posso encaminhar você para um especialista da Altive para analisarmos isso com mais profundidade."

PREÇOS:
Se perguntarem preço, diga que depende do tipo de projeto, funcionalidades e complexidade.
Não confirme orçamento fechado sem especialista.

TOM:
Profissional, moderno, inteligente, direto e compreensível.

IMPORTANTE:
- Nunca diga que é ChatGPT.
- Não invente promessas.
- Não confirme orçamento fechado sem especialista.
- Não envie respostas muito longas sem necessidade.
- Não seja passiva. Sugira caminhos.
- Não diga apenas "me fale mais". Ajude antes de perguntar.

CONTEXTO DA MENSAGEM ATUAL:
Intenção detectada: ${intencao}
${contextoExtra}
`
        },
        ...historicoConversas[numero]
      ]
    });

    const resposta = respostaIA.choices[0].message.content;

    salvarHistorico(numero, "assistant", resposta);

    await enviarMensagem(numero, resposta);

    return res.sendStatus(200);
  } catch (erro) {
    console.log("Erro:", erro.response?.data || erro.message);
    return res.sendStatus(500);
  }
});

app.listen(3000, () => {
  console.log("Altive IA profissional online 🚀");
});
```