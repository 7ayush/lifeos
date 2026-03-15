import { cn } from '../lib/utils';

export function Dashboard() {
  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 mb-3 tracking-tight">Good morning, Alex.</h1>
          <p className="text-xl text-neutral-400 font-medium font-[Inter]">Ready to dominate the day? Let's check your stats.</p>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Active Snap Streaks", value: "12", trend: "+2", icon: ({className}: {className?: string}) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>, color: "text-emerald-400" },
          { label: "Goal Completion", value: "68%", trend: "+5%", icon: ({className}: {className?: string}) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>, color: "text-cyan-400" },
          { label: "Daily Task Efficiency", value: "8/10", trend: "Avg", icon: ({className}: {className?: string}) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>, color: "text-indigo-400" },
          { label: "Upcoming Deadlines", value: "3", trend: "Soon", icon: ({className}: {className?: string}) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>, color: "text-rose-400" },
        ].map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div key={i} className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl hover:bg-white/5 transition-all duration-300 shadow-lg flex items-center gap-5 group hover:-translate-y-1 hover:border-emerald-500/50">
              <div className="w-14 h-14 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner group-hover:from-emerald-900/40 group-hover:to-teal-900/40 transition-all duration-300">
                <Icon className={cn("w-7 h-7 text-emerald-400", metric.color)} />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-1">{metric.label}</p>
                <div className="flex items-end gap-2">
                   <h3 className="text-3xl font-bold text-white font-[Outfit]">{metric.value}</h3>
                   {metric.trend && (
                     <span className="text-sm text-emerald-400 font-medium mb-1 shrink-0">{metric.trend}</span>
                   )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Active Habits Section */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col shadow-lg">
          <h2 className="text-xl font-bold mb-6 text-white flex items-center">
            <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
            Daily Habits
          </h2>
          <div className="flex-1 space-y-4">
             {/* Mock Habit Item */}
             <div className="flex items-center justify-between p-4 bg-black/30 border border-white/10 rounded-2xl hover:border-emerald-500/50 transition-all group hover:-translate-y-0.5 shadow-md">
                <div>
                  <h4 className="font-semibold text-neutral-200 group-hover:text-emerald-400 transition-colors">Morning Workout</h4>
                  <p className="text-sm text-neutral-500 mt-1">15 of 20 days</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex flex-col items-center justify-center bg-black/50 rounded-xl px-3 py-1 border border-white/10">
                      <span className="text-xs uppercase text-neutral-400 font-bold">Streak</span>
                      <span className="font-bold text-emerald-400 inline-flex items-center gap-1">🔥 5</span>
                   </div>
                   <button className="w-10 h-10 rounded-full bg-black/50 border border-white/10 hover:bg-emerald-600 hover:border-emerald-500 transition-colors flex items-center justify-center cursor-pointer">
                     <span className="text-transparent group-hover:text-white transition-colors">✓</span>
                   </button>
                </div>
             </div>
          </div>
        </div>

        {/* Due Today Section */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col shadow-lg">
          <h2 className="text-xl font-bold mb-6 text-white flex items-center">
            <span className="w-2 h-6 bg-cyan-500 rounded-full mr-3"></span>
            Tasks Due Today
          </h2>
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 border border-dashed border-white/10 rounded-2xl bg-black/20">
             <p className="font-medium">No immediate tasks uncompleted.</p>
             <p className="text-sm mt-2">Check the Kanban board for planning.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
