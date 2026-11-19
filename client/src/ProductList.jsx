const homeItems = [
  { id: 1,  name: "Cotton Bed Sheet Set",   emoji: "🛏️", price: 14500, quantity: 25 },
  { id: 2,  name: "Soft Pillow",            emoji: "🛌", price: 4500,  quantity: 60 },
  { id: 3,  name: "Warm Duvet",             emoji: "🧸", price: 18900, quantity: 18 },
  { id: 4,  name: "Bath Towel Set (3 pcs)", emoji: "🛁", price: 7800,  quantity: 40 },
  { id: 5,  name: "Ceramic Dinner Set",     emoji: "🍽️", price: 24000, quantity: 12 },
  { id: 6,  name: "Non-stick Frying Pan",   emoji: "🍳", price: 6900,  quantity: 35 },
  { id: 7,  name: "Cooking Pot Set",        emoji: "🥘", price: 19500, quantity: 15 },
  { id: 8,  name: "Electric Kettle",        emoji: "☕", price: 8900,  quantity: 30 },
  { id: 9,  name: "Glass Cup Set (6 pcs)",  emoji: "🥛", price: 3200,  quantity: 50 },
  { id: 10, name: "Kitchen Knife Set",      emoji: "🔪", price: 11500, quantity: 20 },
  { id: 11, name: "Wall Clock",             emoji: "🕰️", price: 5400,  quantity: 22 },
  { id: 12, name: "Decorative Vase",        emoji: "🏺", price: 3800,  quantity: 28 },
  { id: 13, name: "Table Lamp",             emoji: "💡", price: 6200,  quantity: 24 },
  { id: 14, name: "Living Room Carpet",     emoji: "🟫", price: 32000, quantity: 9 },
  { id: 15, name: "Window Curtains",        emoji: "🪟", price: 12500, quantity: 16 },
  { id: 16, name: "Storage Basket",         emoji: "🧺", price: 2900,  quantity: 45 },
  { id: 17, name: "Laundry Basket",         emoji: "👕", price: 3500,  quantity: 38 },
  { id: 18, name: "Vacuum Cleaner",         emoji: "🧹", price: 42000, quantity: 7 },
  { id: 19, name: "Wooden Shoe Rack",       emoji: "👟", price: 9800,  quantity: 14 },
  { id: 20, name: "Photo Frame Set",        emoji: "🖼️", price: 4100,  quantity: 33 },
];

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "16px",
    padding: "16px",
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  image: {
    height: "110px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "56px",
    background: "#f3f4f6",
    borderRadius: "8px",
  },
  name: { margin: "12px 0 4px", fontSize: "16px", fontWeight: 500 },
  price: { margin: 0, fontSize: "18px", fontWeight: 700 },
  button: {
    marginTop: "12px",
    width: "100%",
    padding: "10px",
    border: "none",
    borderRadius: "8px",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  },
};

export default function ProductList() {
  return (
    <div style={styles.grid}>
      {homeItems.map((item) => {
        const inStock = item.quantity > 0;
        return (
          <div key={item.id} style={styles.card}>
            <div style={styles.image}>{item.emoji}</div>
            <h3 style={styles.name}>{item.name}</h3>
            <p style={styles.price}>{item.price.toLocaleString("en-US")} ֏</p>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: inStock ? "#16a34a" : "#dc2626" }}>
              {inStock ? `In stock: ${item.quantity}` : "Out of stock"}
            </p>
            <button
              style={{ ...styles.button, opacity: inStock ? 1 : 0.4 }}
              disabled={!inStock}
              onClick={() => console.log("add to cart", item.id)}
            >
              Add to cart
            </button>
          </div>
        );
      })}
    </div>
  );
}
