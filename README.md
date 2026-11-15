# ▶ Reels Lab — Estúdio de Séries & Roteiros Virais

Aplicativo Web e **PWA (instalável no celular e computador)** construído com base nas metodologias **O Meu Modelo de Reels**, **Guia de 33 Profissões / 165 Ideias** e **Código Viral**.

Não precisa de servidor pago, Node.js ou banco de dados externo: basta subir no **GitHub Pages** (gratuito) e usar.

---

## ✨ O que o Reels Lab faz

1. **👤 DNA do Criador (Multi-Perfis):** Cadastre quantos perfis quiser (seu perfil ou de clientes), com persona, dores, desejos, pronome (`tu`/`você`), palavras proibidas (Teste da Conversa), produto e palavra-chave de Direct/ManyChat. Inclui importação rápida de qualquer uma das **33 profissões** do guia.
2. **🔥 Radar de Temas Quentes (Timing):** Pesquisa notícias atuais e tendências do momento (com Google Search via Gemini) e gera 3 ângulos conectados ao seu nicho (**Topo <30s**, **Meio 30–45s**, **Fundo 45–60s**).
3. **🎬 Fábrica de Séries & Roteiros Virais:** Cria o pacote completo do episódio usando os **5 Modelos de Série** + **Código Viral**:
   - Texto fixo na tela (acima da cabeça + Parte X)
   - 3 opções de Headline Viral (Específica + Curiosa + Urgente)
   - Roteiro falado completo sem "oi, gente" e com corte seco *Porta na Cara*
   - **Estúdio de Capa 9:16 (1080×1920 PNG)** com fundo por IA, upload de foto ou templates estúdio + guia da área segura do Feed (4:5)
   - Legenda estratégica pronta + hashtags
   - Prompt técnico de direção e edição com IA (CapCut AI / editores)
4. **🔍 Clube de Análise IA & 🎥 Teleprompter:** Avalia seu roteiro no **Filtro 70%** (O que manter, O que ajustar, O que impede de crescer), otimiza em 1 clique e abre um Teleprompter em **tela cheia** para gravar olhando na altura da câmera.
5. **📁 Pastas de Séries & Catálogo 33 Nichos:** Organiza todos os roteiros e capas em pastas por série com barra de progresso rumo às **15 partes de consistência**, além do navegador com todas as **165 ideias** prontas para usar.
6. **📅 Planejador Semanal & Guia Destrava:** Grade de segunda a domingo para intercalar séries ativas + FAQ interativo com as **14 travas mais comuns**.

---

## 🧠 Como funciona a Memória (Gratuita)

1. **Memória Automática no Navegador (`IndexedDB`):** Tudo o que você cria (perfis, séries, roteiros, capas 9:16 e grade semanal) fica salvo automaticamente no seu aparelho.
2. **Backup em Arquivo (`.json`):** Exporte e restaure seus dados em segundos dentro de **Memória & Drive**.
3. **Sincronização Gratuita com seu Google Drive:**
   - Acesse [script.google.com](https://script.google.com) logado na sua conta Google e crie um **Novo projeto**.
   - Cole o conteúdo do arquivo [`google-apps-script.gs`](./google-apps-script.gs).
   - Clique em **Implantar → Nova implantação → App da Web** (*Executar como: Eu* | *Quem pode acessar: Qualquer pessoa*).
   - Cole a URL gerada dentro do Reels Lab no botão **Memória & Drive** e clique em **Salvar no Drive Agora**. O app criará automaticamente a pasta `Reels Lab - Studio` com subpastas para cada criador e série!

---

## 🤖 Como ativar a IA (Google Gemini API)

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) com sua conta Google.
2. Clique em **Create API key** e copie a chave.
3. No topo do Reels Lab, clique em **IA: Modo Local** e cole sua chave (ela fica salva apenas no seu navegador).

---

## 🚀 Como publicar no GitHub Pages (Gratuito)

1. Crie um repositório no seu GitHub (ex: `reels-lab`).
2. Envie todos os arquivos desta pasta para o repositório:
   ```bash
   git add .
   git commit -m "Versão inicial do Reels Lab"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/reels-lab.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings → Pages**, escolha **Deploy from a branch** (`main` / `/ (root)`) e salve.
4. Em ~1 minuto seu link estará no ar! Abra no navegador do celular ou computador e clique em **"Adicionar à tela inicial / Instalar App"** para usar como aplicativo nativo.

---

## 💻 Como rodar localmente

```bash
python3 -m http.server 8765
```
Depois abra `http://localhost:8765` no navegador.
