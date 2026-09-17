# Histórico do projeto — Git Dojo

Registro das decisões e da proposta original do projeto, para dar contexto a quem chegar depois. O [README.md](../README.md) na raiz é a referência viva (o que o projeto é e como rodar); este arquivo é o histórico de como chegamos até ali.

## Origem da ideia

Proposta inicial: um jogo prático para ajudar devs juniores a estudar comandos git (inclusive tags), com apoio de uma "lib" — que na conversa virou o conceito de um **dicionário pessoal**: um glossário que o próprio aprendiz constrói conforme completa desafios, servindo depois como referência rápida (tipo um "codex" pessoal de git).

## Decisões tomadas

- **Web em vez de CLI/terminal real**: escolhido por ser mais visual (grafo de commits ajuda a formar o modelo mental), sem exigir instalação, e mais fácil de tornar atrativo para quem está aprendendo. Trade-off aceito: não é digitação em terminal de verdade, então ainda vale complementar com prática real depois.
- **Foco em comandos primeiro, boas práticas depois**: a trilha principal ensina comandos (`git branch`, `git tag -a`, etc.) por si só. Boas práticas/regras (ex: "não faça rebase em branch compartilhada") ficam como uma camada extra/opcional, desbloqueada depois — a lógica é que, sabendo o vocabulário, fica mais fácil entender o "porquê" das práticas.
- **Dicionário como mecânica central de retenção**: cada comando executado com sucesso desbloqueia um verbete (explicação curta + exemplo), guardado em `localStorage`. Decisão consciente de não usar backend/conta nessa fase — mais simples de prototipar, mas não sincroniza entre dispositivos.
- **Engine de git própria, não git real**: em vez de `isomorphic-git`, foi implementada uma simulação simplificada do estado de um repositório (`src/engine`). Ganha-se controle total sobre mensagens de erro e progressão pedagógica; perde-se fidelidade total ao comportamento real do git em casos avançados (staging por arquivo é simplificado, ainda não há merge/rebase).

## Estado no primeiro protótipo

Implementado: trilhas de Fundamentos, Branching e Tags (10 desafios), terminal simulado, grafo SVG, dicionário com progresso persistido.

Mapeado para depois (ver também a seção "Como contribuir" do README): trilhas de Merge & Conflitos, Rebase e Remoto; camada de Boas Práticas; possível persistência via conta/backend.
