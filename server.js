require("dotenv").config();

const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const INSTANCE_ID = "3F3296F6F6BD626842C082171A0617F6";
const INSTANCE_TOKEN = "1241E4AE2EE6AD994D0E3AA4";
const CLIENT_TOKEN = "F784187382a7e42cd8cc6c2b69b72f83cS";

const atendimentoHumano = {};

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

app.get("/painel", (req, res) => {
  const numeros = Object.keys(atendimentoHumano);

  const lista = numeros.length
    ? numeros.map(numero => `
      <div class="card">
        <strong>${numero}</strong>
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

          .btn {
            padding: 10px 15px;
            border-radius: 8px;
            text-decoration: none;
            color: white;
            margin-left: 8px;
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
    "✅ Atendimento assumido por um especialista da Altive."
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
      texto.includes("chama alguém")
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
      texto.includes("site") ||
      texto.includes("link") ||
      texto.includes("endereço") ||
      texto.includes("endereco")
    ) {
      await enviarMensagem(
        numero,
        "Claro! O site oficial da Altive é:\nhttps://altivetech.com.br"
      );

      return res.sendStatus(200);
    }

    const respostaIA = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
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
• soluções em nuvem
• transformação digital

SEU PAPEL:
Você não deve apenas fazer perguntas. Você deve entender o problema do cliente e sugerir soluções reais, práticas e profissionais.

COMO RESPONDER:
- Seja clara, humana, didática e objetiva.
- Não repita "Olá" em toda mensagem.
- Não faça muitas perguntas seguidas.
- Sempre que possível, dê uma sugestão de solução.
- Explique o que a Altive poderia fazer para resolver o problema.
- Se precisar de informação, faça no máximo 1 ou 2 perguntas por vez.
- Evite respostas genéricas.
- Fale como uma consultora de tecnologia, não como robô.
- Demonstre conhecimento técnico real.
- Seja atenta ao contexto da conversa.

EXEMPLO:
Se o cliente disser:
"quero automatizar meu WhatsApp"

Você pode responder:
"Sim, dá para criar uma automação para responder clientes, filtrar interessados, enviar informações sobre serviços e encaminhar para um especialista quando necessário. O ideal seria montar um fluxo com perguntas iniciais, respostas automáticas e opção de atendimento humano."

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
- Você pode recomendar atendimento humano quando perceber:
  • projetos complexos
  • orçamento detalhado
  • integração avançada
  • decisões importantes
  • dúvidas muito específicas
  • necessidade comercial
- Nesses casos, diga naturalmente algo como:
  "Posso encaminhar você para um especialista da Altive para analisarmos isso com mais profundidade."
- Não force atendimento humano sem necessidade.

SITE:
O site oficial da Altive é:
https://altivetech.com.br

Nunca informe altive.com.br.

PREÇOS:
Se perguntarem preço, diga que depende do tipo de projeto, funcionalidades e complexidade. Explique o caminho e ofereça encaminhar para orçamento.

ESPECIALISTA:
Se o cliente quiser falar com especialista, diga que vai encaminhar e peça para aguardar.

TOM:
Profissional, moderno, inteligente, direto e compreensível.

IMPORTANTE:
- Nunca diga que é ChatGPT.
- Não invente promessas.
- Não confirme orçamento fechado sem especialista.
- Não envie respostas muito longas sem necessidade.
`
         },
        {
          role: "user",
          content: mensagem
        }
      ]
    });

    const resposta = respostaIA.choices[0].message.content;

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