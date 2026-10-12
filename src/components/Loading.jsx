export default function Loading({ text = "Yuklanmoqda…" }) {
  return <div className="w"><div className="empty" style={{ margin: "48px 0" }} role="status">{text}</div></div>;
}
