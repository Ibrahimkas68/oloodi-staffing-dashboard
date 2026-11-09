import { ManagerPage } from './pages/Manager.js';
import { WorkerPage } from './pages/Worker.js';

/** Two views, no router dependency: "/" is the manager dashboard, "/worker" the worker view. */
export function App() {
  return window.location.pathname.startsWith('/worker') ? <WorkerPage /> : <ManagerPage />;
}
