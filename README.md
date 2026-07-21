# Radar PNCP

Interface web estática para consultar dados públicos do Portal Nacional de Contratações Públicas (PNCP). A aplicação busca contratos por município ou CNPJ fornecedor, permite pesquisar palavras presentes no objeto e filtrar contratos ativos ou inativos.

Também oferece categorias temáticas de seleção múltipla — Saúde, Software e TI, Educação, Obras e Engenharia, Alimentação, Veículos, Limpeza e Segurança. A classificação é transparente: cada resultado mostra os termos do objeto que determinaram sua categoria. As categorias funcionam como alternativas entre si; o campo de palavras é aplicado como refinamento adicional.

A consulta utiliza automaticamente uma janela móvel de 12 meses. Em 20/07/2026, por exemplo, o período pesquisado é de 20/07/2025 a 20/07/2026.

Na busca municipal, a opção `Todos` apresenta tanto processos de contratação quanto contratos formalizados. Os filtros `Somente ativos` e `Somente inativos` exibem exclusivamente contratos, classificados pelas datas de vigência.

Os contratos municipais também são agrupados por empresa contratada, mostrando razão social, CNPJ, quantidade de contratos, situação e valor acumulado.

A consulta por fornecedor usa o índice público de pesquisa do PNCP para localizar diretamente o CNPJ sem máscara e aplica, em seguida, a janela móvel de 12 meses da plataforma.

Nos resultados municipais, o Raio-X do objeto compara cada edital com contratos formalizados do mesmo recorte e destaca possíveis prestadores atuais ou fornecedores anteriores, indicando similaridade textual, valor e prazo de vigência. A correspondência é apresentada como estimativa e mantém acesso ao registro oficial para conferência.

Quando não há contrato semelhante, o próprio card permite consultar os resultados dos itens do edital. Essa consulta apresenta fornecedores homologados, CNPJ, quantidade de itens, porte e valor homologado, deixando claro que homologação não significa necessariamente contrato vigente.

## Executar localmente

```bash
pnpm install
pnpm run dev
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o conteúdo desta pasta para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. O workflow incluído em `.github/workflows/deploy.yml` fará o build e publicará o site.

## Fontes

- API de Consulta do PNCP: `https://pncp.gov.br/api/consulta/v1`
- API de Localidades do IBGE
- BrasilAPI para identificação cadastral do CNPJ

## Limitação importante

A API pública de contratos do PNCP não oferece, em sua especificação atual, filtro por CNPJ do fornecedor. Por isso, essa busca é feita por varredura paginada e correspondência exata no navegador. A interface informa quantas páginas foram verificadas e nunca apresenta uma varredura parcial como completa. Para busca nacional e histórica completa por fornecedor, a evolução recomendada é um indexador server-side periódico; o GitHub Pages hospeda somente aplicações estáticas.

Projeto independente, sem vínculo com o Governo Federal.
