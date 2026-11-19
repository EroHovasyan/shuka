import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = import.meta.env.VITE_API_BASE || "/api";
const money = n => new Intl.NumberFormat("hy-AM").format(n) + " ֏";
async function request(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("shuka_token") || "");
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState({});
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [orders, setOrders] = useState([]);
  const [showOrders, setShowOrders] = useState(false);

  async function loadProducts(q = query) {
    const data = await request(`/products?q=${encodeURIComponent(q)}`);
    setProducts(data.products);
  }
  useEffect(() => { loadProducts().catch(e => setNotice(e.message)); }, []);
  useEffect(() => {
    if (token) request("/auth/me", {}, token).then(d => setUser(d.user)).catch(() => {
      localStorage.removeItem("shuka_token"); setToken(""); setUser(null);
    });
  }, [token]);

  const cartItems = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const p = products.find(x => x.id === Number(id));
    return p ? { ...p, quantity } : null;
  }).filter(Boolean), [cart, products]);
  const total = cartItems.reduce((sum, p) => sum + p.price_amd * p.quantity, 0);

  async function authenticate(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await request(`/auth/${authMode}`, { method: "POST", body: JSON.stringify({
        name: f.get("name"), email: f.get("email"), password: f.get("password")
      }) });
      localStorage.setItem("shuka_token", data.token); setToken(data.token); setUser(data.user); setNotice("Welcome to Shuka!");
    } catch (e) { setNotice(e.message); }
  }
  function logout() { localStorage.removeItem("shuka_token"); setToken(""); setUser(null); setCart({}); setNotice("Signed out"); }
  async function becomeSeller() {
    try {
      const d = await request("/auth/become-seller", { method: "POST" }, token);
      localStorage.setItem("shuka_token", d.token); setToken(d.token); setUser(d.user); setNotice("Seller tools enabled");
    } catch (e) { setNotice(e.message); }
  }
  async function placeOrder(e) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget);
      const d = await request("/orders", { method: "POST", body: JSON.stringify({
        items: cartItems.map(p => ({ product_id: p.id, quantity: p.quantity })),
        customer_name: f.get("customer_name"), phone: f.get("phone"), delivery_address: f.get("delivery_address")
      }) }, token);
      setCart({}); setNotice(`Order #${d.order.id} placed. Payment: Cash on Delivery.`);
    } catch (e) { setNotice(e.message); }
  }
  async function loadOrders() {
    if (!token) return setNotice("Please sign in first");
    try {
      const d = await request(user?.role === "seller" ? "/seller/orders" : "/orders/mine", {}, token);
      setOrders(d.orders); setShowOrders(true);
    } catch (e) { setNotice(e.message); }
  }
  async function addProduct(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request("/products", { method: "POST", body: form }, token);
      e.currentTarget.reset(); await loadProducts(); setNotice("Product published");
    } catch (e) { setNotice(e.message); }
  }

  return <div className="app">
    <header>
      <a className="brand" href="#">shuka<span>.</span></a>
      <div className="search"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && loadProducts()} placeholder="Search products..." /><button onClick={() => loadProducts()}>Search</button></div>
      <div className="account">
        {user ? <><span>Hi, {user.name}</span><button className="light" onClick={loadOrders}>My orders</button><button className="light" onClick={logout}>Log out</button></> : <a href="#account">Sign in</a>}
        <a href="#cart">Cart ({Object.values(cart).reduce((a,b)=>a+b,0)})</a>
      </div>
    </header>
    <main>
      <section className="hero"><div><p className="eyebrow">LOCAL FINDS. ONE MARKETPLACE.</p><h1>Discover something<br/><em>good.</em></h1><p>Shop independent sellers and local products across Armenia.</p></div><div className="hero-art">Շուկա</div></section>
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      <div className="layout">
        <section className="catalog">
          <div className="section-head"><div><p className="eyebrow">THE MARKETPLACE</p><h2>Latest products</h2></div><span>{products.length} items</span></div>
          <div className="products">{products.map(p => <article className="product" key={p.id}>
            <div className="product-image">{p.image_url ? <img src={`${API.replace("/api","")}${p.image_url}`} /> : <span>Շ</span>}</div>
            <div className="product-meta">{p.category} · {p.seller_name}</div><h3>{p.title}</h3><p className="price">{money(p.price_amd)}</p>
            <p className="stock">{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</p>
            <button disabled={p.stock < 1} onClick={() => setCart(c => ({...c, [p.id]: Math.min((c[p.id]||0)+1,p.stock)}))}>Add to cart</button>
          </article>)}</div>
          {products.length === 0 && <p className="empty">No products yet. Create a seller account and publish the first listing.</p>}
        </section>
        <aside>
          <section className="panel" id="account"><h2>{user ? "Your account" : authMode === "login" ? "Welcome back" : "Create account"}</h2>
            {user ? <><p>Signed in as <b>{user.role}</b>.</p>{user.role === "buyer" && <button className="wide" onClick={becomeSeller}>Become a seller</button>}</> :
              <form onSubmit={authenticate} className="stack">
                {authMode === "register" && <input name="name" placeholder="Full name" required />}
                <input name="email" type="email" placeholder="Email address" required />
                <input name="password" type="password" placeholder="Password (8+ characters)" minLength="8" required />
                <button className="wide">{authMode === "login" ? "Sign in" : "Create account"}</button>
                <button type="button" className="link-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already registered? Sign in"}</button>
              </form>}
          </section>
          {user?.role === "seller" && <section className="panel"><h2>Publish a product</h2><form className="stack" onSubmit={addProduct}>
            <input name="title" placeholder="Product title" required />
            <textarea name="description" placeholder="Description" rows="3" />
            <input name="category" placeholder="Category" defaultValue="Other" />
            <input name="price_amd" type="number" min="0" step="1" placeholder="Price (AMD)" required />
            <input name="stock" type="number" min="0" step="1" placeholder="Stock quantity" required />
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            <button className="wide">Publish listing</button>
          </form></section>}
          <section className="panel" id="cart"><h2>Your cart</h2>
            {cartItems.length ? <>{cartItems.map(p => <div className="cart-line" key={p.id}><div><b>{p.title}</b><small>{p.quantity} × {money(p.price_amd)}</small></div><button className="remove" onClick={() => setCart(c => {const n={...c}; delete n[p.id]; return n;})}>×</button></div>)}<div className="total"><span>Total</span><b>{money(total)}</b></div>
              {user ? <form onSubmit={placeOrder} className="stack"><input name="customer_name" placeholder="Recipient name" defaultValue={user.name} required /><input name="phone" placeholder="Phone number" required /><textarea name="delivery_address" placeholder="Delivery address" required rows="2" /><p className="muted">Payment method: Cash on Delivery</p><button className="wide">Place order</button></form> : <p className="muted">Sign in to checkout.</p>}</> : <p className="muted">Your cart is empty.</p>}
          </section>
          {showOrders && <section className="panel"><div className="section-head"><h2>Orders</h2><button className="light" onClick={() => setShowOrders(false)}>Close</button></div>{orders.map(o => <div className="order" key={o.id}><b>Order #{o.id}</b><span>{o.status} · {money(o.total_amd)}</span>{o.items?.map(i => <small key={i.id}>{i.product_title} × {i.quantity}</small>)}</div>)}{orders.length===0 && <p className="muted">No orders yet.</p>}</section>}
        </aside>
      </div>
    </main>
    <footer>© {new Date().getFullYear()} Shuka · A marketplace for Armenia</footer>
  </div>;
}
createRoot(document.getElementById("root")).render(<App />);
