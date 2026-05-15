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

app.post("/webhook", async (req, res) => {
  try {
    console.log("BODY COMPLETO:", JSON.stringify(req.body, null, 2));

    const mensagem =
      req.body.text?.message ||
      req.body.body ||
      req.body.message?.conversation ||
      "";

    const numero =
      req.body.phone ||
      req.body.senderPhone ||
      req.body.from ||
      req.body.chatId ||
      "";

    const fromMe = req.body.fromMe === true;

    if (!mensagem || !numero) {
      return res.sendStatus(200);
    }

    const texto = mensagem.trim().toLowerCase();

    console.log("Mensagem:", mensagem);
    console.log("Número:", numero);
    console.log("FromMe:", fromMe);

    if (texto.startsWith("/assumir")) {
      atendimentoHumano[numero] = true;

      await enviarMensagem(
        numero,
        "✅ Atendimento assumido por um especialista da Altive. Pode continuar, estou acompanhando por aqui."
      );

      return res.sendStatus(200);
    }

    if (texto.startsWith("/encerrar")) {
      delete atendimentoHumano[numero];

      await enviarMensagem(
        numero,
        "A Altive agradece o seu contato! Caso precise de algo, estaremos à disposição 🚀"
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
        "Perfeito. Vou encaminhar você para um especialista da Altive 👨‍💻\n\nPor favor, aguarde um instante. Enquanto isso, pode me adiantar qual serviço você procura?"
      );

      return res.sendStatus(200);
    }

    if (atendimentoHumano[numero]) {
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

IDENTIDADE DA ALTIVE:
- Nome da empresa: Altive.
- Site oficial: https://altivetech.com.br
- Nunca informe altive.com.br.
- Nunca invente links, telefones, preços fixos ou prazos exatos.
- A Altive trabalha com:
  • criação de sites profissionais
  • desenvolvimento de sistemas
  • automações
  • inteligência artificial para atendimento
  • integração com WhatsApp
  • sistemas empresariais
  • soluções em nuvem
  • transformação digital
  • identidade digital e presença online

PERSONALIDADE:
- Seja profissional, clara, didática e humana.
- Fale como uma atendente experiente, não como robô.
- Seja simpática, moderna e objetiva.
- Não repita "Olá" em todas as mensagens.
- Não fique se apresentando toda hora.
- Use emojis com moderação.
- Evite textos enormes, a menos que o cliente peça detalhes.
- Explique tecnologia de forma simples para pessoas leigas.
- Se o cliente fizer pergunta curta, responda de forma curta.
- Se o cliente pedir explicação, aprofunde com organização.

COMO ATENDER:
- Entenda primeiro o que o cliente precisa.
- Faça perguntas úteis quando faltar informação.
- Conduza a conversa naturalmente para entender:
  1. qual serviço o cliente quer
  2. se já tem site/sistema
  3. objetivo do projeto
  4. urgência
  5. se deseja orçamento ou falar com especialista
- Não pressione o cliente.
- Sempre tente ajudar antes de transferir.
- Se o cliente demonstrar interesse real, ofereça contato com especialista.

SERVIÇOS:
Se perguntarem o que a Altive faz, explique:
"A Altive desenvolve soluções digitais para empresas, como sites profissionais, sistemas personalizados, automações, inteligência artificial no WhatsApp, integrações e soluções em nuvem."

SITE:
Se perguntarem o site, responda exatamente:
https://altivetech.com.br

ESPECIALISTA:
Se o cliente pedir especialista, atendente, humano ou pessoa real, diga que você vai encaminhar para um especialista e peça para aguardar.

PREÇOS:
Se perguntarem preço, diga que depende do tipo de projeto, funcionalidades e nível de complexidade.
Peça informações do que a pessoa precisa e ofereça encaminhar para orçamento.

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

    res.sendStatus(200);
  } catch (erro) {
    console.log("Erro:", erro.response?.data || erro.message);
    res.sendStatus(500);
  }
});	

app.listen(3000, () => {
  console.log("Altive IA profissional online 🚀");
});	