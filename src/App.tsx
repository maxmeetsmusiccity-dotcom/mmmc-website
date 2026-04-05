import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import NewMusicFriday from './pages/NewMusicFriday';
import Archive from './pages/Archive';
import Submit from './pages/Submit';
import ThisWeek from './pages/ThisWeek';
import Embed from './pages/Embed';
import Dashboard from './pages/Dashboard';
import CuratorProfile from './pages/CuratorProfile';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGate from './components/AuthGate';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/newmusicfriday" element={<AuthGate><NewMusicFriday /></AuthGate>} />
        <Route path="/newmusicfriday/archive" element={<Archive />} />
        <Route path="/newmusicfriday/submit" element={<Submit />} />
        <Route path="/newmusicfriday/thisweek" element={<ThisWeek />} />
        <Route path="/newmusicfriday/embed" element={<Embed />} />
        <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
        <Route path="/curator/:username" element={<CuratorProfile />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/nmf" element={<Navigate to="/newmusicfriday" replace />} />
        <Route path="/nmf/*" element={<Navigate to="/newmusicfriday" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
