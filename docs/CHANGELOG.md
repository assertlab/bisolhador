# 📋 Changelog - Bisolhador Dashboard

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [3.19.2] - 2026-10-27

### 🐛 Fixed

- **Tela em branco quando o chunk de uma página não carrega.** Uma aba aberta antes de um deploy pede um arquivo cujo hash não existe mais (ou a rede cai) e a rota ficava em branco, sem mensagem. Agora há um `RouteErrorBoundary` em volta das rotas: se o erro for de chunk, a página recarrega uma vez sozinha (busca o `index.html` novo com os hashes novos); uma segunda falha na janela de 60 s (rede fora do ar, arquivo realmente ausente) mostra o erro com o cabeçalho e um botão "Recarregar a página", sem laço de recarregamento. Qualquer outro erro de renderização também mostra essa tela em vez de branco. O erro é limpo ao sair da rota (sem remontar as páginas). Não há recarga automática sem armazenamento de sessão (nada protegeria do laço, e o getter bloqueado não derruba a tela) nem offline (o navegador trocaria o app pela página de "sem internet"). A tela de erro tem seu próprio modal de configurações (útil para corrigir o token) e a falha é registrada no GA só como tipo (`Route chunk`/`Route render`), sem caminho nem mensagem. `React.lazy` mantém o import rejeitado: voltar à mesma página quebrada falha até recarregar, o que o botão faz.
- Decisão: não há listener global de `vite:preloadError`. Um reload automático para qualquer import falho descartaria uma turma analisada em `/turma` (só existe em memória) quando falhasse o chunk do relatório PDF; esse caso continua mostrando o aviso no botão. Conferido num build de produção: falha única recupera sozinha, falha permanente recarrega uma vez e para no erro.

---

## [3.19.1] - 2026-10-27

### 🐛 Fixed

- **Selo "Uso responsável de IA": "3 de 3" não parece mais nota máxima.** Critérios não verificados saem do denominador, então "3 de 3" podia ser 3 dos 5 critérios, com 2 sem avaliação (testes e CI, por exemplo). A tabela do Modo Turma, o CSV, o card do Dashboard/Turma e o PDF agora dizem "3 de 3 (2 não avaliados)". Visto numa turma real em que os três projetos mostravam "3 de 3". Guia atualizado.

---

## [3.19.0] - 2026-10-27

### 🐛 Fixed

- **Modo Turma: o CI de projetos que só rodam em pull request agora é medido.** A coluna "CI ok" só olhava execuções do Actions disparadas por `push` no branch principal, então um repositório cujos workflows rodam apenas em `pull_request` (checks do PR, sem workflow em push) aparecia como "n/d" mesmo com uma bateria de testes. Caso real: um projeto da turma, com 157 execuções do Actions no período e nenhuma de push. Agora entram as execuções que exercitam o branch principal: push nele, execuções de pull request de branches do próprio repositório (sem PRs de fork nem do Dependabot/Renovate; outros bots, como um agente de código, contam) e a fila de merge. O destino do PR só é verificado quando o GitHub o informa: o campo `pull_requests` vem vazio em quase todas as execuções concluídas (1 de 20 num repositório real), então PRs para outros branches do mesmo repositório também entram. Agendadas e `dynamic` continuam fora.
- A busca passa a ler até 3 páginas de 100 execuções concluídas do período (qualquer gatilho) e filtra no cliente, porque o filtro `branch` da API é o branch de origem e perde as execuções de PR. Se o período tem mais execuções do que as lidas, a coluna vem marcada com `*` (amostra das mais recentes). O Dashboard não muda (continua contando só push).
- Se uma página posterior da busca falha, ficam as já lidas, marcadas como amostra (`*`); a primeira falhar continua sendo erro. Uma amostra truncada sem nenhuma execução aproveitável deixa o critério "testes e CI" do selo em "não verificado", nunca "sem CI". A nota da tabela e o guia de CI foram atualizados.
- Execuções de PR incluem as tentativas que falharam antes do merge, e um commit com workflow em push e em PR conta duas vezes; por isso a porcentagem não é comparável entre repositórios com gatilhos diferentes. O guia e o relatório PDF explicam isso e que CI em outra ferramenta (Vercel, CircleCI) não aparece.

---

## [3.18.2] - 2026-10-27

### 📝 Documentation

- **Relatório PDF da turma: nota sobre commits feitos à mão.** A seção de IA explica que commits feitos manualmente a partir de código escrito por um agente não levam o trailer de coautoria e não entram na contagem (o percentual mostra o declarado, não o uso), e que a ferramenta aparece pela configuração versionada. Surgiu de uma turma real em que os projetos foram feitos com Claude Code mas só 14% a 85% dos commits declaravam.

---

## [3.18.1] - 2026-10-27

### 🎨 Changed

- **Relatório PDF da turma: o cabeçalho usa o logo do Bisolhador** (o mesmo do site) no lugar da lupa desenhada. O logo é um JPEG (`src/report/logo.jpg`) achatado sobre o azul-marinho da faixa: o react-pdf decodifica PNG num worker `blob:`, que a CSP bloqueia (`worker-src` cai em `script-src`), e o relatório travava sem erro visível. JPEG não usa worker, então a CSP não precisou de nenhuma exceção nova. Verificado num build de produção sob a CSP real.

---

## [3.18.0] - 2026-10-27

### ✨ Added

- **Modo Turma: relatório em PDF.** Botão "Relatório PDF" ao lado do CSV. O arquivo é montado no navegador com `@react-pdf/renderer` (PDF vetorial, texto selecionável, IBM Plex Sans embutida), sem o `html2pdf.js`, e segue a identidade do relatório do Compasso: faixa azul-marinho com a marca e o período, rodapé com a data e `n / total`, retrato para texto e gráficos, paisagem para a tabela. Conteúdo: resumo da turma; uma seção por indicador (gráfico comparativo com a mediana da turma marcada em cada barra, "O que é", "Como ler", "Leitura desta turma" e limites); IA no Processo; tabela completa; metodologia e limites. A "Leitura desta turma" é montada por regras (faixa de valores, mediana, destaque acima de 2× a mediana, projetos individuais, limite inferior de IA, amostras parciais, n/d), sem nota nem ranking.
- **Anonimizar repositórios no PDF** (opção, desligada por padrão): "Repositório A, B, C…".
- O relatório usa textos próprios do período da turma para commits, autores, concentração, PRs, lead time, revisão, tamanho de PR, CI, Conventional Commits e releases (os do guia falam de 52 semanas, 12 meses e "últimos 50", que não valem no Modo Turma). As barras seguem a ordem informada (sem ranking); percentuais usam escala de 0 a 100%.

### 🔒 Security

- **CSP: `'wasm-unsafe-eval'` em `script-src` e `data:` em `connect-src`.** O layout do react-pdf carrega o yoga em WebAssembly, buscado como data URI embutida no bundle; sem isso o relatório falha em produção ("WebAssembly.instantiate() violates … script-src"), como confirmado num build com a CSP real. A diretiva só permite compilar WebAssembly (não libera `eval()` nem `new Function()`), e `data:` não sai da página. Os dois valores estão justificados no comentário do `index.html`.
- O relatório só recebe dados por repositório (a mesma fonte do CSV, `buildReportModel`): nada por estudante entra, e um teste garante.

### ⚡ Performance

- `@react-pdf/renderer` (~1,2 MB, ~445 KB gzip), o documento e os textos do relatório (`report.*`, pacote carregado por `lazyLocales`) só são baixados ao clicar. O carregamento inicial não muda.

---

## [3.17.2] - 2026-10-26

### ⚡ Performance

- **Textos dos guias fora do bundle inicial.** Os textos de Como interpretar (`guide.*`) e do Guia de IA no Processo (`aiGuide.*`) eram cerca de metade de `pt.json`/`en.json`, e os dois idiomas iam no chunk de entrada de todo primeiro acesso. Agora ficam em `src/locales/guide.{pt,en}.json` e `src/locales/aiGuide.{pt,en}.json`, carregados por import dinâmico só por `/guia` e `/guia/ia`, e só no idioma ativo (`src/lib/lazyLocales.js`). Chunk de entrada: ~443 KB → ~355 KB (~141 → ~115 KB gzip); JS do primeiro acesso (entrada + modulepreloads): ~731 KB → ~644 KB. Sem `manualChunks`.
- As páginas mostram o mesmo indicador de carregamento da troca de rota até os textos chegarem (nunca chaves cruas) e, se o chunk falhar, uma mensagem pedindo para recarregar. A rolagem para `#âncora` espera os textos. Ao trocar de idioma em `/guia` ou `/guia/ia`, os textos do outro idioma são baixados antes da troca, sem piscar.
- Os rótulos de link usados fora dos guias (Como interpretar, Guia de IA no Processo, Como ler esta visão) passaram para `guideLinks.*` no locale principal. Um teste impede que `guide`/`aiGuide` voltem para `pt.json`/`en.json`, e a paridade de chaves pt/en dos dois namespaces continua testada.

---

## [3.17.1] - 2026-10-26

### 🐛 Fixed

- **Modo Turma: todos os links dos resultados abrem em nova aba.** A análise da turma fica só na memória, então seguir um link na mesma aba descartava até 50 repositórios analisados, e voltar refazia tudo no GitHub. Agora abrem em nova aba, com `rel="noopener noreferrer"`, os "Como interpretar" do cabeçalho das colunas e do topo da página, todos os links da linha expandida (card IA no Processo, desacordo entre fontes, selo, visão Por estudante) e os links dos repositórios. O `noreferrer` também tira `/turma?repos=…` do Referer enviado às páginas onde o GA está ligado. Leitores de tela ouvem "(abre em nova aba)". No Dashboard, os links continuam na mesma aba.
- **Modo Turma no celular: a linha expandida não é mais cortada à direita.** A célula de detalhe ocupa a largura da tabela inteira, que rola na horizontal; o painel agora fica preso à parte visível e limitado à largura da caixa de rolagem (container query). A tabela Por estudante rola dentro da própria caixa quando não cabe.
- **Modo Turma: sem rolagem horizontal da página inteira**, no celular e no desktop. Os textos só para leitores de tela (`sr-only`, posicionados em absoluto) dentro da tabela larga alargavam a página; a caixa de rolagem da tabela passa a contê-los.


## [3.17.0] - 2026-10-26

### ✨ Added

- **NEW**: Página **Guia de IA no Processo** (`/guia/ia`, pt e en), com links no topo da seção "IA no Processo" de Como interpretar, no card IA no Processo (Dashboard e Modo Turma) e no aviso da visão Por estudante. No Modo Turma, esses links abrem em outra aba, para não perder a análise da turma, que fica só na memória. Blocos:
  - **Visão geral e princípios**: as quatro perguntas da seção, o limite inferior (sem rastro não é sem IA), o que ela não é (detector de cola, prova, nota) e a ética dos dados.
  - **Como tornar o uso de IA visível**: o trailer `Co-authored-by` manual e, por ferramenta, como a coautoria é declarada e qual e-mail o Bisolhador reconhece. Só há instruções para as ferramentas conferidas na documentação oficial ou no código-fonte em 2026-10-26 (Claude Code, agente de código do Copilot, Cursor, Aider), com o link da fonte; as outras mostram só o e-mail. O trailer "Made with Cursor" não é de coautoria e não é contado, e a página diz isso.
  - **O que o Bisolhador detecta**: tabela gerada em tempo de execução a partir do registro (`AI_TOOLS`), com caminhos de configuração, e-mails de coautoria, logins de agentes e de revisores, os padrões do `.gitignore` e a versão do registro.
  - **Para professores (Modo Turma)**, **Perguntas frequentes** (10) e **Limites** consolidados, cada um com link para a entrada de Como interpretar.

### 🔧 Changed

- O registro de ferramentas ganha campos só de exibição (`show` nos caminhos, `examples` nos e-mails), testados contra os próprios padrões. Os limites do Modo Turma (300 commits, 200 PRs examinados, 50 commits por arquivo na autoria) viram constantes em `constants.js`, sem mudar os valores.


## [3.16.0] - 2026-10-26

### ✨ Added

- **NEW**: No Modo Turma, o critério **"Testes e CI"** do selo "Uso responsável de IA" passa a ser medido (antes ficava sempre "não verificado"), sem nenhuma requisição nova: a consulta de contexto de IA que já existia ganha a listagem de `.github/workflows`.
  - **CI**: configuração de CI na raiz ou em `.github/workflows` (os mesmos padrões da Maturidade de engenharia, mas só nesses dois lugares: um `Jenkinsfile` em subpasta não é visto), ou qualquer execução do GitHub Actions (push no branch padrão) no período, que o Modo Turma já buscava. "Não detectado" só quando as listagens foram lidas e as execuções foram buscadas e nenhuma mostra CI; se uma delas falhou e a outra não mostra CI, fica "não verificado".
  - **Testes**: só "encontrados" (pasta `test/`, `tests/` ou `__tests__/` na raiz) ou "não verificados". Arquivos `*.test.js` junto do código não aparecem sem a árvore, então a falta de pasta de testes nunca torna o critério não cumprido: ele só fica "não cumprido" por falta de CI.
  - As listagens são lidas no estado atual do repositório (HEAD), não no fim do período; só as execuções se limitam ao período.
  - A coluna **CI ok** (saúde do CI pelas execuções) não muda.
- **NEW**: O **CSV do Modo Turma** traz, logo depois de cada coluna de porcentagem, o **n** sobre o qual ela foi calculada: commits analisados (concentração, Conventional Commits, commits com IA), PRs analisados (aprovação por outra pessoa, PRs de agentes) e execuções de CI. Com a busca bem-sucedida, o n é o tamanho da amostra, 0 quando ela está vazia; vazio só quando a parte falhou ou não foi medida. Nada por estudante entra no CSV. As colunas antigas mudaram de posição: leia o CSV pelo cabeçalho, não pela posição da coluna.

---

## [3.15.0] - 2026-10-26

### ✨ Added

- **NEW**: Seção **IA no Processo** no Dashboard: os rastros de uso de IA que o GitHub guarda. Tudo é **limite inferior**: sem rastro aparece "Nenhum rastro de IA encontrado", com a explicação de que o autocomplete não deixa marca; nunca "0% IA" nem "não usa IA". Toda fração mostra o n.
  - **Ferramentas detectadas** e **profundidade da configuração**: arquivos de configuração de agentes versionados (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules`, …) e, com token, a origem no template, os caminhos de IA ignorados no `.gitignore` e a coautoria desligada em `.claude/settings.json`.
  - **Commits com IA**: % dos commits recentes (sem merges e sem bots de manutenção) com trailer `Co-authored-by` de uma ferramenta de IA, casado pelo **e-mail**, ou com um agente como autor.
  - **PRs de agentes** e, com token, **revisão por IA** e **salvaguardas**: PRs de agentes mergeados sem aprovação de outra pessoa e o tamanho dos PRs de agentes vs. pessoas (só com pelo menos 5 PRs de cada lado).
  - **Fontes em desacordo**: aviso neutro, no nível do repositório, quando a configuração versionada fora do template ou o `.gitignore` mostram IA e nenhum commit nem PR de agente declara uso, sempre com as causas legítimas (squash, commit de outra pessoa da equipe, ferramenta sem trailer, coautoria desligada).
  - **Selo "Uso responsável de IA"**: cinco critérios observáveis (configuração versionada, uso declarado, coerência entre fontes, PRs de agentes aprovados por outra pessoa antes do merge, testes e CI). "Não se aplica" e "não verificado" saem do denominador; sem rastro de IA, o selo não se aplica. Só por repositório e fora do Ranking.
  - Os snapshots guardam a seção (`aiProcess`, método `ai-traces-v1`, registro `2026-10-25`); os antigos mostram "não registrado neste snapshot". Uma falha na parte de IA nunca impede salvar o snapshot.
  - Custo: sem token, nenhuma requisição nova; com token, +1 consulta GraphQL por análise (além das já existentes).
  - Os indicadores de revisão (lead time, cobertura, 1ª revisão, tamanho de PR, divergência) continuam medindo **só PRs de pessoas**, sem mudança de método; PRs de agentes aparecem só nesta seção.
- **NEW**: **IA no Modo Turma**: colunas por repositório (ferramentas, % de commits com IA, % de PRs de agentes, fontes em desacordo e selo, também no CSV). Ao expandir a linha: a seção do repositório no período e uma **visão por estudante** (commits, commits com IA, ferramentas e arquivos de configuração de IA alterados no período), com uma linha por agente e uma linha "não identificado" para commits sem conta. Custa +1 consulta GraphQL por repositório (além das já existentes) e +1 de autoria quando há configuração de IA fora do template.
- **NEW**: Entradas de IA no guia **Como interpretar**: ferramentas, profundidade da configuração, commits, PRs, revisão por IA, salvaguardas, fontes em desacordo e selo, cada uma com seus limites (nenhuma tem métrica CHAOSS correspondente).

### 🔒 Security

- **SEC**: Nada de IA por pessoa no Dashboard nem no snapshot: `aiProcess` só guarda contagens e ids de ferramentas. A visão por estudante do Modo Turma, a única que nomeia autores, fica só na memória do navegador: fora do CSV, do Supabase e do Google Analytics (já desligado no Modo Turma). Não há alerta individual: o desacordo entre fontes só aparece por repositório.
- **SEC**: O Dashboard não lê a configuração de um template privado (a origem fica "não verificada"); só o Modo Turma, que já analisa privados sem salvar nada, lê.

### 🐛 Fixed

- **FIX**: Quando a busca dos commits falhava (erro da API do GitHub ou limite de requisições), **Últimos Commits** aparecia vazio, como se o repositório não tivesse commits. Agora diz que não foi possível carregar (o aviso de dados parciais já listava `commits`). Repositório vazio continua aparecendo como sem commits. O snapshot continua sendo salvo (nenhum histórico compara commits), com a lista e a adesão a Conventional Commits como não registradas. Snapshots antigos podem ter gravado uma falha como lista vazia; neles, a lista vazia aparece como "Nenhum commit registrado neste snapshot".

---

## [3.14.0] - 2026-10-24

### ✨ Added

- **NEW**: **Modo Turma aceita repositórios privados**, a única exceção à regra de nunca processar privados. Turmas do GitHub Classroom são privadas por padrão. A análise roda no navegador de quem usa, com o token dessa pessoa (só vê o que ela já pode ver no GitHub), **nada é salvo**, e o Google Analytics fica **desligado** a partir da abertura do Modo Turma, até a página ser fechada. Repositórios privados aparecem com 🔒, com aviso na tela e uma coluna de visibilidade no CSV. Dashboard, Benchmark, Timeline e Ranking continuam recusando privados.
- **NEW**: **Importar a turma de uma organização** do GitHub (ou de um usuário): informe a organização e, opcionalmente, um prefixo (ex.: `projeto-1-`); a lista é preenchida com os repositórios correspondentes, sem os arquivados.

### 🔒 Security

- **SEC**: O Google Analytics recebia a **URL completa**, com os parâmetros (`?q=dono/repo` no Dashboard, `?repos=…` no Modo Turma).
  - **Nossos próprios envios:** agora mandam só o caminho da página (página vista registrada por rota, com `page_location` sem parâmetros).
  - **Medição aprimorada do GA4:** lê a URL e os links reais, independentemente da configuração do código: página vista a cada mudança de URL, cliques em links externos, interações com formulários e busca no site. Por isso o GA fica **desligado no Modo Turma**, onde pode haver nomes de repositórios privados. Fora dele, esses quatro recursos precisam ser desligados no painel do GA4; sem isso, o termo de `?q=` do Dashboard ainda chega ao Google.

### 🐛 Fixed

- **FIX**: **Cabeçalho no celular**: a barra com todos os links e botões tinha ~930 px e fazia a página inteira rolar para o lado em telas de celular (e ainda passava 33 px em 1024 px). Abaixo de 1280 px, a barra mostra logo, tema, configurações e um botão de menu; os links (com rótulo), o idioma e a ajuda ficam no painel do menu. A página atual fica destacada (sublinhado e `aria-current`). O menu fecha com Esc, ao navegar, ao abrir as configurações e ao alargar a janela. Os links, antes cinza-escuro sobre a barra escura no tema claro, ficaram legíveis nos dois temas.

---

## [3.13.0] - 2026-10-24

### ✨ Added

- **NEW**: **Modo Turma** (`/turma`): compara os repositórios das equipes de uma turma no período da disciplina.
  - Cole até 50 repositórios (`dono/repo` ou URL do GitHub) e escolha início e fim.
  - Cada repositório é analisado na hora, com os indicadores de processo do Dashboard calculados no período: commits, autores ativos, concentração no autor principal (sem identificá-lo), PRs mergeados, aprovação por outra pessoa, tempo até a 1ª revisão, lead time, tamanho dos PRs, saúde do CI, Conventional Commits e releases.
  - Exige token; analisa 3 repositórios por vez, com progresso, e exporta CSV.
  - **Só repositórios públicos**: a checagem de visibilidade bloqueia em caso de falha, como no Benchmark. **Nada é salvo** no Supabase, e a turma fica no link (`?repos=&from=&to=`).
  - Cada coluna leva à sua entrada no guia "Como interpretar", que ganhou uma entrada sobre o modo turma, com os limites e o cuidado com ética de dados.

- **NEW**: Página **Como interpretar** (`/guia`), com uma entrada por indicador: o que mede, como ler, limitações e a métrica correspondente da **CHAOSS**, o projeto da Linux Foundation de métricas de saúde de comunidades open source, com link para a definição oficial. Cada referência foi conferida na definição da CHAOSS. Quando o Bisolhador mede de outro jeito, a diferença está escrita: por exemplo, o bus factor usa 70% e o *Contributor Absence Factor* usa 50%, e o tempo até a 1ª revisão conta a partir de "pronto para revisão". Indicadores sem métrica CHAOSS (saúde do CI, Conventional Commits, divergência) dizem isso. Cada card do Dashboard tem um link "Como interpretar" para a sua entrada, e o guia lembra as orientações de ética de dados da CHAOSS.

### 🐛 Fixed

- **FIX**: O tooltip da **Saúde do CI** (v3.12.0) dizia que execuções de bots ficam de fora. Só ficam de fora as execuções que não são de push; pushes feitos por bots no branch principal entram na conta.

---

## [3.12.0] - 2026-10-24

### ✨ Added

- **NEW**: Três indicadores na seção **Dinâmica de Revisão**. Exigem token do GitHub e usam os mesmos até 50 PRs mergeados mais recentes, sem bots:
  - **Cobertura de Revisão**: % aprovados por outra pessoa antes do merge, mais o % com qualquer revisão de outra pessoa;
  - **Tempo até a 1ª Revisão**: mediana e p90, contados a partir do momento em que o PR fica **pronto para revisão** (rascunhos não contam como espera) até a primeira revisão de outra pessoa;
  - **Tamanho dos PRs**: mediana de linhas alteradas e % de PRs com menos de 400 linhas.

  Os dados vêm de três consultas GraphQL em paralelo: uma consulta única levava de 5 a 10 s e beirava o limite do GitHub. Se a parte de tempos ou a de tamanho falhar, só aquele indicador fica indisponível. Snapshots anteriores mostram "não registrado".

- **NEW**: Seção **Práticas do Projeto**, com três indicadores de dados públicos (funcionam sem token):
  - **Saúde do CI**: % de sucesso e duração mediana das últimas execuções do GitHub Actions disparadas por push no branch principal (até 50). Execuções agendadas, de bots, do Dependabot e de pull requests ficam de fora, assim como canceladas e puladas.
  - **Conventional Commits**: % dos commits recentes do branch principal (até 100, sem merges e sem bots) no formato `tipo(escopo)!: descrição`.
  - **Cadência de Releases**: releases nos últimos 12 meses, intervalo mediano entre os dias com release, dias desde a última e % de tags em SemVer. Cada release é datada pela tag, ou pela publicação quando a tag é posterior (como numa tag recriada); releases de duas linhas no mesmo dia contam como um dia. A mesma lista fornece a contagem de releases do card do repositório, sem requisição extra quando há menos de 100.

  Snapshots anteriores mostram "não registrado".

---

## [3.11.0] - 2026-10-24

### 🐛 Fixed

- **FIX**: **Gráficos e indicadores do Dashboard** afirmavam mais do que os dados sustentavam:
  - **Commits por dia da semana** usava só os 10 commits mais recentes (no renovate, "100% sexta"). Agora usa a estatística *punch card* do GitHub: todo o histórico (até o limite de 20 mil commits que o GitHub calcula, avisado quando atingido), sem merges, no horário de quem fez cada commit. Amostras pequenas aparecem com aviso.
  - **Commits por semana**: o título mostrava a idade do repositório ("904 semanas" no express) em vez das semanas exibidas. Quando o GitHub ainda está calculando (HTTP 202), aparece "calculando", e não uma linha zerada que também era gravada no histórico.
  - **Code Churn** vira **Adições/Remoções**: o tooltip deixa de prometer "qualidade das mudanças", os rótulos ficam descritivos ("mais adições que remoções" em vez de "Refatoração Agressiva"), a razão exige pelo menos 4 semanas com atividade, e "calculando", "repositório grande demais" (mais de 10 mil commits) e falha aparecem com mensagens diferentes.
  - **Taxa de resolução** vira **"% fechadas"**, traduzida (antes "% resolvidas" aparecia em português também na interface em inglês), e o tooltip avisa que inclui issues fechadas como "não planejadas" ou duplicadas.
  - Esses gráficos e cards explicam a própria indisponibilidade, então não acionam mais o aviso de "dados parciais". Em snapshots, "calculando" vira "não registrado neste snapshot", em vez de pedir para tentar de novo. Snapshots antigos com a série de atividade zerada (um 202 gravado como zeros) ou com a razão calculada pelo método anterior também aparecem como "não registrado", inclusive no Benchmark.
  - O lead time em inglês voltou a mostrar a unidade ("7.7 hours"), e em português usa vírgula ("7,7 horas").

---

## [3.10.0] - 2026-10-23

### 🐛 Fixed

- **FIX**: **Benchmark** comparava dados incomparáveis sem avisar:
  - lia o último registro mesmo sem relatório, o que zerava tudo;
  - transformava todo valor ausente em 0 (health de fork "0%", quedas falsas para "0 ⭐" na linha de evolução);
  - misturava métodos antigos e novos (lead time médio, self-merge, bus factor com bots e só 30 contribuidores);
  - e não mostrava de quando era cada dado.

  Agora:
  - usa o registro mais recente **com relatório**;
  - "não medido" aparece como N/A;
  - valores medidos com métodos antigos aparecem como "não registrado", como no Dashboard;
  - cada repositório mostra a data dos seus dados, e um aviso aparece quando os comparados têm mais de 7 dias de distância;
  - a linha de evolução tem um ponto por dia;
  - o filtro de período fica junto do único gráfico que ele afeta;
  - repositórios renomeados juntam o histórico salvo sob o nome antigo (facebook/react → react/react);
  - as cores dos gráficos deixam de usar uma string CSS inválida (`hsl(...)80`);
  - lead time em texto na melhor unidade (horas abaixo de um dia, não "0 dias") e decimais com vírgula.

  Na prática, até os repositórios serem analisados de novo, lead time, divergência, churn e bus factor aparecem como N/A no Benchmark: todos os registros salvos até hoje são anteriores aos métodos atuais. A aba Qualidade e o risco de bus factor dizem isso em vez de mostrar um gráfico vazio.

- **FIX**: **Timeline (Máquina do Tempo)** distorcia a evolução:
  - eixo de categorias: 16 buscas de uma tarde ocupavam o espaço de meses;
  - registros sem relatório viravam 0, gerando um "+100 ⭐" de crescimento falso;
  - o crescimento tinha um "+" fixo ("+-5" em quedas);
  - repositórios renomeados perdiam o histórico anterior ao novo nome.

  Agora:
  - eixo de tempo real, com datas no idioma da interface;
  - um ponto por dia;
  - registros sem relatório são ignorados e valores não medidos viram lacunas na linha;
  - o crescimento tem o sinal certo (vermelho em queda);
  - o histórico sob o nome antigo é incluído (facebook/react + react/react): o Dashboard passa à Timeline o nome digitado na busca, e uma Timeline aberta pelo nome antigo descobre o atual no GitHub;
  - uma falha do banco de dados aparece como "não foi possível carregar", não como "nenhum histórico".

  No Benchmark, a dica da linha de evolução mostra o ponto mais próximo de cada repositório, não o N-ésimo registro de cada um (que tinham datas diferentes).
- **FIX**: Ao abrir um **snapshot antigo** no Dashboard, os contribuidores e o bus factor anteriores à v3.8.0 (só os 30 primeiros, todo o histórico, com bots) aparecem como "não registrado neste snapshot", como no Benchmark.

- **FIX**: **Ranking (Bisolhômetro)** contava cada recarregamento como uma análise e se apresentava como "Hall of Fame" com medalhas. O assertlab/bisolhador tinha 140 "análises" em 57 dias (até 16 no mesmo dia), e o claw-code, 61 em 19 dias. Com a contagem por dias, o bisolhador continua em primeiro (57 dias), mas a ordem dos demais muda.

  Agora:
  - ordena por **dias distintos com análise**, no horário de Recife (`get_leaderboard`, SQL versionado em `supabase-migrations/`);
  - agrupa grafias que só diferem por maiúsculas;
  - o título passa a ser "Mais Analisados", com o aviso de que mede o interesse de quem usa a ferramenta, não a qualidade do projeto;
  - as medalhas saem;
  - a faixa de saúde segue a do Dashboard (≥ 75% / ≥ 50%; era > 80%), e health não medido (forks, registros antigos sem relatório) aparece como N/A, não como "C" vermelho.

---

## [3.9.1] - 2026-10-23

### 🐛 Fixed

- **FIX**: Com o navegador em português do Brasil, **datas e números apareciam no formato americano** sob texto em português ("registrado em 12/18/2025, 06:09 PM", "241,721 estrelas"): o navegador informa `pt-BR`, e o app comparava o idioma com exatamente `pt`. O idioma detectado agora é normalizado para `pt`/`en` (inclusive o valor antigo já salvo no navegador), um único helper (`intlLocale`) escolhe o formato, e os números do Ranking, do Benchmark e dos gráficos passam a seguir o idioma escolhido, não o do navegador. A data de criação do repositório ("Desde …") também segue o idioma (era sempre dd/mm/aaaa). Em snapshots antigos sem relatório completo, a idade e o "Desde …" eram calculados a partir do último push (o snapshot de 18/12/2025 do react dizia "Desde 18/12/2025"); agora aparecem como N/A. Um navegador com idioma sem tradução usa a próxima preferência suportada (espanhol, depois inglês → inglês) ou, sem nenhuma, o português. O atributo `lang` da página, fixo em "en", passa a acompanhar o idioma (leitores de tela e tradução automática).

---

## [3.9.0] - 2026-10-23

### 🐛 Fixed

- **FIX**: **Maturidade de Engenharia** deixava de detectar configurações comuns e confundia "não verifiquei" com "não tem": o express aparecia **sem testes** (usa `test/`), projetos com GitLab CI **sem CI**, o immich **sem Docker** (Dockerfiles em subpastas), e o linter nem era exibido, embora o tooltip o prometesse. Os padrões foram ampliados (testes em qualquer pasta `test/`/`tests/`/`__tests__/` e `.tsx`/`_test.py`/`_spec.rb`; CI de GitLab, CircleCI, Jenkins, Azure, Travis e outros; Docker em subpastas e `compose.yaml`; linters modernos como `eslint.config.js`, Biome, golangci, Ruff, inclusive em `packages/*`/`apps/*` de monorepos), e cada badge mostra **✓ encontrado · ✗ não encontrado · ? não verificado** (lista de arquivos truncada, como no linux, ou indisponível), com um tooltip explicando o que é procurado. Repositórios vazios aparecem como "não encontrado", não como falha da API. Snapshots antigos, verificados com os critérios limitados, mostram "?" em vez de ✗.
- **FIX**: **Health Score** não reconhecia o diretório `.github/ISSUE_TEMPLATE/` (formulários de issue, o formato atual): react, bootstrap, flask e outros perdiam um ponto (react: 86% → **100%**, igual ao do próprio GitHub). **Forks** (sem perfil de comunidade no GitHub) passam a ter o Health Score calculado a partir dos arquivos do repositório, com aviso. Quando a lista de arquivos falha, o Issue Template aparece como ❔ e a busca não é salva no histórico (gravaria 86% para um repositório de 100%); em repositórios grandes demais para a lista completa, uma checagem dirigida dos diretórios `ISSUE_TEMPLATE/` resolve o ponto.
- **FIX**: **Total de Branches e Branches Zumbis** olhavam só as 20 primeiras branches em ordem alfabética: o react aparecia com "20 branches" (tem 1.011) e 20 zumbis — todas branches de release intencionais (`0.3-stable`…). Agora o total é exato (com ou sem token), e com token os zumbis vêm de **todas** as branches (até 1.000) via uma consulta GraphQL, **sem contar a principal, as protegidas e as de release/manutenção** (`1.x`, `0.3-stable`, `release/…`). O critério aparece no tooltip do badge. Sem token, zumbis ficam N/A (calcular exigiria uma requisição por branch). Antes eram até 20 requisições sequenciais por busca.
- **FIX**: **Lead time, Code Review e Divergência** eram medidos nos 20 PRs mais recentes *criados* — em repositórios ativos quase todos ainda abertos: o express e o react apareciam com lead time **N/A** e Code Review **"0%"**, e o lead time era uma **média** (no react, ~19× a mediana). Agora os três usam os até **50 PRs mergeados mais recentes (por data de merge), sem bots**: lead time é a **mediana** com p90 e o tamanho da amostra (react: 1,4 dia, p90 5,3 dias; express: 11 dias); o badge de Code Review passa a medir **"mergeado sem aprovação de outra pessoa"** (revisões *Approve* feitas antes do merge), não "mergeado pelo próprio autor" — no react, 54% dos PRs são self-merges, mas 0% sem aprovação; a taxa de self-merge fica no tooltip. A Divergência deixa de contar comentários de bots (CLA, CI) e os rótulos perdem o juízo de valor ("Saudável", "Silencioso" → "Discussão moderada", "Pouca discussão"). Sem PRs mergeados, os indicadores aparecem como "nenhum PR mergeado" em vez de 0. Snapshots antigos, medidos do jeito anterior, mostram "não registrado neste snapshot". No Benchmark, o lead time passa a ser sempre a mediana em **dias** (antes, valores em horas eram plotados como dias); snapshots antigos aparecem como N/A.
- **FIX**: **Permalink por data** (`?repo=dono/projeto&date=AAAA-MM-DD`) não funcionava: a função `buscar_snapshot_por_data` do Supabase devolvia vazio para qualquer data, inclusive dias com 16 registros, e o app mostrava "snapshot indisponível". O SQL da função, que nunca esteve no repositório, agora está versionado (`supabase-migrations/buscar_snapshot_por_data.sql`). A função devolve o **registro mais recente até o fim do dia**, num fuso fixo (Recife), em vez do fuso do navegador: o mesmo link mostra o mesmo registro para qualquer pessoa. O aviso de modo histórico informa quando o registro foi feito, e o smoke test passou a abrir esse permalink.

---

## [3.8.0] - 2026-10-23

### 🐛 Fixed

- **FIX**: **Contribuidores e Bus Factor** usavam só os 30 primeiros contribuidores, contavam bots como pessoas e olhavam todo o histórico. No express, o "risco crítico" apontava um mantenedor inativo desde 2014; no renovate, "o usuário renovate[bot]". Agora: dados semanais de todos os principais contribuidores, **bots excluídos**, janela dos **últimos 12 meses** quando há atividade suficiente (senão todo o histórico, com aviso), e o card de Bus Factor e a tabela usam **as mesmas pessoas, janela e denominador**. Se o GitHub ainda está calculando as estatísticas, usa a lista de até 100 contribuidores, marcada como parcial; se tudo falhar, aparece "indisponível" e o resultado não é gravado.
- **FIX**: Terminologia: a tabela não se chama mais "Bus Factor" (é a concentração no principal contribuidor), e o estado saudável não aparece mais como "Bus Factor Baixo" (no uso padrão, *baixo* é o arriscado). Dashboard e Benchmark usam os mesmos limites (40% / 60%); o Benchmark usava 60% / 80%.
- **FIX**: O relatório completo (`full_report`) era gravado como texto JSON dentro do campo jsonb (codificado duas vezes). Agora é gravado como objeto; os snapshots antigos continuam legíveis.

### ⚡ Performance

- **PERF**: Primeiro carregamento cai de ~1,56 MB para ~592 KB de JavaScript: o gerador de PDF (`html2pdf.js`, ~916 KB) era pré-carregado em toda visita e agora só é baixado ao clicar em exportar (#59). Exportar várias vezes seguidas não gera mais PDFs duplicados.

### 🔧 Changed

- **DEV**: Vite 8 e `@vitejs/plugin-react` 6, atualizados juntos (um exige o outro). Build ~5× mais rápido. `dependabot.yml` ganha o grupo `vite` (#59).

---

## [3.7.1] - 2026-10-23

### 🐛 Fixed

- **FIX**: Falhas da API de busca do GitHub (rate limit, erro, repositório renomeado) apareciam como **0** issues abertas/fechadas, PRs e merges, sem aviso, e o 0 era gravado no histórico. Agora o indicador aparece como **N/A**, entra no aviso de dados parciais, e o snapshot **não é gravado** quando um indicador crítico falhou. Branches, releases e Health Score seguem o mesmo padrão (o badge verde "nenhuma branch zumbi" não aparece mais quando a lista de branches falhou).
- **FIX**: Repositórios **renomeados** (ex.: `facebook/react` → `react/react`) mostravam 0 issues: a API de busca não segue renomeações. Todas as chamadas agora usam o nome canônico, e o histórico deixa de se dividir entre os dois nomes.
- **FIX**: **Forks** mostravam Health Score ~14% (o GitHub não fornece perfil de comunidade para forks). Agora aparece "N/A" com a explicação.
- **FIX**: Snapshots antigos sem relatório completo mostravam 0 branches, 0 PRs, 0 releases, 0 issues fechadas e um checklist de Health Score todo ❌ (dados que nunca foram registrados). Agora mostram N/A.
- **FIX**: Compartilhar um resultado que não foi salvo (dados parciais) agora explica o motivo, em vez de um erro genérico.
- **FIX**: Benchmark usa o nome canônico do repositório (renomeados encontram o histórico atual).

---

## [3.7.0] - 2026-10-23

### ✨ Changed

- **URL nova: https://bisolhador.assertlab.com** (antes `assertlab.com/bisolhador/`). O endereço antigo redireciona (301, Cloudflare) preservando caminho e query, então permalinks já compartilhados (`?id=`, `?repo=&date=`, `?q=`) continuam funcionando. O app passa a ser servido na raiz (`base: '/'`).
- **⚠️ Token do GitHub e tema precisam ser configurados de novo** no domínio novo: o navegador guarda o `localStorage` por origem, e `assertlab.com` e `bisolhador.assertlab.com` são origens diferentes.

### 🐛 Fixed

- **FIX**: Abrir ou recarregar uma rota interna direto no navegador (`/ranking`, `/benchmark`, `/timeline/owner/repo`) dava 404 do GitHub Pages, que não tem rewrite para SPA. O build agora publica o `index.html` também como `404.html` (`scripts/spa-fallback.mjs`).

---

## [3.6.4] - 2026-10-22

### 🐛 Fixed

- **FIX**: Code Churn mostrava `Infinity` / "Acúmulo Intenso" para praticamente todo repositório ativo. A API `/stats/code_frequency` do GitHub devolve as deleções como número **negativo** (`[ts, 989, -1243]`), e o cálculo as somava sem valor absoluto. Snapshots já gravados no Supabase mantêm o valor antigo; buscas novas saem corretas.
- **FIX**: As métricas de **Code Review** (taxa de self-merge, card de Maturidade) e **Divergência** apareciam sempre como 0% / "baixa" para qualquer repositório: a lista `GET /pulls` do GitHub não traz quem fez o merge nem a contagem de comentários. Agora vêm de uma única consulta GraphQL quando há token; sem token, aparecem como "n/d" com a explicação, em vez de um zero falso. Snapshots gravados antes da correção (cujo 0% era sempre falso) também passam a mostrar "n/d" ("não registrado neste snapshot").
- **FIX**: O card de Divergência mostrava `%` (inclusive em "N/A%"), mas a métrica é a média de comentários por PR; o `%` vinha de um caso especial fixo no `StatCard` que só disparava em português. O tooltip, que descrevia outra métrica ("% de PRs com Request Changes"), foi corrigido.
- **FIX**: Badge de Code Review em cinza (sem PRs mergeados) aparecia vermelho; snapshots sem `full_report` mostravam a chave crua `divergenceNone` e "Code Review (%)".
- **FIX**: `calculateLeadTime` não quebra mais a análise inteira se a lista de PRs vier em formato inesperado (retorna `N/A`, como as métricas irmãs).
- **FIX**: `full_report` corrompido em snapshots volta a ser logado como erro (`console.error`) em todos os pontos de leitura, e JSON válido que não é um relatório (`false`, `0`) cai no fallback em vez de chegar ao Dashboard.

### 🧪 Tests

- **TEST**: Primeira suíte de testes unitários (Vitest), rodando no CI. Ela revelou o bug do Code Churn acima e dois outros ainda não corrigidos — Self-Merge e Divergência sempre zerados (ver `docs/ROADMAP.md`).

---

## [3.6.3] - 2026-10-22

### 🐛 Fixed

- **FIX**: Ao voltar (Back) de uma busca ao vivo para um permalink de snapshot (`?id=` / `?repo=&date=`), o Dashboard exibia os dados da busca ao vivo por baixo do banner de snapshot. A URL agora decide qual fonte é exibida.
- **FIX**: Snapshot inexistente, id inválido (ex: `?id=12abc`) ou falha ao carregar o histórico deixavam a página vazia sem explicação; agora aparece uma mensagem de erro (`errors.snapshotUnavailable`).
- **FIX**: Alertas de erro e de snapshot fechados pelo usuário continuavam escondidos ao navegar com Back/Forward para outra URL; agora reaparecem a cada mudança de URL.

### 🔧 Changed

- **REFACTOR**: Snapshots passam a ser carregados via TanStack Query (`src/hooks/useSnapshot.js`), chaveados pela URL, como já era a busca ao vivo; o estado do Dashboard derivado da URL deixou de ser copiado num `useEffect` (exigido pela regra `react-hooks/set-state-in-effect` do `eslint-plugin-react-hooks` 7.1).
- **DEV**: ESLint 10 (`eslint` 10.13, `@eslint/js` 10, `eslint-plugin-react-hooks` 7.1.1). A regra `no-useless-assignment`, nova no `recommended`, apontou 4 valores iniciais nunca lidos (removidos, sem mudança de comportamento). O `dependabot.yml` agora agrupa a família ESLint, majors inclusive, num único PR.
- **DEPS**: `@supabase/supabase-js` 2.118, `@tanstack/react-query` 5.104, `react`/`react-dom` 19.3, `react-router-dom` 7.18.4 e outros minor/patch (#29); `react-ga4` 3.0.1 (reescrito em TypeScript/ESM, mesma API; #31); `i18next` 26 + `react-i18next` 17, atualizados juntos porque o segundo exige o primeiro (#42).
- **DEV**: autoprefixer 10.6, postcss 8.5.31 (CSS gerado idêntico), playwright 1.64 (requer `npx playwright install chromium`), eslint-plugin-react-refresh 0.5.7 (#41). `dependabot.yml`: grupos `eslint` e `i18n` (majors inclusive) e grupos disjuntos via `exclude-patterns`.

---

## [3.6.2] - 2026-10-22

### 🐛 Fixed

- **FIX**: A CSP de `index.html` bloqueava os hits que o gtag.js envia via `<img>` (violação de `img-src` para `www.googletagmanager.com/td`, vista no `npm run smoke:csp`). O `img-src` passou a incluir `*.google-analytics.com` e `www.googletagmanager.com`, os mesmos hosts de coleta já liberados no `connect-src`, conforme o guia de CSP do GA4. Sem mudança visível para o usuário; só evita perder hits do GA4.

---

## [3.6.1] - 2026-08-21

### 🔒 Security

- **SECURITY**: Corrigidas duas RPCs do Supabase (`get_leaderboard`, `registrar_busca`) após revisão via Supabase Security Advisor. `get_leaderboard` agora tem teto de 100 no `limit_count` (`LEAST`/`GREATEST`), com `COALESCE(limit_count, 50)` cobrindo o caso de um caller passar `NULL` explicitamente e resultar em `LIMIT NULL` (= sem limite). `registrar_busca` passa a validar o tamanho de `full_report` via `octet_length` (tamanho lógico do JSON) em vez de `pg_column_size` (que mede o tamanho comprimido/TOAST no disco e podia ser contornado por payloads muito compressíveis) e valida `repo_name` (nulo ou > 300 caracteres), ambos com `RAISE EXCEPTION` antes do `INSERT`. As duas funções também passaram a usar `DROP FUNCTION IF EXISTS` antes do `CREATE OR REPLACE`, seguindo a convenção já estabelecida em `get_repo_history.sql`. SQL rastreado em `supabase-migrations/get_leaderboard.sql` e `supabase-migrations/registrar_busca.sql`.
- **SECURITY**: Documentadas em `AGENTS.md` duas decisões conscientes confirmadas via Supabase Security Advisor, para não serem reabertas por engano: RLS habilitada com zero policies em `analytics_searches` é o estado correto e esperado (sinalizado como INFO "RLS Enabled No Policy"); as 4 RPCs públicas (`get_leaderboard`, `get_repo_history`, `obter_snapshot`, `registrar_busca`) serem `SECURITY DEFINER` e executáveis por `anon`/`authenticated` é intencional — é assim que o app funciona sem exigir login — e o WARN estrutural do Advisor sobre isso é permanente, não um problema de código a "resolver".

---

## [3.6.0] - 2026-07-31

### ✨ Added

- **UX**: Substituídas todas as 10 chamadas de `alert()` bloqueante do app (compartilhamento, exportação de PDF, validações do Benchmark, rejeição de repositório privado) por um sistema de notificação toast não-bloqueante (`src/components/Toast.jsx` + `src/hooks/useToast.js`). Mensagens de erro persistem até fechamento manual; sucesso/aviso somem sozinhas após 5s. Nenhum texto traduzido foi alterado, só o mecanismo de exibição.

---

## [3.5.2] - 2026-07-30

### 🐛 Fixed

- **FIX**: `Timeline.jsx` renderizava `<Line>` sem garantir que o `chart.js` estivesse registrado (diferente de `Dashboard.jsx`/`Benchmark.jsx`, que já usam `React.lazy()` + `ensureChartSetup()` para isso). Ao acessar um permalink de Timeline como primeira página da sessão, isso causava um crash real (`"category" is not a registered scale"`). Corrigido com um gate (`useEffect` + `ensureChartSetup()` + skeleton) antes de montar o gráfico.

### ⚡ Performance

- **PERF**: Chart.js agora é prefetched (fire-and-forget, via `ensureChartSetup()`) em paralelo com o início de cada busca (`useRepository.js`) e cada adição de repo no Benchmark (`handleAddRepo`), em vez de só ser carregado quando um gráfico tenta montar. Reduz o lag da primeira renderização de gráfico após um carregamento de página em ~125ms de média (medido com latência de rede simulada realista para chunks estáticos; em localhost puro, sem latência de CDN, a diferença é desprezível). Não afeta o tamanho de nenhum chunk — só quando o download começa.

---

## [3.5.1] - 2026-07-29

### 🐛 Fixed

- **FIX**: `handleSearch` em `Dashboard.jsx` usava `window.history.pushState()` bruto para atualizar a URL após uma busca via SearchBar, o que dessincronizava o `location` interno do react-router-dom do que a barra de endereços realmente mostrava. Isso fazia o `useEffect` que limpa resíduo de busca anterior (adicionado no fix de v3.4.1, commit `47f94f5`) nunca disparar quando a navegação de volta para `/` acontecia via `<Link>` (ícones de Home/Buscar no Header) depois de uma busca feita pelo campo de texto — o bug só não aparecia ao navegar direto por URL, que foi o cenário testado originalmente. Corrigido substituindo o `pushState` bruto por `useSearchParams()` do react-router-dom.

---

## [3.5.0] - 2026-07-29

### 🔒 Security

- **SECURITY**: Removidas as policies de RLS "Permitir inserts publicos" (INSERT, `with_check: true`) e "Permitir leitura publica" (SELECT, `qual: true`) da tabela `analytics_searches`, que liberavam leitura/escrita direta para o role `anon`, ignorando completamente as RPCs (`registrar_busca`, `obter_snapshot`, etc). A documentação já afirmava (incorretamente) que INSERT anônimo estava bloqueado — não estava. Todo acesso agora passa exclusivamente pelas RPCs `SECURITY DEFINER`.
- **SECURITY**: Bloqueado o processamento e a persistência de repositórios privados. A aplicação nunca checava `repoData.private` ao buscar via API do GitHub; combinado com um PAT de escopo privado e o "save on load" automático, isso permitia vazar dados de repositório privado para qualquer pessoa não autenticada. Corrigido em `src/hooks/useRepository.js` (aborta com erro `PRIVATE_REPO_UNSUPPORTED` antes de qualquer chamada adicional ou persistência) e em `src/pages/Benchmark.jsx` (checagem própria via `githubService.fetchRepository`, com retry via `withExponentialBackoff` e fail-closed se a visibilidade não puder ser confirmada). Novas mensagens: `errors.privateRepo`, `errors.privacyCheckFailed`.
- **SECURITY**: Identificado que a anon key do Supabase estava exposta em texto puro no histórico do git (commit `.env` em dez/2025). A chave foi rotacionada no painel do Supabase; o histórico do git em si não foi reescrito (decisão consciente — reescrever histórico é destrutivo).
- **SECURITY**: Adicionada Content-Security-Policy em `index.html` (não existia antes) — `default-src 'self'`, `script-src` liberando `googletagmanager.com`, `style-src 'self' 'unsafe-inline'` (necessário pelo `html2canvas` do export de PDF, que aplica estilo inline via `setAttribute`/`cssText` — confirmado por teste real, não suposição), `img-src` liberando `avatars.githubusercontent.com` e `data:`, `connect-src` liberando `api.github.com`, Supabase (via `%VITE_SUPABASE_URL%`) e os domínios de coleta do GA4, `object-src 'none'`, `base-uri 'self'`. Limitação conhecida: `frame-ancestors`/`report-uri` não funcionam via `<meta>` (só via header HTTP real) — GitHub Pages não permite esse mecanismo de proteção contra clickjacking.
- **SECURITY**: `react-router-dom` atualizado de `^7.10.1` para `^7.18.2`, corrigindo um open redirect via backslash (CVE no range `7.0.0-7.14.1`). Adicionada validação defensiva em `RepoInfoCard.jsx` (`SAFE_GITHUB_NAME_PATTERN`) antes do `navigate()` para a rota `/timeline/:owner/:repo` — defesa em profundidade, já que `owner`/`repo` podem vir de um snapshot persistido no Supabase, não só de busca ao vivo. Nova mensagem: `errors.invalidRepoName`.

### 🐛 Fixed

- **FIX**: `src/services/githubService.js` interpolava `owner`/`repo`/`defaultBranch` sem `encodeURIComponent` em 18 endpoints, incluindo query strings de busca (ex: `` repo:${owner}/${repo}+type:pr ``). Corrigido em todos os pontos, aplicando o encode apenas aos valores interpolados para não quebrar a sintaxe de qualifiers das query strings de busca do GitHub.

### ✨ Added

- **FEAT: Smoke test de CSP (`scripts/csp-smoke-test.mjs`)**: primeiro teste automatizado do projeto. Via Playwright (nova devDependency), roda um fluxo real (busca + export de PDF) contra o build de produção E o dev server, capturando violações de CSP, requisições de rede para domínios do GA4 e status de WebSocket. Rodável via `npm run smoke:csp`. Suporta as env vars opcionais `SMOKE_SNAPSHOT_ID` (bypassa a API do GitHub via permalink) e `SMOKE_GITHUB_TOKEN` (injeta um token no localStorage do browser de teste, nunca logado).

---

## [3.4.1] - 2026-07-28

### 🐛 Fixes

- **FIX**: Resolução do bug de "estado fantasma" na navegação SPA. Adicionado limpador de estado reativo no Dashboard atrelado à URL.
- **FIX**: Forçada a remontagem do SearchBar via prop key para limpar texto residual.
- **FIX**: Correção de erro de sintaxe/duplicação no arquivo `analytics.js` que estava quebrando o pipeline de build.

---

## [3.4.0] - 2026-02-19

### ☢️ Governance & Risk Edition

- **FEAT: Fator de Ônibus (Bus Factor) com cálculo rigoroso (Pareto 70%)**: Novo motor matemático em `src/utils/busFactor.js` que ordena contribuidores por commits, acumula até o limiar de 70% do esforço total e determina o número mínimo de desenvolvedores críticos. Classificação em 4 níveis de risco: Crítico (1 dev), Alto (2), Moderado (3-4) e Saudável (5+).
- **FEAT: Risk Card no Dashboard com avatares, classificação de risco e barra de progresso nativa em Tailwind**: Novo componente `BusFactorCard` com número central do Bus Factor com cor semântica por risco, avatares dos key developers com borda colorida, barra horizontal empilhada (divs Tailwind com largura inline proporcional) e legenda. Integrado como seção "Análise de Risco" entre Governança/Maturidade e Gráficos. i18n completo (PT-BR/EN-US).

---

## [3.3.0] - 2026-02-19

### 📊 Data Science Edition

- **FEAT: Exportação Avançada (CSV)**: Adicionado suporte nativo para download de métricas em formato CSV (separado por vírgulas e compatível com Excel via UTF-8 BOM). Motor próprio sem dependências externas, com escape RFC 4180 para campos com caracteres especiais.
- **FEAT: Integração CSV no Dashboard e Benchmark**: Botão "CSV" no Dashboard exporta 13 métricas do repositório (Stars, Forks, Issues, Health Score, Lead Time, Code Churn, Divergência, Branches, PRs, Merges, Releases). Botão "Exportar CSV" na Tabela Comparativa do Benchmark exporta colunas idênticas à tabela visual (Health Score, Lead Time, Divergência, Code Churn, Risco Bus Factor). Headers traduzidos dinamicamente via i18n (PT-BR/EN-US).

---

## [3.2.0] - 2026-02-19

### 🛡️ Resilience & Stability

- **FEAT: Exponential Backoff para Analytics**: Implementação de lógica de retentativas (Exponential Backoff) para envios de analytics ao Supabase, garantindo que oscilações de rede não percam dados. O serviço agora tenta reenviar automaticamente antes de desistir silenciosamente.
- **FEAT: Tratamento de Falhas Parciais (PartialDataAlert)**: Tratamento de falhas parciais da API do GitHub (ex: Rate Limit de commits). O painel agora renderiza o que conseguiu carregar e exibe um banner amigável (`PartialDataAlert`) detalhando os dados ausentes, em vez de silenciar erros.

---

## [3.1.2] - 2026-02-13

### 🐛 Patch Fix

- **Dynamic Version Display**: O componente `Header` agora exibe a versão da aplicação dinamicamente lendo do `package.json`, eliminando strings hardcoded e garantindo sincronização automática com o versionamento do projeto.

---

## [3.1.1] - 2026-02-13

### Refactoring Edition — 5 Sprints de Maturidade Técnica

Refatoração completa da codebase baseada no [Tech Debt Report v3.1.0](docs/TECH_DEBT_v3.1.0.md), executada em 5 sprints incrementais.

### 🐛 Sprint 1 — Bug Fixes & Quick Wins
- **Fix `useChartTheme`**: Adicionadas propriedades `tooltipBg`/`tooltipText` + `useMemo` no retorno do hook para corrigir tooltips sem cor em dark mode.
- **Safe localStorage**: Criado wrapper `src/utils/storage.js` com try-catch para evitar exceções em navegação privada (Safari/Firefox).
- **Dead code removido**: `sanitizeForJson.js` e export `allSuccess` não utilizado em `useBenchmarkRepos`.

### ⚡ Sprint 2 — Performance (useMemo em Charts)
- **Memoização de charts**: `chartData` e `chartOptions` envolvidos em `useMemo` em `Timeline.jsx`, `BenchmarkEvolutionChart.jsx`, `BenchmarkComparisonChart.jsx` e `CommitActivityChart.jsx`.
- **Padronização**: Todos os gráficos seguem o mesmo padrão de memoização para evitar re-criação do canvas Chart.js.

### 🔄 Sprint 3 — DRY (useTimeFilter Unificado)
- **`useTimeFilter` hook**: Lógica de filtragem temporal (7d/30d/60d/90d/all) extraída para hook reutilizável, eliminando duplicação entre Timeline e Benchmark.
- **`<TimeRangeFilter>` component**: Componente de UI unificado para seleção de período temporal.

### 🏗️ Sprint 4 — Architecture (Componentização)
- **Dashboard extraído**: `Dashboard` movido de `App.jsx` para `src/pages/Dashboard.jsx` com `snapshotAdapter.js` separado.
- **Benchmark componentizado**: 5 sub-componentes extraídos (`BenchmarkSearchForm`, `BenchmarkRepoChips`, `BenchmarkHealthBars`, `BenchmarkBusFactorRisk`, `BenchmarkDetailTable`).

### 🛡️ Sprint 5 — Security & Polish
- **Proteção XSS**: `dangerouslySetInnerHTML` substituído por componente `Trans` do react-i18next.
- **i18n completo**: Todas as strings hardcoded em português migradas para arquivos de locale.
- **Constantes extraídas**: Magic numbers movidos para `src/constants.js` (API pagination, thresholds, PDF config).
- **Migração de contexto**: `docs/CONTEXT.md` migrado para `CLAUDE.md` no padrão oficial Claude Code.

---

## [3.1.0] - 2026-02-13

### 🎉 Major Feature: Benchmark Multi-Repo
- **Página Benchmark (`/benchmark`)**: Comparação simultânea de até 10 repositórios com seleção via chips coloridos e remoção individual.
- **Gráficos de Evolução Comparativa**: Line charts com eixo temporal (`chartjs-adapter-date-fns`) mostrando evolução de Stars por repositório.
- **Gráficos de Comparação por Categoria**: Bar charts agrupados por Popularidade (Stars, Forks), Velocidade (Lead Time, Code Churn) e Qualidade (Health Score, Divergência).
- **Tabela Comparativa**: Tabela detalhada com Health Score, Lead Time, Divergência, Code Churn e classificação de risco Bus Factor.
- **Hook `useBenchmarkRepos`**: Busca paralela de dados via TanStack Query com `useQueries`, parse de `full_report` e extração de histórico completo.

### ⏱️ Filtros Temporais Unificados (Time Range)
- **Benchmark Filters**: Sistema de filtros (7d, 30d, 60d, 90d, todo histórico) acima dos gráficos do Benchmark. Default: 30d para normalizar visualização inicial de repos com datas de início diferentes.
- **Timeline 60d**: Novo filtro de 60 dias adicionado à página Timeline, expandindo as opções existentes.
- **Filtragem por `created_at`**: Dados filtrados via `useMemo` antes de serem passados aos componentes de chart, mantendo apenas registros dentro da janela temporal selecionada.

### 🌐 Internacionalização
- **Benchmark i18n**: Todas as strings do Benchmark traduzidas em PT-BR e EN-US (título, subtítulo, filtros, categorias, tabela, estados vazios/erro).
- **Filtro 60d**: Labels "60 dias" (PT) / "60 days" (EN) adicionados em `timeline.filters` e `benchmark.filters`.

### 🎨 UI/UX
- **Segmented Control Filters**: Botões de período com estilo consistente dark mode (mesmo padrão da Timeline).
- **Repo Chips**: Tags de seleção com cor identificadora, nome e botão de remoção.
- **Lazy Loading**: Charts do Benchmark carregados via `React.lazy` + `Suspense`.

---

## [3.0.1] - 2026-02-13

### 🔒 Security Hotfix
- **Dependency Updates**: Atualização crítica do `html2pdf.js` (v0.14.0) e `jspdf` para mitigar vulnerabilidades de XSS e injeção detectadas em CVEs anteriores.
- **Security Audit**: Varredura completa de dependências para garantir segurança da cadeia de suprimentos.

### ✨ Enhancements
- **Filtros Temporais no Timeline**: Implementação de controles de período (7d, 30d, 90d, todo histórico) na página Time Machine, permitindo análise focada de intervalos específicos.
- **UX Improvements**: Interface segmentada com botões de filtro estilizados e suporte completo a dark mode.

---

## [3.0.0] - 2026-02-12

### 🎉 Major Feature: Time Machine (Histórico de Evolução)
- **Visualização Temporal de Métricas**: Nova página `/timeline/:owner/:repo` para visualizar a evolução histórica de repositórios através de gráficos de linha interativos.
- **Gráficos de Evolução**: Gráficos Chart.js mostrando evolução de Stars, Forks e Watchers ao longo do tempo com dados extraídos de snapshots históricos.
- **Supabase RPC**: Nova função `get_repo_history(p_repo_name)` para buscar histórico completo de análises ordenadas cronologicamente.
- **UI Enhancements**: Botão "📈 Ver Evolução" adicionado ao RepoInfoCard para acesso direto à timeline do repositório.
- **Cards de Resumo**: Visualização de primeira análise, última análise e crescimento total de stars.
- **Internacionalização Completa**: Todas as strings da nova feature traduzidas em PT-BR e EN-US.

### 🛠️ Backend
- **Nova RPC**: `get_repo_history` com segurança `SECURITY DEFINER` e `SET search_path = public`.
- **Serviço Analytics**: Método `getRepoHistory(repoName)` adicionado para consumir a nova RPC.

### 🎨 UX/UI
- **Nova Rota**: `/timeline/:owner/:repo` integrada ao React Router.
- **Estado de Loading/Error**: Tratamento robusto de estados de carregamento e erro com feedback visual claro.
- **Dark Mode Support**: Tema escuro totalmente suportado nos novos gráficos através do hook `useChartTheme`.
- **Botão de Navegação**: Botão "Voltar ao Dashboard" para navegação intuitiva.

### 📊 Data Visualization
- **Line Charts**: Gráficos de linha com preenchimento gradiente e tensão suavizada (0.4).
- **Tooltips Interativos**: Tooltips detalhados mostrando valores de múltiplas métricas por data.
- **Cores Semânticas**: Dourado (#FFD700) para Stars, Azul (#3B82F6) para Forks, Verde (#10B981) para Watchers.

---

## [2.8.3] - 2026-01-20

### Fix (Navigation): Header State Management
- **Global Modal State**: Refactored settings modal state to App.jsx level, ensuring Header buttons (Settings & Language) work consistently across all routes (Dashboard & Ranking).
- **Cross-Route Functionality**: Fixed issue where configuration and language buttons were non-responsive in Ranking page due to isolated state management.

### Fix (i18n): Complete Internationalization
- **Missing Translations**: Added complete translations for Help Modal, Settings Modal, Ranking table, and Navigation links.
- **Header Navigation**: Implemented i18n for "Buscar/Search" and "Ranking" navigation links.
- **Modal Content**: Fully translated Help Modal (about, token setup, usage steps) and Settings Modal (title, description, labels, buttons).
- **Ranking Page**: Translated all table headers, loading/error messages, and empty state content.

### UX: Universal Access to Settings
- **Consistent Experience**: Users can now access settings and change language from any page in the application.
- **State Persistence**: Modal state properly managed globally to prevent navigation issues.

---

## [2.8.2] - 2025-12-19

### Feat (i18n): Timezone Detection
- **Automatic Timezone Detection**: Implemented automatic timezone detection using `Intl.DateTimeFormat().resolvedOptions().timeZone`. Date searches now respect the user's local timezone (e.g., Japan, Lisbon) instead of being fixed to 'America/Recife'.

### Backend: RPC Update
- **Dynamic Timezone Parameter**: Updated `buscar_snapshot_por_data` RPC to accept dynamic `p_timezone` parameter.

---

## [2.8.1] - 2025-12-18

### Architecture: Save on Load Strategy
- **Auto-Save Implementation**: Mudança fundamental da estratégia de persistência para "Save on Load". Agora os snapshots são salvos automaticamente ao fim da busca, garantindo integridade histórica e IDs únicos, em vez de depender da ação de compartilhar.

### Fix: Critical JSON Parse Issue
- **App.jsx JSON Handling**: Correção crítica no `loadSnapshot` e `loadSnapshotByDate` adicionando `JSON.parse()` obrigatório para tratar o campo `full_report` (que vem serializado como string do banco), evitando `TypeError` ao tentar acessar propriedades.

### Feature: Data Sanitization
- **Robust Sanitization**: Implementação de sanitização de dados (`sanitizeForJson`) para evitar falhas em repositórios gigantes onde a API do GitHub pode retornar referências circulares ou objetos não serializáveis.

### UX: Instant Share Button
- **Instant Sharing**: O botão 'Compartilhar' agora é instantâneo (apenas cópia de link), pois os dados já estão salvos automaticamente, melhorando a experiência do usuário.

---

## [2.7.4] - 2025-12-18

### Fix
- **Correção de loop infinito (re-render cycle) na busca semântica por data**: Implementação de guard clause com useRef para prevenir fetches duplicados no endpoint `buscar_snapshot_por_data`.

---

## [2.7.3] - 2025-12-17

### Feature: Busca Semântica Histórica
- **URLs Legíveis**: Suporte a `/?repo=owner/project&date=YYYY-MM-DD` para buscar snapshots por data.
- **Data da Análise**: Exibição da data/hora de coleta no card principal do dashboard.

### UX
- **Badge Temporal**: Ícone de relógio com formatação inteligente da data de análise.
- **Timezone Handling**: Correção de timezone (UTC vs Local) na busca de snapshots por data.

### Fix
- **Hierarquia de Busca**: Implementação completa da prioridade: ID > Semantic > Live.
- **Compatibilidade**: Manutenção de URLs existentes (?id= e ?q=).

---

## [2.7.2] - 2025-12-17

### Feature: Deep Linking & Snapshots
- **Deep Linking**: URLs de busca ao vivo (`/?q=owner/repo`) para compartilhamento direto.
- **Snapshots Permanentes**: Links imutáveis via ID (`/?id=123`) com dados congelados.
- **Botão Compartilhar**: Geração automática de permalinks via clipboard.

### Backend
- **Schema Update**: Migração para IDs `BIGINT` e scores `NUMERIC` no Supabase.
- **RPC Seguras**: `registrar_busca` e `obter_snapshot` com validação de dados.
- **Security Hardening**: Bloqueio de INSERT direto para usuários anônimos via RLS.

### UX
- **Modo Histórico**: Alerta visual diferenciando dados estáticos vs atuais.
- **URL Management**: Sincronização automática entre estado da aplicação e URL.
- **Adaptador de Dados**: Conversão flat→nested dos dados do Supabase.

---

## [2.7.1] - 2025-12-12

### Security
- Implementação de RPC segura no Supabase para validação de dados.
- Bloqueio de INSERT direto via RLS (Hardening).

### Docs
- Atualização do guia de contribuição para stack Vite/React.

---

## [2.7.0] - 2025-12-10

### New Feature: JSON Data Export
- **Exportação de dados em JSON**: Botão secundário no RepoInfoCard para baixar dados brutos com metadados de proveniência.

### Fix: GitHub API 422 Error Handling
- **Tratamento silencioso para erro 422**: FetchCodeFrequency agora retorna array vazio silenciosamente em repositórios gigantes.

### Engineering & Quality
- **Performance**: Otimização de renderização de gráficos com `useMemo` para evitar re-renders desnecessários em componentes Chart.js.
- **Acessibilidade (A11y)**: Melhorias semânticas na tabela de Ranking (`scope="col"`) e ícones (`aria-label`, `aria-hidden`) para conformidade WCAG AA (Leitores de tela).
- **Code Quality**: Remoção de logs de debug e código morto (Dead Code) pós-refatoração, fortalecimento do tratamento de erros no serviço de analytics.

---

## [2.6.0] - 2025-12-10

### New Feature: Leaderboard (Bisolhômetro)
- **Página de Ranking (/ranking)**: Nova página com tabela de classificação de repositórios mais analisados.
- **Data Engineering**: Coleta de snapshot completo (Estrelas, Health Score, Linguagem) no Supabase a cada busca.
- **UX/UI**: Nova navegação no Header (Links Buscar/Ranking) e correção de rotas com basename.
- **Refactor**: Botão de PDF movido para o contexto do card do repositório.

---

## [2.5.0] - 2025-12-09

### Analytics & Persistência

- **Analytics Híbrido:** Implementação do Supabase para persistência de buscas (bypassing AdBlock) em paralelo com Google Analytics 4.
- **Infraestrutura:** Adição de cliente Supabase e novas variáveis de ambiente.
- **Resiliência:** Melhoria no tratamento de falhas da API (Fail-safe).

---

## [2.4.0] - 2025-12-03

### Analytics & Qualidade

- **Google Analytics 4:** Implementação completa de rastreamento de eventos (Buscas, Downloads) e PageViews para monitoramento de crescimento.
- **ESLint Otimizado:** Ajuste nas regras de linting para ignorar pastas de build e legado, garantindo um CI/CD limpo.

---

## [2.3.0] - 2025-12-03

### 🎨 Design & Global Experience

- **Dark Mode:** Full dark theme (Abyssal Shark) with persistence and automatic graphic adaptation.
- **Internationalization (i18n):** Full support for **Portuguese (PT-BR)** and **English (EN-US)** with automatic detection.
- **UI Refinements:** Z-Index correction in the Header and translated dynamic Bus Factor messages.

---

## [2.2.0] - 2025-12-02

### 🚀 Performance & UX
- **TanStack Query:** Migração para React Query com cache inteligente (5min), retentativas automáticas e eliminação de waterfalls.
- **Skeleton Screens:** Implementação de placeholders pulsantes para melhorar percepção de velocidade (LCP otimizado).
- **Code Splitting:** Lazy loading dos componentes de gráficos (Chart.js) para reduzir bundle inicial.

---

## [2.1.0] - 2025-12-01

### ✨ Adicionado
- **Exportação de PDF:** Botão funcional para baixar relatório completo.
- **Identidade Visual:** Logo oficial do Assert Lab e Favicon.

### 🔧 Corrigido
- **Dados:** Correção crítica nas queries da Search API (Issues e PRs estavam zerados).
- **Gráficos:** Ajuste na lógica de 'Smart Trim' do Fluxo de Trabalho para projetos novos.
- **Deploy:** Correção de caminhos absolutos (assets) para suporte ao GitHub Pages.

---

## [1.2.0] - 2025-11-30

### ✨ Added
- **Process Analysis Module**: New section analyzing Pull Request dynamics with Lead Time and Divergence/Convergence metrics
  - Lead Time calculation: Average time from PR creation to merge, with smart singular/plural display ('hora' vs 'horas')
  - Divergence metric: Average comments per PR, categorized as 'Baixa (Silencioso)', 'Saudável', or 'Alta (Debate Intenso)'
  - Extreme defensive programming: Handles NaN cases, null arrays, and invalid data gracefully
- **Code Churn Analysis**: Added churn rate calculation to metrics cards with API status handling
  - Returns null for 202/empty responses, displays "Calculando pelo GitHub..." in UI
  - Tracks lines added/removed over time for code volatility insights
- **Zombie Branches Detection**: Enhanced maturity analysis with branch zombie identification
  - Always displays badge (green for 0 zombies, red for >0)
  - Identifies stale branches that may indicate poor maintenance practices
- **Merged PRs Counter**: Repository info now includes total merged pull requests
  - Provides insight into project activity and contribution patterns
- **Dynamic Chart Transparency**: Commit charts now show sample size in titles
  - Displays "(Amostra: X commits)" to indicate data scope
  - Helps users understand analysis limitations for small repositories

### 🔧 Changed
- **Tooltip System**: Updated all tooltips with explicit classification criteria
  - Divergence: "< 1: Baixa (Silencioso), 1 a 5: Saudável, > 5: Alta (Debate Intenso)"
  - Work Habits: "Alerta se > 30% de Madrugada ou > 50% no Fim de Semana"
  - Bus Factor: "Risco de Atenção se > 40%, Risco Crítico se > 60%"
  - Health Score: "Nota baseada em 7 itens: Readme, License, Contributing, Description, Code of Conduct, Issue Template e PR Template"
- **API Error Handling**: Improved robustness for GitHub API responses
  - Better null/empty response handling across all modules
- **Data Validation**: Extreme defensive programming in divergence calculation
  - Input validation, safe averaging, NaN protection

### 🐛 Fixed
- **NaN Classification Bug**: Fixed divergence metric incorrectly categorizing NaN as high debate
  - Now properly returns 'Sem dados (0 PRs)' for empty repositories
- **Plural Logic**: Lead Time now correctly displays singular forms ('1 hora' vs '2 horas')
- **Chart Titles**: Dynamic titles now reflect actual commit sample sizes

---

## [1.1.0] - 2025-11-29

### ✨ Added
- **Commit History Flow Chart**: New timeline visualization showing commit activity over the repository's lifetime
  - Smart trimming for young projects (< 52 weeks)
  - Weekly commit aggregation with responsive line charts
- **Enhanced Toolbar**: Improved header with help modal and PDF export functionality
  - Contextual help for token configuration and usage
  - One-click PDF report generation
- **Release Counter**: Repository info now displays total releases/tags
  - Provides insight into project versioning and release frequency

### 🔧 Changed
- **UI Polish**: Refined responsive layouts and hover effects
- **Performance**: Optimized chart rendering and data processing

---

## [1.0.0] - 2024-11-28

# 🎉 Release Notes - Bisolhador Dashboard v1.0.0

We're thrilled to announce the launch of **Bisolhador Dashboard v1.0.0**, the first stable release of our GitHub Repository Analysis tool! This milestone marks the culmination of dedicated efforts to create an intuitive, reliable platform for educators and developers to gain valuable insights into software engineering practices.

## 🚀 What's New in v1.0.0

### 🔍 **Busca & Dados** (Fail-Safe, Token)
- **Intelligent Search**: Seamlessly search and analyze GitHub repositories using the simple `owner/repo` format.
- **Robust Fail-Safe Mechanisms**: Built-in error handling ensures the application remains stable even during API failures, rate limits, or connectivity issues.
- **GitHub Token Integration**: Easily configure personal tokens via the settings ⚙️ button to increase request limits from 60 to 5,000 per hour, enabling uninterrupted analysis sessions.

### 📊 **Métricas Visuais** (Gráficos, Stack Tecnológica)
- **Dynamic Charts**: Visualize commit patterns across weekdays with intuitive bar charts that highlight work habits and crunch periods.
- **Technological Stack Visualization**: Explore project language composition through dynamic, color-coded doughnut charts. Known languages feature standardized colors, while unknown languages receive algorithmically generated hues for optimal readability.

### 🔬 **Análise de Processo** (Bus Factor, Crunch, Taxa de Resolução)
- **Contributors Table**: Analyze team composition and distribution through a comprehensive contributors ranking, helping identify Bus Factor risks.
- **Crunch Detection**: Automated analysis of commit timing to detect excessive weekend or late-night work, promoting healthy development practices.
- **Resolution Rate**: Calculate issue resolution efficiency with real-time metrics showing open vs. closed issue ratios, supporting project health assessments.

### 🛡️ **Governança** (Health Score, Maturidade de Engenharia)
- **Community Health Score**: Evaluate repository governance through a scoring system based on 7 critical files (README, License, Contributing Guidelines, etc.), providing a percentage-based health indicator with color-coded feedback.
- **Engineering Maturity Assessment**: Inspect infrastructure quality by checking for Automated Tests, CI/CD pipelines, Linters, and Security Auditing tools, displayed through intuitive badge visualizations.

### 🛠️ **Utilitários** (PDF, Tooltips)
- **PDF Export**: Generate comprehensive PDF reports of all dashboard metrics, perfect for documentation, presentations, or archival purposes.
- **Interactive Tooltips**: Contextual help throughout the interface with hover-based explanations, ensuring users understand each metric's significance.
- **Responsive Design**: Mobile-friendly layouts that adapt gracefully across devices, built with modern Tailwind CSS.

## 🏆 Key Highlights
- **Educational Focus**: Designed specifically to support Software Engineering education, helping students and instructors identify best practices and common pitfalls.
- **Open Source Community**: Built for collaboration, using GitHub's ecosystem to analyze projects within the platform.
- **Privacy-First**: All configured tokens remain local to your browser, ensuring data security and user control.
- **Zero Dependencies Setup**: Launch the dashboard instantly using VS Code's Live Server extension - no complex installations required.

## 📈 Performance & Reliability
- **Stable API Integrations**: Comprehensive error handling for all GitHub API calls, maintaining functionality even during network issues.
- **Efficient Rendering**: Fast, responsive UI updates powered by Chart.js and Vanilla JS architecture.
- **Accessible Interface**: Professional design with Shark/Ocean color themes, clear typography, and semantic HTML structure.

## 🤝 Acknowledgments
A heartfelt thank you to everyone who contributed to making Bisolhador v1.0.0 a reality:

- **Core Development Team**: Vinicius Cardoso Garcia and the ASSERT Lab community for their vision and expertise.
- **Beta Testers**: Early adopters who provided invaluable feedback on usability and functionality.
- **Open Source Community**: Leveraging powerful tools like GitHub API, Tailwind CSS, and Chart.js to build this solution.
- **Educators and Developers**: Whose innovative practices inspired the creation of tools to measure and improve software engineering excellence.

We're excited to see how the community uses Bisolhador to enhance educational outcomes and promote better development habits. This is just the beginning - stay tuned for future updates and enhancements!

---

**Get Started**: Clone the repository, install the Live Server extension in VS Code, and open `index.html`. Happy analyzing!

Celebrating this milestone with 🦈 (our Recife roots)!
