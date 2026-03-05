export default function UsersPage() {
  return (
    <div className="p-6 space-y-6 font-mono">
      <div>
        <h1 className="text-[#CCFF00] text-lg tracking-[0.5em] font-bold">
          USERS
        </h1>
        <p className="text-[#444] text-[10px] tracking-[0.3em] mt-1">
          REGISTERED ACCOUNTS // USER DIRECTORY
        </p>
      </div>

      <div className="border border-[#333] bg-[#0a0a0a] p-10 flex flex-col items-center justify-center gap-4 min-h-64">
        <div className="text-[#333] text-5xl">◉</div>
        <div className="text-[#444] text-[10px] tracking-[0.5em]">
          COMING SOON
        </div>
        <div className="text-[#2a2a2a] text-[9px] tracking-[0.3em]">
          USER MANAGEMENT PANEL UNDER CONSTRUCTION
        </div>
      </div>
    </div>
  );
}
