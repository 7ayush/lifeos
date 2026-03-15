import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { KanbanBoard } from './pages/KanbanBoard';
import { HabitsPage } from './pages/HabitsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

// Mock empty pages for routing initial setup
const JournalPage = () => <div className="p-8 text-neutral-300">Journal (Coming Soon)</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<KanbanBoard />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
