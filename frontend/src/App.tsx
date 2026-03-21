import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { GoalsPage } from './pages/GoalsPage';
import { KanbanBoard } from './pages/KanbanBoard';
import { HabitsPage } from './pages/HabitsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProfilePage } from './pages/ProfilePage';
import { JournalPage } from './pages/JournalPage';
import { VaultPage } from './pages/VaultPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/tasks" element={<KanbanBoard />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* Add more protected routes here later */}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
