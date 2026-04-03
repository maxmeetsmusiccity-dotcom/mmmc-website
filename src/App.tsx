import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NewMusicFriday from './pages/NewMusicFriday';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/newmusicfriday" element={<NewMusicFriday />} />
    </Routes>
  );
}
