// Firestore simulado en memoria para pruebas (subconjunto mínimo de la API de firebase-admin).
let autoId = 0;

export function createFakeFirestore(initial = {}) {
  const data = new Map(); // "coleccion/id" -> objeto
  for (const [col, docs] of Object.entries(initial)) {
    for (const [id, value] of Object.entries(docs)) data.set(`${col}/${id}`, structuredClone(value));
  }

  const snapOf = (ref) => {
    const v = data.get(ref.path);
    return { id: ref.id, exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) };
  };

  const docRef = (col, id) => {
    const ref = {
      id,
      path: `${col}/${id}`,
      get: async () => snapOf(ref),
      set: async (v, opts) => {
        data.set(ref.path, opts?.merge ? { ...(data.get(ref.path) || {}), ...structuredClone(v) } : structuredClone(v));
      },
      update: async (v) => {
        if (!data.has(ref.path)) throw new Error(`No document to update: ${ref.path}`);
        data.set(ref.path, { ...data.get(ref.path), ...structuredClone(v) });
      },
    };
    return ref;
  };

  const listDocs = (col) =>
    [...data.keys()].filter((k) => k.startsWith(`${col}/`)).map((k) => snapOf(docRef(col, k.slice(col.length + 1))));

  const querySnap = (docs) => ({ docs, size: docs.length, forEach: (fn) => docs.forEach(fn) });

  const query = (col, filters = [], max = Infinity) => ({
    where: (field, op, value) => query(col, [...filters, { field, op, value }], max),
    limit: (n) => query(col, filters, n),
    get: async () => {
      const ops = {
        '==': (a, b) => a === b,
        '<=': (a, b) => typeof a === typeof b && a <= b,
        '<': (a, b) => typeof a === typeof b && a < b,
        '>=': (a, b) => typeof a === typeof b && a >= b,
      };
      const docs = listDocs(col).filter((s) => filters.every((f) => ops[f.op](s.data()[f.field], f.value)));
      return querySnap(docs.slice(0, max));
    },
  });

  const db = {
    _data: data,
    collection: (col) => ({
      ...query(col),
      doc: (id) => docRef(col, id ?? `auto${++autoId}`),
    }),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async (ref) => snapOf(ref),
        update: (ref, v) => writes.push(() => data.set(ref.path, { ...data.get(ref.path), ...structuredClone(v) })),
        set: (ref, v, opts) =>
          writes.push(() =>
            data.set(ref.path, opts?.merge ? { ...(data.get(ref.path) || {}), ...structuredClone(v) } : structuredClone(v)),
          ),
      };
      const result = await fn(tx); // si lanza error, no se aplica ninguna escritura (atomicidad)
      writes.forEach((w) => w());
      return result;
    },
    batch() {
      const writes = [];
      return {
        set: (ref, v) => writes.push(() => data.set(ref.path, structuredClone(v))),
        commit: async () => writes.forEach((w) => w()),
      };
    },
  };
  return db;
}
