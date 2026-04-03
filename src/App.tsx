import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NewMusicFriday from './pages/NewMusicFriday';
import Archive from './pages/Archive';
import Submit from './pages/Submit';
import ThisWeek from './pages/ThisWeek';
import Embed from './pages/Embed';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGate from './components/AuthGate';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/newmusicfriday" element={
          <AuthGate>
            <NewMusicFriday />
          </AuthGate>
        } />
        <Route path="/newmusicfriday/archive" element={<Archive />} />
        <Route path="/newmusicfriday/submit" element={<Submit />} />
        <Route path="/newmusicfriday/thisweek" element={<ThisWeek />} />
        <Route path="/newmusicfriday/embed" element={<Embed />} />
      </Routes>
    </ErrorBoundary>
  );
}
