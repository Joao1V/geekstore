---
description: Generate/update end-user (non-technical) business-rule docs under docs/users/, one module at a time.
argument-hint: "[módulo específico | vazio para continuar a fila pendente]"
---

# User Docs Command

**Input**: $ARGUMENTS

Translates business rules embedded in the code (toggles, config options, conditional
behavior) into plain-language documentation for **end users** — agentes, supervisores,
admins do CRM — organized por módulo, salva em `docs/users/`.

This is different from every other doc folder in the project:

| Pasta | Público | Conteúdo |
|---|---|---|
| `docs/api/` | Devs | Referência técnica da API (payloads, schemas, endpoints) |
| `docs/planning/` | Devs | Backlog de features a implementar |
| `docs/users/` | **Usuário final** | O que cada tela/opção faz e quando usar — zero jargão técnico |

Do not write or edit any application code from this command. Output is documentation only.

## Estratégia: um módulo por execução (obrigatório)

O sistema tem mais de uma dezena de módulos (board, lanes, subprocesso, jurídico,
escritórios, squads, usuários, papéis, teses jurídicas, integrações, dashboard,
tracking...), cada um com várias regras de negócio. Tentar documentar tudo de uma vez
produz texto raso e genérico. Em vez disso:

1. `docs/users/README.md` funciona como índice **e** checklist: uma linha por módulo,
   com status `✅ Documentado`, `⏳ Pendente` ou `🚧 Desatualizado`, e a data da última
   atualização.
2. Cada execução deste comando escreve o conteúdo de **exatamente um módulo** (ou um
   par bem acoplado, ex: "board" + "lanes", já que lane só existe dentro de um board) —
   a menos que o usuário peça explicitamente para continuar em lote.
3. Tratamento do argumento:
   - **Módulo nomeado** (`/user-docs board`, `/user-docs escritórios`,
     `/user-docs subprocesso`) → trabalha nesse módulo. Se for um subtema de um módulo
     já documentado (ex: "subprocesso" é parte de "board"), atualiza a seção
     correspondente no arquivo existente em vez de criar um arquivo novo.
   - **Vazio** → lê o checklist em `docs/users/README.md` e pega o próximo
     `⏳ Pendente` de cima pra baixo. Se `docs/users/` ainda não existir, primeiro
     executa o Passo 1 (inventário) para popular o checklist inteiro, e então escreve
     o conteúdo de **apenas o primeiro** módulo da fila — não os demais.
   - **"Faz todos" / "continua até terminar"** → processa a fila inteira, mas ainda
     um módulo de cada vez internamente (sem pular o Passo 2 de embasamento para
     nenhum deles) e sem parar para perguntar a cada módulo.

## Passo 1 — Inventariar os módulos (só na primeira execução, ou quando surgir módulo novo)

Descobrir os módulos a partir de:
- Pastas de rota em `app/painel/*` (cada pasta de topo é geralmente uma tela/módulo)
- A estrutura de `user.menu` / `components/board-sidebar.tsx` — a lista de módulos deve
  espelhar o que o usuário final realmente vê no menu, não a organização interna de
  arquivos
- Sub-áreas grandes o suficiente para merecer arquivo próprio dentro de um módulo maior
  (ex: dentro de "board" — lanes, subprocesso, jurídico — só separar se forem
  conceitualmente distintas o bastante pro usuário)

Para cada módulo descoberto, adiciona uma linha em `docs/users/README.md` marcada
`⏳ Pendente`, sem escrever o conteúdo ainda.

## Passo 2 — Embasar antes de escrever

Para o módulo desta execução:
- Ler os componentes/páginas reais envolvidos (grep/glob — nunca supor um caminho)
- Identificar as **opções/regras que realmente mudam o comportamento pro usuário**:
  booleanos, selects, configs (ex: `juridical_board`, `subprocess`, `finished_lane`,
  `max_inactivity_minutes`, `max_follow_up`, a inversão `completed_info`/observação
  obrigatória, níveis de permissão OWNER/MEMBER/VIEWER etc.)
- Para cada uma: **o que é**, **quando usar**, **o que muda na prática** — nunca o nome
  do campo, o tipo, ou o componente que implementa
- Checar a memória do projeto e o `CLAUDE.md` por enquadramento de negócio já
  estabelecido (ex: a memória de permissão de board já tem os rótulos de negócio
  corretos — Admin/Ver-Editar/Ver-todas — reaproveitar, não reinventar)
- Ignorar detalhe de implementação (estado local, chave de SWR, endpoint, verbo HTTP) —
  nada disso entra neste doc

## Passo 3 — Escrever em português simples, não técnico

Público: quem usa o CRM no dia a dia — não é dev.

- Nunca usar: endpoint, payload, campo (usar "opção"/"configuração"), booleano,
  componente, arquivo, API, schema, switch/toggle (usar "opção que você liga") —
  descrever o elemento como o usuário o vê ("um botão", "uma opção", "um menu")
- Tom de central de ajuda, direto, sem rodeio técnico
- Estrutura por arquivo: visão geral (pra que serve essa tela/módulo) → conceitos e
  opções explicados um a um → cenários comuns ("quando usar X em vez de Y") →
  limitações conhecidas (só se houver)
- Sem screenshots — só texto
- Preferir várias seções curtas a um bloco único longo; um módulo com muita coisa pode
  ter subseções, mas continua sendo **um arquivo por módulo**

## Modelo de saída

````markdown
# {Nome do módulo em linguagem de usuário}

{1-2 frases: pra que serve esse módulo/tela}

## {Conceito ou opção 1}

{explicação simples: o que é, quando usar, o que muda}

## {Conceito ou opção 2}
...

## Perguntas frequentes
- **Quando devo usar X em vez de Y?** — resposta direta
````

## Passo 4 — Atualizar o índice

`docs/users/README.md` mantém uma linha por módulo: nome, arquivo, status, data da
última atualização. Ao final da execução:
- Marca o módulo trabalhado como `✅ Documentado`, com a data de hoje
- Se o código de um módulo já documentado mudou desde a última atualização (checar
  `git log` nos caminhos relevantes contra a data salva), marca `🚧 Desatualizado` em
  vez de deixar um `✅` obsoleto sem aviso — mas só reescreve o conteúdo se pedido
  explicitamente; o padrão deste comando é avançar a fila, não reescrever em silêncio

## Passo 5 — Reportar

Informar: qual módulo foi escrito/atualizado, o caminho do arquivo, e quantos módulos
ainda estão `⏳ Pendente` (listar rapidamente) para orientar a próxima execução.

## Regras

- Nunca escrever conteúdo técnico aqui — para docs voltadas a devs, usar
  `/update-docs`, `docs/api/`, `docs/planning/`.
- Nunca inventar uma regra de negócio que não é realmente aplicada no código — na
  dúvida, checar o código antes de afirmar algo como fato.
- Sempre um módulo de conteúdo novo por execução, a menos que peçam explicitamente
  para processar em lote.
- Português, linguagem simples, zero jargão técnico — essa é a única pasta em `docs/`
  cujo público não é um desenvolvedor.
