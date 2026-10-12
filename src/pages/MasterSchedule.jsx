import { useAuth } from "../context/AuthContext.jsx";
import BookingsBoard from "../components/BookingsBoard.jsx";
import { byMaster } from "../../shared/config.js";

export default function MasterSchedule() {
  const { user } = useAuth();
  const m = byMaster(user.masterId);
  if (!m) return <div className="w"><div className="empty" style={{ margin: "48px 0" }}>Akkauntingiz usta profiliga bogʻlanmagan. Adminga murojaat qiling.</div></div>;
  return <BookingsBoard title={`Mening jadvalim — ${m.name}`} />;
}
