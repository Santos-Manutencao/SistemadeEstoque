/**
 * db.js - Camada de Persistência Híbrida (IndexedDB com Fallback LocalStorage)
 * Santos Manutenções - Sistema de Controle de Estoque
 */

const DB_NAME = 'SantosEstoqueDB';
const DB_VERSION = 1;

class EstoqueDatabase {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.useLocalStorage = false;
    this.readyPromise = this.init();
  }

  async init() {
    return new Promise(async (resolve) => {
      // Verifica suporte a IndexedDB
      if (!window.indexedDB) {
        console.warn('IndexedDB não suportado. Usando LocalStorage.');
        this.useLocalStorage = true;
        this.seedLocalStorageIfEmpty();
        this.isReady = true;
        resolve(this);
        return;
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('produtos')) {
            const storeProdutos = db.createObjectStore('produtos', { keyPath: 'id', autoIncrement: true });
            storeProdutos.createIndex('codigo', 'codigo', { unique: false });
            storeProdutos.createIndex('nome', 'nome', { unique: false });
            storeProdutos.createIndex('categoria', 'categoria', { unique: false });
          }

          if (!db.objectStoreNames.contains('movimentacoes')) {
            const storeMov = db.createObjectStore('movimentacoes', { keyPath: 'id', autoIncrement: true });
            storeMov.createIndex('tipo', 'tipo', { unique: false });
            storeMov.createIndex('produtoId', 'produtoId', { unique: false });
            storeMov.createIndex('dataHora', 'dataHora', { unique: false });
            storeMov.createIndex('unidadeDestino', 'unidadeDestino', { unique: false });
            storeMov.createIndex('matriculaFuncionario', 'matriculaFuncionario', { unique: false });
          }

          if (!db.objectStoreNames.contains('colaboradores')) {
            const storeColab = db.createObjectStore('colaboradores', { keyPath: 'id', autoIncrement: true });
            storeColab.createIndex('matricula', 'matricula', { unique: true });
            storeColab.createIndex('nome', 'nome', { unique: false });
            storeColab.createIndex('local', 'local', { unique: false });
          }

          if (!db.objectStoreNames.contains('config')) {
            db.createObjectStore('config', { keyPath: 'chave' });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          this.isReady = true;
          // IMPORTANTE: Resolve a Promise ANTES do seeding para evitar deadlock circular!
          resolve(this);
          
          try {
            await this.seedInitialDataIfEmpty();
          } catch (e) {
            console.error('Erro ao popular dados iniciais no IndexedDB:', e);
          }
        };

        request.onerror = (event) => {
          console.warn('Erro ao abrir IndexedDB. Ativando fallback para LocalStorage:', event.target.error);
          this.useLocalStorage = true;
          this.seedLocalStorageIfEmpty();
          this.isReady = true;
          resolve(this);
        };
      } catch (err) {
        console.warn('Exceção ao inicializar IndexedDB. Ativando LocalStorage:', err);
        this.useLocalStorage = true;
        this.seedLocalStorageIfEmpty();
        this.isReady = true;
        resolve(this);
      }
    });
  }

  // =========================================================================
  // SEEDING DE DADOS INICIAIS
  // =========================================================================
  async seedInitialDataIfEmpty() {
    const colabs = await this.getAll('colaboradores');
    if (colabs.length === 0 && window.INITIAL_COLABORADORES) {
      for (const c of window.INITIAL_COLABORADORES) {
        await this.add('colaboradores', {
          matricula: c.matricula,
          nome: c.nome.trim(),
          cpf: c.cpf.trim(),
          cargo: c.cargo.trim(),
          local: c.local.trim(),
          ativo: true,
          dataCadastro: new Date().toISOString()
        });
      }
    }

    const prods = await this.getAll('produtos');
    if (prods.length === 0) {
      const produtosIniciais = this.obterProdutosDemonstracao();
      for (const p of produtosIniciais) {
        await this.add('produtos', p);
      }
    }
  }

  seedLocalStorageIfEmpty() {
    if (!localStorage.getItem('santos_colaboradores') && window.INITIAL_COLABORADORES) {
      const colabs = window.INITIAL_COLABORADORES.map((c, idx) => ({
        id: idx + 1,
        matricula: c.matricula,
        nome: c.nome.trim(),
        cpf: c.cpf.trim(),
        cargo: c.cargo.trim(),
        local: c.local.trim(),
        ativo: true,
        dataCadastro: new Date().toISOString()
      }));
      localStorage.setItem('santos_colaboradores', JSON.stringify(colabs));
    }

    if (!localStorage.getItem('santos_produtos')) {
      const prods = this.obterProdutosDemonstracao().map((p, idx) => ({
        id: idx + 1,
        ...p
      }));
      localStorage.setItem('santos_produtos', JSON.stringify(prods));

      if (!localStorage.getItem('santos_movimentacoes')) {
        localStorage.setItem('santos_movimentacoes', JSON.stringify([]));
      }
    }
  }

  obterProdutosDemonstracao() {
    return [
      {
        codigo: 'EPI-001',
        nome: 'Luva de Vaqueta Mista Térmica',
        categoria: 'EPI',
        unidade: 'PAR',
        valorUnitario: 32.50,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 20,
        localizacao: 'Prateleira A1',
        descricao: 'Luva para serviços pesados de via e manutenção mecânica.',
        foto: '',
        dataCadastro: new Date().toISOString()
      },
      {
        codigo: 'EPI-002',
        nome: 'Óculos de Segurança Fumê Anti-risco',
        categoria: 'EPI',
        unidade: 'UN',
        valorUnitario: 14.80,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 30,
        localizacao: 'Prateleira A2',
        descricao: 'Proteção ocular contra radiação solar e partículas volantes.',
        foto: '',
        dataCadastro: new Date().toISOString()
      },
      {
        codigo: 'DISC-010',
        nome: 'Disco de Corte Inox 4.1/2" Norton',
        categoria: 'Consumíveis',
        unidade: 'UN',
        valorUnitario: 8.90,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 40,
        localizacao: 'Gaveta B3',
        descricao: 'Disco de corte abrasivo para esmerilhadeira.',
        foto: '',
        dataCadastro: new Date().toISOString()
      },
      {
        codigo: 'LUB-022',
        nome: 'Desengripante Spray WD-40 300ml',
        categoria: 'Lubrificantes',
        unidade: 'UN',
        valorUnitario: 28.90,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 10,
        localizacao: 'Armário Químico',
        descricao: 'Anticorrosivo, lubrificante e desengripante profissional.',
        foto: '',
        dataCadastro: new Date().toISOString()
      },
      {
        codigo: 'FERR-045',
        nome: 'Chave Combinada 19mm Tramontina PRO',
        categoria: 'Ferramentas',
        unidade: 'UN',
        valorUnitario: 45.00,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 5,
        localizacao: 'Painel 2',
        descricao: 'Aço cromo vanádio fosfatizado.',
        foto: '',
        dataCadastro: new Date().toISOString()
      },
      {
        codigo: 'SOL-008',
        nome: 'Eletrodo Revestido E7018 3,25mm (kg)',
        categoria: 'Consumíveis',
        unidade: 'KG',
        valorUnitario: 26.00,
        estoqueInicial: 0,
        estoqueAtual: 0,
        estoqueMinimo: 20,
        localizacao: 'Estufa de Eletrodos',
        descricao: 'Eletrodo básico para soldagem de aços de alta resistência em ferrovias.',
        foto: '',
        dataCadastro: new Date().toISOString()
      }
    ];
  }

  // =========================================================================
  // MÉTODOS CRUD UNIFICADOS (IndexedDB com fallback automático)
  // =========================================================================
  async add(storeName, item) {
    await this.readyPromise;

    // Garante que não sejam cadastrados produtos com o mesmo código e força caixa alta
    if (storeName === 'produtos') {
      const codNorm = String(item.codigo || '').trim().toUpperCase();
      if (!codNorm) {
        throw new Error('O código do produto é obrigatório.');
      }
      item.codigo = codNorm;

      const prods = await this.getAll('produtos');
      const dup = prods.find(p => String(p.codigo || '').trim().toUpperCase() === codNorm);
      if (dup) {
        throw new Error(`Não é permitido cadastrar produtos com o mesmo código. O código "${codNorm}" já está em uso pelo produto "${dup.nome}".`);
      }
    }

    if (this.useLocalStorage) {
      const key = `santos_${storeName}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const newId = list.length > 0 ? Math.max(...list.map(x => x.id || 0)) + 1 : 1;
      const newItem = { ...item, id: newId };
      list.push(newItem);
      localStorage.setItem(key, JSON.stringify(list));
      return newId;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async get(storeName, id) {
    await this.readyPromise;

    if (this.useLocalStorage) {
      const key = `santos_${storeName}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      return list.find(x => x.id === Number(id)) || null;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(Number(id) || id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getAll(storeName) {
    await this.readyPromise;

    if (this.useLocalStorage) {
      const key = `santos_${storeName}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async update(storeName, item) {
    await this.readyPromise;

    // Garante que a edição não utilize código já existente em outro produto e força caixa alta
    if (storeName === 'produtos') {
      const codNorm = String(item.codigo || '').trim().toUpperCase();
      if (!codNorm) {
        throw new Error('O código do produto é obrigatório.');
      }
      item.codigo = codNorm;

      const prods = await this.getAll('produtos');
      const dup = prods.find(p => String(p.id) !== String(item.id) && String(p.codigo || '').trim().toUpperCase() === codNorm);
      if (dup) {
        throw new Error(`Não é permitido duplicar códigos de produto. O código "${codNorm}" já está em uso pelo produto "${dup.nome}".`);
      }
    }

    if (this.useLocalStorage) {
      const key = `santos_${storeName}`;
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.map(x => (x.id === item.id ? item : x));
      localStorage.setItem(key, JSON.stringify(list));
      return item.id;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async delete(storeName, id) {
    await this.readyPromise;

    if (this.useLocalStorage) {
      const key = `santos_${storeName}`;
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.filter(x => x.id !== Number(id));
      localStorage.setItem(key, JSON.stringify(list));
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(Number(id) || id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async clearStore(storeName) {
    await this.readyPromise;

    if (this.useLocalStorage) {
      localStorage.removeItem(`santos_${storeName}`);
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async exportFullBackup() {
    const backup = {
      empresa: 'Santos Manutenções',
      dataExportacao: new Date().toISOString(),
      versao: DB_VERSION,
      produtos: await this.getAll('produtos'),
      movimentacoes: await this.getAll('movimentacoes'),
      colaboradores: await this.getAll('colaboradores')
    };
    return backup;
  }

  async importFullBackup(backupData) {
    if (!backupData || !backupData.produtos || !backupData.movimentacoes) {
      throw new Error('Arquivo de backup inválido ou incompatível.');
    }

    await this.clearStore('produtos');
    await this.clearStore('movimentacoes');
    if (backupData.colaboradores && backupData.colaboradores.length > 0) {
      await this.clearStore('colaboradores');
      for (const c of backupData.colaboradores) {
        await this.add('colaboradores', c);
      }
    }

    for (const p of backupData.produtos) {
      await this.add('produtos', p);
    }

    for (const m of backupData.movimentacoes) {
      await this.add('movimentacoes', m);
    }

    return true;
  }
}

// Instância singleton global
window.db = new EstoqueDatabase();
