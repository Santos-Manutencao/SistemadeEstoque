# Santos Manutenções - Sistema de Controle de Estoque

Sistema profissional, intuitivo e moderno para gestão completa de almoxarifado e controle de estoque, desenvolvido sob medida para a **Santos Manutenções**.

---

## 🌐 Acesso Online (GitHub Pages)
O sistema está publicado e acessível de forma 100% online, sem necessidade de servidores externos ou banco de dados pago:

👉 **[Acessar Sistema Online](https://santos-manutencao.github.io/SistemadeEstoque/)**

### 🔑 Credenciais Padrão de Acesso:
- **Usuário:** `admin`
- **Senha:** `santos123`
*(A senha pode ser alterada a qualquer momento na aba **Backup & Configurações**)*

---

## 💻 Como Executar Localmente (Offline)
1. Dê um **duplo clique** no arquivo `Iniciar_Sistema.bat` ou abra diretamente o arquivo `index.html` em qualquer navegador (Edge, Chrome, Firefox, etc.).
2. O sistema funciona **100% offline**, rápido e seguro no seu próprio computador.

---

## 💾 Salvamento Automático
- **Todas as alterações são salvas automaticamente**: cada novo produto cadastrado, edição, exclusão, entrada de mercadoria ou retirada para colaborador é gravada instantaneamente no navegador (via IndexedDB e LocalStorage).
- Não é necessário clicar em botões adicionais de salvar sistema: o indicador **"Salvo automaticamente"** no cabeçalho confirma a gravação contínua dos dados.

---

## 📋 Funcionalidades Principais

### 1. Autenticação e Segurança
- Tela de login com validação de usuário e senha.
- Opção para manter conectado no computador.
- Alteração segura de senha de administrador no painel de configurações.

### 2. Cadastro de Produtos & Estoque Inicial
- Cadastro ergonômico em 2 colunas com visibilidade total na tela (sem necessidade de zoom).
- Foto do produto com pré-visualização instantânea e zoom ampliado.
- Valor unitário (R$) e cálculo automático do valor total do patrimônio em estoque.
- Estoque inicial, estoque mínimo e disparo de alertas visuais de reposição.

### 3. Entradas e Reposições
- Registro de chegada de materiais com atualização instantânea do saldo disponível.
- Histórico com fornecedor, nota fiscal, data/hora e justificativa.

### 4. Retiradas / Saídas com Vínculo de Colaborador e Unidade
- **78 Colaboradores já integrados**: Autocompletar inteligente por nome ou matrícula.
- **Preenchimento Automático da Unidade**: Ao selecionar o funcionário, o sistema identifica e preenche automaticamente o local de trabalho (`CDA`, `TCS`, `TSA`, `ITAMINAS`, `ADM`).
- **Validação de Saldo**: O sistema bloqueia retiradas superiores à quantidade disponível.
- **Emissão de Cautela de Retirada**: Comprovante para impressão imediata em A4/PDF com termo de responsabilidade e assinaturas.

### 5. Gestão de Colaboradores
- Visualize a lista de todos os 78 colaboradores da Santos Manutenções.
- Filtro por unidade (`CDA`, `TCS`, `TSA`, `ITAMINAS`, `ADM`).
- Consulta ao histórico individual de retiradas de cada colaborador.
- Cadastro de novos colaboradores.

### 6. Relatórios & Exportação
- **Relatório de Posição de Estoque**: Inventário completo valorizado com logotipo oficial pronto para impressão em papel A4 / PDF.
- **Extrato de Movimentações**: Histórico com filtros por período, tipo e unidade.
- **Exportação CSV / Excel**: Download de tabelas completas para abrir no Excel.

### 7. Cópia de Segurança (Backup & Restauração)
- Exportação e importação de arquivo `.json` com todos os produtos, movimentações, fotos e colaboradores com 1 clique.

---

## 🏢 Unidades Operacionais Atendidas
- **CDA**
- **TCS**
- **TSA**
- **ITAMINAS**
- **ADM**
