const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const prom = require('prom-client');

const PORT = process.env.PORT || 4000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'ecommerce-api';
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

const registry = new prom.Registry();
prom.collectDefaultMetrics({ register: registry, prefix: 'ecommerce_' });

const httpRequestsTotal = new prom.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestDurationSeconds = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

const activeUsersGauge = new prom.Gauge({
  name: 'active_users',
  help: 'Simulated active users in the system',
  registers: [registry],
});

const ordersCounter = new prom.Counter({
  name: 'orders_total',
  help: 'Total number of created orders',
  labelNames: ['status'],
  registers: [registry],
});

let products = [
  { id: 1, name: 'Laptop', price: 799, stock: 12 },
  { id: 2, name: 'Keyboard', price: 49, stock: 30 },
  { id: 3, name: 'Mouse', price: 25, stock: 45 },
];
let orders = [];

function normalizeRoute(req) {
  if (req.route && req.route.path) return req.baseUrl + req.route.path;
  return req.path;
}

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = normalizeRoute(req);
    httpRequestsTotal.inc({ method: req.method, route, status_code: String(res.statusCode) });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: String(res.statusCode) }, duration);
  });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: SERVICE_NAME, time: new Date().toISOString() }));
app.get('/ready', (req, res) => res.json({ ready: true }));

app.get('/api/products', (req, res) => {
  activeUsersGauge.set(Math.floor(Math.random() * 50) + 1);
  res.json({ products });
});

app.get('/api/products/:id', (req, res) => {
  const item = products.find(p => p.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Product not found' });
  res.json(item);
});

app.post('/api/orders', async (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id === Number(productId));
  if (!product) {
    ordersCounter.inc({ status: 'failed' });
    return res.status(404).json({ error: 'Product not found' });
  }
  if (!quantity || quantity <= 0 || quantity > product.stock) {
    ordersCounter.inc({ status: 'failed' });
    return res.status(400).json({ error: 'Invalid quantity or insufficient stock' });
  }
  // Simulate variable processing latency for SLI/SLO demonstration.
  await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 120)));
  product.stock -= quantity;
  const order = { id: orders.length + 1, productId, quantity, total: product.price * quantity, createdAt: new Date().toISOString() };
  orders.push(order);
  ordersCounter.inc({ status: 'success' });
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => res.json({ orders }));

app.get('/api/error', (req, res) => res.status(500).json({ error: 'Synthetic error for alert testing' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));
