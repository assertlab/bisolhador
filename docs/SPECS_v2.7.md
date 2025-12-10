# Especificação Técnica v2.7.0: Data Mining & Fixes

## 1\. Visão Geral

Esta versão foca na interoperabilidade de dados (permitindo extração em JSON) e na resolução de dívidas técnicas pendentes.

## 2\. Exportação JSON (Data Mining)

  * **Objetivo:** Permitir que pesquisadores e alunos baixem os dados brutos da análise para uso em ferramentas externas (Python, Jupyter, R).
  * **Implementação:**
      * Criar utilitário `src/utils/exportJson.js`.
      * Adicionar botão 'JSON' secundário no componente `RepoInfoCard`, ao lado do botão de PDF.
      * O arquivo `report.json` deve conter o objeto completo de métricas (estado do React).

## 3\. Correção de Erros (Dívida Técnica)

  * **GitHub API 422:** Tratamento definitivo do erro de 'Code Frequency' em repositórios gigantes (ex: facebook/react).
  * **Solução:** Refatorar `fetchCodeFrequency` para capturar status 422 e retornar array vazio silenciosamente, evitando erros vermelhos no console.
