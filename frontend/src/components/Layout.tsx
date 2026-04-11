import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { QuickCaptureButton } from './QuickCaptureButton';
import { NotificationCenter } from './NotificationCenter';

export function Layout() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-['Jost']">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background relative">
        <div className="relative z-10 p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex justify-end mb-4">
              <NotificationCenter />
            </div>
            <div className="flex-1 animate-fade-up">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
      <QuickCaptureButton />
    </div>
  );
}
