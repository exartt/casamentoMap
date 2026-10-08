# Planejador de Mesas de Casamento

Aplicação web para planejar o salão da festa: planta do salão em escala, mesas com cadeiras, elementos fixos (bar, palco, pista, portas…), lista de convidados importada por CSV, distribuição nos assentos por busca ou arrastar e soltar, exportação, impressão e salvamento no servidor com login individual e controle de versão.

Um único app Node.js (Fastify) serve o front-end (React + Konva) e a API em `/api`, com banco MySQL. Feito para rodar na **Hostinger Business** como *Node.js Web App*.

## Sumário

1. [Como rodar localmente](#como-rodar-localmente)
2. [Comandos](#comandos)
3. [Formato do CSV de convidados](#formato-do-csv-de-convidados)
4. [Atalhos de teclado](#atalhos-de-teclado)
5. [Como funciona o salvamento](#como-funciona-o-salvamento)
6. [Publicação na Hostinger](#publicação-na-hostinger)
7. [Onde ver os logs no hPanel](#onde-ver-os-logs-no-hpanel)
8. [Variáveis de ambiente](#variáveis-de-ambiente)
9. [Estrutura do projeto](#estrutura-do-projeto)

## Como rodar localmente

Pré-requisitos: **Node.js 22**, **npm** e **Docker** (para o MySQL).

```bash
# 1. Dependências
npm install

# 2. Banco MySQL 8 em Docker (cria os bancos "mesas" e "mesas_test", usuário mesas/mesas)
docker compose up -d

# 3. Variáveis de ambiente
cp .env.example .env        # no Windows: copy .env.example .env

# 4. Servidor da API (porta 3000) + Vite (porta 5173) em modo watch
npm run dev
```

Abra `http://localhost:5173`. No primeiro acesso a tela **/setup** cria o projeto (nome do casamento e medidas do salão) e a primeira pessoa administradora. As migrações do banco rodam sozinhas quando o servidor sobe.

Para testar o build de produção localmente:

```bash
npm run build
npm start                   # serve dist/client e a API em http://localhost:3000
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe `tsx watch` (API em `:3000`) e o Vite (`:5173`, com proxy de `/api`) |
| `npm run build` | `vite build` → `dist/client` e esbuild → `dist/server/index.js` |
| `npm start` | Roda `dist/server/index.js` |
| `npm test` | Vitest: domínio compartilhado, cliente (jsdom) e API (`app.inject()` contra o banco `mesas_test`) |
| `npm run typecheck` | `tsc --noEmit` em todo o projeto |
| `npm run schema:sql` | Regera `database/schema.sql` a partir das migrações |

Os testes de API usam o banco `mesas_test` do `docker-compose.yml`. Para apontar para outro banco, defina `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_NAME`, `TEST_DB_USER` e `TEST_DB_PASSWORD`.

## Formato do CSV de convidados

- Arquivos `.csv` ou `.txt`; também existe **Colar lista** (um nome por linha).
- Delimitador detectado automaticamente entre `;`, `,` e tabulação (o Excel em pt-BR exporta com `;`).
- Codificação UTF-8 (com ou sem BOM). Arquivos salvos pelo Excel em windows-1252 também são lidos corretamente.
- O cabeçalho é opcional. Sem cabeçalho e com uma só coluna, cada linha é um nome.
- Sinônimos reconhecidos no cabeçalho (sem considerar acento ou maiúsculas):

| Campo | Sinônimos | Valores |
|---|---|---|
| nome | nome, convidado, name | obrigatório |
| grupo | grupo, familia, categoria | texto livre (define a cor da cadeira) |
| lado | lado | noiva, noivo ou ambos |
| criança | crianca, infantil | sim/não, s/n, x, 1/0 |
| restrição | restricao, dieta, alimentacao | texto livre |
| observações | obs, observacoes | texto livre |
| mesa | mesa | rótulo da mesa (`Mesa 3`) ou só o número (`3`); o convidado vai para o próximo assento livre |

Exemplo (o botão **Baixar modelo CSV** gera este arquivo):

```csv
nome;grupo;lado;crianca;restricao;obs;mesa
Maria da Silva;Família da noiva;noiva;nao;vegetariana;;Mesa 1
João Pereira;Amigos do noivo;noivo;nao;;chega tarde;
Ana Conceição;Família do noivo;noivo;sim;;;2
```

Antes de confirmar, a pré-visualização mostra o mapeamento de colunas (ajustável), as primeiras 20 linhas, totais, duplicados (comparação sem acento, sem maiúsculas e com espaços normalizados) e o modo: **Adicionar à lista atual** ou **Substituir lista**. A importação só muda o editor; vira alteração não salva como qualquer outra edição.

O **CSV de lugares** exportado tem as colunas `nome;grupo;mesa;assento`, ordenado por nome, com `;` e UTF-8 com BOM.

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Ctrl+S` | Salvar (funciona sempre, inclusive com um campo de texto focado) |
| `Delete` | Excluir a seleção |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Y` ou `Ctrl+Shift+Z` | Refazer |
| `Ctrl+D` | Duplicar |
| Setas | Mover 0,10 m (`Shift`: 0,50 m) |
| `R` | Girar 90° |
| `Esc` | Limpar a seleção |
| Espaço + arrastar, ou botão do meio | Mover a visão |
| Roda do mouse | Zoom centrado no cursor (10% a 400%) |
| `Shift` + clique | Selecionar vários elementos |
| `Shift` ao girar pela alça | Libera o encaixe de 15° |

Com exceção do `Ctrl+S`, os atalhos não funcionam enquanto um campo de texto está focado.

## Recursos do dia a dia

- **Busca no salão** (caixa no canto superior esquerdo do canvas): digite um nome e as mesas onde ele está sentado ganham destaque, com a cadeira marcada; as demais ficam esmaecidas. A lista abaixo da caixa leva até a mesa.
- **Nomes por mesa** (botão na barra superior): todas as mesas, com o nome atual de cada uma, os assentos numerados e quem senta em cada um. Tem filtro, opção de ocultar assentos livres e "Copiar lista".
- **Modo dia do evento** (botão ★ na barra superior): visão limpa e somente leitura, com a planta, quem está em cada mesa e uma busca grande para achar a pessoa. Tocar numa mesa mostra a lista dela. "Sair do modo evento" (ou Esc) volta ao editor. É a mesma tela usada pelos links de visualização (`/ver/<token>`).
- **Celular e tablet**: em telas até 1023 px (e em tablets com toque até 1366 px) o canvas ocupa a tela inteira. Os painéis abrem pela barra inferior (**Adicionar · Convidados · Mesa · Avisos · Versões**) como gaveta: de baixo no celular, na lateral no tablet. As ações menos usadas ficam no menu **⋯** da barra superior. Um dedo arrasta o salão, dois dedos dão zoom, tocar numa mesa abre as propriedades dela. Para sentar alguém: **Convidados → Sentar** e depois toque na mesa (ou na cadeira exata).

## Como funciona o salvamento

- As edições ficam só no navegador até clicar em **Salvar** (ou `Ctrl+S`). Não há atualização automática: para ver o que outra pessoa salvou, recarregue a página.
- Cada salvamento grava o projeto inteiro como uma nova versão numerada. O histórico guarda as 100 versões mais recentes (aba **Versões**).
- Se alguém salvou depois que você abriu a página, aparece o aviso **"Existe uma versão mais nova"**, com quem salvou, quando e um resumo das mudanças. Dá para cancelar, baixar as suas alterações em JSON ou sobrescrever (a versão da outra pessoa continua no histórico, marcada como sobrescrita).
- Alterações não salvas ficam copiadas no `localStorage` como rascunho. Ao reabrir a página, se o rascunho for diferente da versão do servidor, o app oferece **Recuperar rascunho** ou **Descartar**.
- Uma falha de rede ao salvar mantém tudo na tela; repetir o salvamento usa o mesmo `saveId`, então não cria versão duplicada.

## Publicação na Hostinger

Pré-condições: plano **Business**, um domínio ou subdomínio (ex.: `mesas.seudominio.com.br`) e o repositório no GitHub.

### 1. Criar o banco MySQL e o usuário

No hPanel: **Bancos de dados → MySQL** → crie um banco (ex.: `u123456_mesas`), um usuário e uma senha. Anote os três. O host normalmente é `localhost`, porta `3306`.

### 2. Adicionar o Node.js Web App

No hPanel: **Sites → Adicionar site → Node.js Web App** (ou, no site já existente, **Node.js**) e escolha o domínio ou subdomínio.

### 3. Conectar o GitHub ou enviar o arquivo compactado

- **GitHub (recomendado):** conecte o repositório e a branch principal. Cada push publica uma nova versão.
- **Arquivo compactado:** envie um `.zip` com o conteúdo do repositório (sem `node_modules` e sem `dist`). A Hostinger roda a instalação e o build.

### 4. Preencher as configurações de build

| Campo | Valor |
|---|---|
| Tipo de aplicação | `fastify` |
| Diretório raiz | `/` |
| Script de build | `build` |
| Arquivo de entrada | `dist/server/index.js` |
| Versão do Node | `22` |
| Gerenciador de pacotes | `npm` |

A Hostinger roda `npm install` e depois `npm run build` (cada etapa tem limite de 15 minutos). Para o tipo Fastify ela publica a pasta raiz inteira, incluindo `node_modules`. Por isso as ferramentas de build (Vite, esbuild, TypeScript, Tailwind) estão em `dependencies`: com `NODE_ENV=production` o `npm install` não instala `devDependencies`.

### 5. Preencher as variáveis de ambiente

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | o banco criado no passo 1 |
| `DB_USER` | o usuário criado no passo 1 |
| `DB_PASSWORD` | a senha criada no passo 1 |
| `APP_URL` | `https://mesas.seudominio.com.br` (usado nos links de visualização) |

Não defina `PORT`: a Hostinger define `process.env.PORT` sozinha.

### 6. Ativar o SSL

No hPanel: **Segurança → SSL** → ative o certificado para o domínio. Em produção o app redireciona HTTP para HTTPS usando `x-forwarded-proto`. Se o proxy da hospedagem não enviar esse cabeçalho e aparecer um laço de redirecionamento, defina `FORCE_HTTPS=false`.

### 7. Publicar e acessar `/setup`

Clique em **Deploy**. Quando o processo subir, as migrações criam as tabelas e o app fica no ar. Acesse `https://mesas.seudominio.com.br/setup`, informe o nome do casamento, as medidas do salão e os dados da pessoa administradora. A partir daí, a tela de setup deixa de existir e o acesso é por `/login`.

### Atualizações

Um push na branch principal (ou um novo envio do arquivo) publica a nova versão. Os dados ficam no MySQL e não são tocados; migrações pendentes rodam sozinhas na inicialização (com trava `GET_LOCK`, então dois processos não aplicam a mesma migração).

### Comportamento do processo na Hostinger

A Hostinger para o processo depois de um tempo sem tráfego e o reinicia na próxima requisição. Por isso nada fica em memória: sessões e tentativas de login estão no MySQL, e abrir a página ou salvar pode levar alguns segundos depois de um período sem uso (o app mostra "O servidor está acordando…" e usa timeout de 20 s). O servidor trata `SIGTERM` fechando as conexões.

## Onde ver os logs no hPanel

No hPanel, abra o site → **Node.js** (ou **Node.js Web App**) → aba **Logs** (ou **Execution logs**). Lá aparecem o stdout e o stderr do processo: as linhas de log do Fastify (JSON, uma por requisição, com `reqId`), as migrações aplicadas e qualquer erro de inicialização. Os logs nunca registram senhas, tokens nem listas de convidados. Quando o usuário vê um erro genérico com `requestId`, procure esse valor nos logs.

Os logs de build (`npm install` e `npm run build`) ficam na aba **Deployments** / histórico de implantações.

## Variáveis de ambiente

Veja `.env.example`. Resumo:

| Variável | Padrão | Descrição |
|---|---|---|
| `NODE_ENV` | `development` | `production` na Hostinger |
| `PORT` | `3000` | Porta HTTP (a Hostinger define) |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | — | Conexão MySQL |
| `DB_POOL_SIZE` | `5` | Tamanho máximo do pool (máximo 5) |
| `APP_URL` | — | Endereço público, usado para montar os links de visualização |
| `FORCE_HTTPS` | ligado em produção | Redireciona HTTP para HTTPS |
| `LOG_LEVEL` | `info` em produção, `debug` fora | Nível do pino |
| `TEST_DB_*` | `127.0.0.1` / `3306` / `mesas_test` / `mesas` / `mesas` | Banco usado por `npm test` |

Localmente, o servidor lê um arquivo `.env` na raiz, se existir (variáveis já definidas no ambiente têm prioridade).

## Papéis e segurança

- Não há cadastro público. `/setup` só funciona enquanto não existe usuário.
- **Editor:** edita e salva o projeto, vê e carrega versões antigas. **Admin:** tudo isso, mais **Pessoas com acesso**, **Links de visualização** e **Importar projeto JSON**.
- Senhas com `crypto.scrypt` e salt aleatório; mínimo de 8 caracteres. Senhas provisórias criadas pelo admin obrigam a troca no primeiro acesso. Não há envio de e-mail: quem redefine senha é o admin.
- Sessão em cookie `HttpOnly`, `Secure` (em produção) e `SameSite=Lax`, válida por 30 dias e renovada com o uso. O banco guarda só o hash do token. Toda requisição não-GET autenticada exige o header `X-CSRF-Token`.
- No máximo 5 tentativas erradas de login por e-mail e IP a cada 15 minutos.
- Links de visualização (`/ver/<token>`) são somente leitura, revogáveis, e entregam apenas a planta e o par nome → mesa. O token tem 32 bytes aleatórios; o banco guarda só o hash SHA-256.
- Cabeçalhos de segurança com `@fastify/helmet`, `X-Robots-Tag: noindex` e `Cache-Control: no-store` em toda a API.

## Estrutura do projeto

```
src/
  shared/      tipos, regras de domínio (geometria, assentos, validações, resumo de mudanças) e schemas zod
  server/      Fastify: env, pool MySQL, migrações, autenticação, rotas e serviços
  client/      React: páginas, canvas (Konva), painéis, diálogos, store (Zustand), CSV, exportação
tests/         Vitest: shared, client (jsdom) e api (app.inject + MySQL)
database/      schema.sql gerado e script de inicialização do Docker
scripts/       build do servidor (esbuild) e geração do schema
```

Regras: `src/shared` não importa nada de `client` nem de `server`; `src/server` não importa React nem código de `client`. Todas as regras de negócio existem uma única vez em `src/shared/domain` e são usadas pelos dois lados.

## Fora do escopo

Atualização automática (WebSocket, SSE ou polling), indicação de quem está online, mescla automática de versões, envio de e-mails, RSVP e convites. O código mantém `project_id` nas tabelas e um layout de assentos por tipo de mesa, para permitir vários casamentos e mesas redondas no futuro.
