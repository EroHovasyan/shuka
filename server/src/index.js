import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import db, { uploadDir } from "./db.js";
import { signToken, requireAuth, requireSeller } from "./auth.js";

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set. Set it in the environment before deployment.");
  process.env.JWT_SECRET = "local-development-secret-change-me";
}

const app = express();
const port = Number(process.env.PORT || 4000);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(-80);
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WebP images are allowed"));
    }
    cb(null, true);
  }
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "shuka-api" }));

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    return res.status(400).json({ error: "Name, valid email, and password (at least 8 characters) are required" });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const info = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)")
      .run(name.trim(), email.trim().toLowerCase(), hash);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(409).json({ error: e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "Email already registered" : "Could not create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(String(email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/become-seller", requireAuth, (req, res) => {
  db.prepare("UPDATE users SET role='seller' WHERE id=? AND role='buyer'").run(req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/products", (req, res) => {
  const q = `%${String(req.query.q || "").trim()}%`;
  const category = String(req.query.category || "");
  const rows = db.prepare(`
    SELECT p.*, u.name AS seller_name FROM products p JOIN users u ON u.id=p.seller_id
    WHERE p.active=1 AND (p.title LIKE ? OR p.description LIKE ?)
    AND (?='' OR p.category=?)
    ORDER BY p.created_at DESC LIMIT 100
  `).all(q, q, category, category);
  res.json({ products: rows });
});

app.get("/api/products/:id", (req, res) => {
  const product = db.prepare("SELECT p.*,u.name seller_name FROM products p JOIN users u ON u.id=p.seller_id WHERE p.id=? AND p.active=1").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});

app.post("/api/products", requireAuth, requireSeller, upload.single("image"), (req, res) => {
  const { title, description = "", category = "Other", price_amd, stock } = req.body;
  const price = Number(price_amd), qty = Number(stock);
  if (!title?.trim() || !Number.isInteger(price) || price < 0 || !Number.isInteger(qty) || qty < 0) {
    return res.status(400).json({ error: "Title, non-negative integer price in AMD, and stock are required" });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare(`INSERT INTO products(seller_id,title,description,category,price_amd,stock,image_url)
    VALUES(?,?,?,?,?,?,?)`).run(req.user.id, title.trim(), description, category, price, qty, imageUrl);
  res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id=?").get(info.lastInsertRowid) });
});

app.patch("/api/products/:id", requireAuth, requireSeller, (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Product not found" });
  if (p.seller_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Not your product" });
  const title = req.body.title ?? p.title;
  const description = req.body.description ?? p.description;
  const category = req.body.category ?? p.category;
  const price = req.body.price_amd === undefined ? p.price_amd : Number(req.body.price_amd);
  const stock = req.body.stock === undefined ? p.stock : Number(req.body.stock);
  if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: "Invalid price or stock" });
  db.prepare("UPDATE products SET title=?,description=?,category=?,price_amd=?,stock=? WHERE id=?")
    .run(title, description, category, price, stock, p.id);
  res.json({ product: db.prepare("SELECT * FROM products WHERE id=?").get(p.id) });
});

app.delete("/api/products/:id", requireAuth, requireSeller, (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Product not found" });
  if (p.seller_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Not your product" });
  db.prepare("UPDATE products SET active=0 WHERE id=?").run(p.id);
  res.json({ ok: true });
});

app.post("/api/orders", requireAuth, (req, res) => {
  const { items, customer_name, phone, delivery_address } = req.body || {};
  if (!Array.isArray(items) || !items.length || !customer_name?.trim() || !phone?.trim() || !delivery_address?.trim()) {
    return res.status(400).json({ error: "Cart items, customer name, phone, and delivery address are required" });
  }
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.product_id), qty = Number(item.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: "Invalid cart item" });
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }

  const createOrder = db.transaction(() => {
    const selected = [];
    let total = 0;
    for (const [id, quantity] of quantities) {
      const p = db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(id);
      if (!p) throw new Error(`Product ${id} is unavailable`);
      if (p.stock < quantity) throw new Error(`Not enough stock for ${p.title}`);
      selected.push({ ...p, quantity });
      total += p.price_amd * quantity;
    }
    const order = db.prepare(`INSERT INTO orders(buyer_id,total_amd,customer_name,phone,delivery_address)
      VALUES(?,?,?,?,?)`).run(req.user.id, total, customer_name.trim(), phone.trim(), delivery_address.trim());
    const insertItem = db.prepare(`INSERT INTO order_items(order_id,product_id,seller_id,product_title,unit_price_amd,quantity)
      VALUES(?,?,?,?,?,?)`);
    const decrement = db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?");
    for (const p of selected) {
      const result = decrement.run(p.quantity, p.id, p.quantity);
      if (result.changes !== 1) throw new Error(`Stock changed for ${p.title}; please retry`);
      insertItem.run(order.lastInsertRowid, p.id, p.seller_id, p.title, p.price_amd, p.quantity);
    }
    return order.lastInsertRowid;
  });

  try {
    const orderId = createOrder();
    res.status(201).json({ order: db.prepare("SELECT * FROM orders WHERE id=?").get(orderId) });
  } catch (e) {
    res.status(409).json({ error: e.message || "Could not place order" });
  }
});

app.get("/api/orders/mine", requireAuth, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE buyer_id=? ORDER BY created_at DESC").all(req.user.id);
  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id=?");
  res.json({ orders: orders.map(o => ({ ...o, items: getItems.all(o.id) })) });
});

app.get("/api/seller/orders", requireAuth, requireSeller, (req, res) => {
  const orders = db.prepare(`SELECT DISTINCT o.* FROM orders o JOIN order_items i ON i.order_id=o.id
    WHERE i.seller_id=? ORDER BY o.created_at DESC`).all(req.user.id);
  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id=? AND seller_id=?");
  res.json({ orders: orders.map(o => ({ ...o, items: getItems.all(o.id, req.user.id) })) });
});

app.patch("/api/seller/orders/:id/status", requireAuth, requireSeller, (req, res) => {
  const allowed = ["confirmed", "processing", "shipped", "delivered", "cancelled"];
  const status = req.body.status;
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid order status" });
  const owns = db.prepare("SELECT 1 FROM order_items WHERE order_id=? AND seller_id=? LIMIT 1").get(req.params.id, req.user.id);
  if (!owns) return res.status(404).json({ error: "Order not found for this seller" });
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, req.params.id);
  res.json({ ok: true, status });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Request failed" });
});

app.listen(port, () => console.log(`Shuka API listening on ${port}`));
