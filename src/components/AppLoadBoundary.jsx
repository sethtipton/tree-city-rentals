import { Component } from "react";

export class AppLoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="app-boot-screen"><p role="alert">This part of the app could not load. Refresh to try again.</p><button type="button" onClick={() => window.location.reload()}>Refresh app</button></main>;
    return this.props.children;
  }
}
