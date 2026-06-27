const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');

dotenv.config();

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] }));
app.use(express.json());

let cachedClient = null;

async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no está definida');
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }

  return cachedClient.db('authenticator');
}

function mapDoc(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

async function generateUniquePin(col) {
  let pin;
  let exists;

  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    exists = await col.findOne({ pin, status: 'pendiente' });
  } while (exists);

  return pin;
}

app.get('/api/status', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { email, service = 'Servicio Normal' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo es requerido' });
    }

    const db = await getDb();
    const col = db.collection('requests');

    await col.updateMany(
      { email, status: 'pendiente' },
      { $set: { status: 'cancelado', updatedAt: new Date() } }
    );

    const pin = await generateUniquePin(col);

    const doc = {
      service,
      email,
      pin,
      status: 'pendiente',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    const result = await col.insertOne(doc);

    return res.json({
      id: result.insertedId.toString(),
      service,
      email,
      status: 'pendiente',
      createdAt: doc.createdAt,
      qrData: result.insertedId.toString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests', async (_req, res) => {
  try {
    const db = await getDb();
    const docs = await db
      .collection('requests')
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return res.json(docs.map(mapDoc));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan/:id', async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection('requests').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!doc) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (doc.status !== 'pendiente') {
      return res.status(400).json({ error: 'Solicitud ya procesada', status: doc.status });
    }

    return res.json({
      id: doc._id.toString(),
      service: doc.service,
      email: doc.email,
      pin: doc.pin,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify', async (req, res) => {
  try {
    const { id, pin } = req.body;

    if (!id || !pin) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const db = await getDb();
    const col = db.collection('requests');
    const doc = await col.findOne({
      _id: new ObjectId(id),
      status: 'pendiente',
    });

    if (!doc) {
      return res.status(404).json({ error: 'Solicitud no encontrada o expirada' });
    }

    if (doc.pin !== String(pin)) {
      return res.status(400).json({ error: 'PIN incorrecto' });
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'aprobado', approvedAt: new Date() } }
    );

    return res.json({ success: true, status: 'aprobado' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/revoke/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('requests').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'cancelado', updatedAt: new Date() } }
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/status/:id', async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection('requests').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { status: 1 } }
    );

    if (!doc) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.json({ status: doc.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
