import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NewMusicFriday from './pages/NewMusicFriday';
import Archive from './pages/Archive';
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
      </Routes>
    </ErrorBoundary>
  );
}
