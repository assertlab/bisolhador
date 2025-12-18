# ADR 001: Estratégia de Persistência - Save on Load

## Status
✅ Aprovado

## Contexto
O Bisolhador Dashboard precisava de uma estratégia de persistência para armazenar snapshots históricos de análises de repositórios GitHub. A decisão inicial foi implementar "Save on Share" (salvar ao compartilhar), mas revelou problemas críticos de integridade histórica.

## Problema
A estratégia "Save on Share" apresentava os seguintes problemas:

1. **Integridade Histórica Comprometida**: Dados podiam ser perdidos se o usuário não clicasse em "Compartilhar"
2. **Duplicidade de Registros**: Múltiplas buscas ao mesmo repositório geravam snapshots diferentes sem controle
3. **Inconsistência Temporal**: Séries históricas ficavam incompletas
4. **Dependência de Ação do Usuário**: A persistência dependia de comportamento não garantido

## Decisão
Implementar a estratégia **"Save on Load"** onde os snapshots são salvos automaticamente assim que uma busca é concluída com sucesso.

### Motivos da Decisão
1. **Integridade Garantida**: Toda análise válida é automaticamente preservada
2. **IDs Únicos**: Cada busca gera exatamente um snapshot com ID único
3. **Séries Temporais Completas**: Histórico cronológico confiável para análise educacional
4. **Transparência**: Usuário não precisa se preocupar com persistência
5. **Performance**: Operação assíncrona não impacta UX da busca

## Alternativas Consideradas

### Save on Share (Rejeitado)
- **Prós**: Controle total do usuário sobre o que salvar
- **Contras**: Integridade comprometida, dependência de comportamento

### Save on Demand (Rejeitado)
- **Prós**: Flexibilidade máxima
- **Contras**: Complexidade de UX, risco de perda de dados

### Auto-Save com TTL (Não Implementado)
- **Prós**: Controle automático de espaço
- **Contras**: Complexidade adicional, dados temporários

## Implementação

### Arquitetura
```
Busca → Análise Completa → Salvamento Automático → ID Injetado → Compartilhamento
```

### Código
```javascript
// useRepository.js
const searchId = await analytics.saveSearch(searchData, fullReportData);
// searchId injetado automaticamente no repoData
```

### Campos Salvos
- **Metadados**: `name`, `ownerType`, `language`, `stars`, `forks`, `issues`, `subscribers`, `lastPush`, `healthScore`
- **Dados Completos**: Objeto sanitizado com todas as métricas, gráficos e análises

## Consequências

### Positivas
- ✅ **Integridade Histórica**: 100% das análises são preservadas
- ✅ **IDs Determinísticos**: Uma busca = um snapshot
- ✅ **UX Simplificada**: Compartilhar é instantâneo
- ✅ **Análise Educacional**: Séries temporais confiáveis

### Negativas
- ⚠️ **Armazenamento**: Maior uso de espaço no banco (compensado por valor educacional)
- ⚠️ **Privacidade**: Dados salvos automaticamente (usuário informado)

### Riscos Mitigados
- **Referências Circulares**: Sanitização robusta de dados
- **JSON Corrompido**: Parse obrigatório com fallback
- **Performance**: Operação assíncrona não bloqueante

## Métricas de Sucesso
- Taxa de conversão: Compartilhar instantâneo (0ms de espera)
- Integridade: 100% das buscas geram snapshots válidos
- Satisfação: Redução de cliques para compartilhar

## Referências
- Issue #42: Problemas de integridade histórica
- PR #87: Implementação Save on Load
- Documentação: `docs/CONTEXT.md#persistência`

---
**Data**: 18/12/2025
**Autor**: Sistema de Desenvolvimento
**Revisores**: Equipe ASSERT Lab
