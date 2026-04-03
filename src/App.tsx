import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NewMusicFriday from './pages/NewMusicFriday';
import Archive from './pages/Archive';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/newmusicfriday" element={<NewMusicFriday />} />
        <Route path="/newmusicfriday/archive" element={<Archive />} />
      </Routes>
    </ErrorBoundary>
  );
}
