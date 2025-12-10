# Especificação Técnica v2.7.0: Data Mining & Fixes

## 1\. Visão Geral

Foco na interoperabilidade de dados e limpeza de dívida técnica.

## 2\. Exportação JSON (Data Mining)

  * **Objetivo:** Permitir que pesquisadores baixem os dados brutos da análise para uso externo (Python, Jupyter, R).
  * **Implementação:**
      * Função utilitária `exportJson(data, filename)`.
      * Botão 'JSON' no `RepoInfoCard`, ao lado do botão de PDF.
      * O arquivo deve conter todo o objeto de estado do repositório (Métricas, Gráficos calculados, Health Score).

## 3\. Correção de Erros (Dívida Técnica)

  * **GitHub API 422:** Tratamento definitivo do erro de 'Code Frequency' em repositórios gigantes (ex: facebook/react).
  * **Estratégia:** Se a API retornar 422 ou falhar, o gráfico de Commit Activity deve renderizar um estado vazio ou mensagem amigável, sem estourar erro vermelho no console.
