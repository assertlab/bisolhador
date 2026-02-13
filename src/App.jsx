import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.jsx';
import { Ranking } from './pages/Ranking.jsx';
import { Timeline } from './pages/Timeline.jsx';
import { Benchmark } from './pages/Benchmark.jsx';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Dashboard isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
        <Route path="/ranking" element={<Ranking isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
        <Route path="/timeline/:owner/:repo" element={<Timeline isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
        <Route path="/benchmark" element={<Benchmark isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
      </Routes>
    </Router>
  );
}

export default App;
