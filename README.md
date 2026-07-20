# Radar PNCP

Interface web estática para consultar dados públicos do Portal Nacional de Contratações Públicas (PNCP). A aplicação busca processos por município e modalidade e permite varrer contratos em busca de um CNPJ fornecedor.

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
