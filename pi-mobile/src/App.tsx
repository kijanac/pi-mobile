import { Router, Route } from "@solidjs/router";
import Sessions from "~/routes/Sessions";
import Session from "~/routes/Session";
import Settings from "~/routes/Settings";

export default function App() {
  return (
    <Router>
      <Route path="/" component={Sessions} />
      <Route path="/s/:id" component={Session} />
      <Route path="/settings" component={Settings} />
    </Router>
  );
}
