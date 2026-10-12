export default function Avatar({ m }) {
  return <div className="av">{m.img ? <img src={m.img} alt={m.name} /> : m.name.split(" ").map((x) => x[0]).join("")}</div>;
}
