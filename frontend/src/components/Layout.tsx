import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { QuickCaptureButton } from './QuickCaptureButton';
import { NotificationCenter } from './NotificationCenter';

export function Layout() {
  return (
    <div className="flex h-screen bg-[#030303] text-neutral-50 overflow-hidden font-['Inter']">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900/40 via-black to-black p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <div className="flex justify-end mb-4">
            <NotificationCenter />
          </div>
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </main>
      <QuickCaptureButton />
    </div>
  );
}
