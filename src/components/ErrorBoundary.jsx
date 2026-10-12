import { Component } from "react";

// Kutilmagan render xatosi butun ilovani oq ekranga aylantirmasin
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="w" style={{ padding: "64px 20px" }}>
        <div className="empty stack">
          <b>Nimadir notoʻgʻri ketdi.</b>
          <span>Sahifani yangilab koʻring. Muammo takrorlansa, salon bilan bogʻlaning.</span>
          <button className="btn sm" style={{ justifySelf: "center" }} onClick={() => location.reload()}>Yangilash</button>
          <details><summary>Texnik maʼlumot</summary><code style={{ fontSize: ".8rem" }}>{String(this.state.error?.message || this.state.error)}</code></details>
        </div>
      </div>
    );
  }
}
